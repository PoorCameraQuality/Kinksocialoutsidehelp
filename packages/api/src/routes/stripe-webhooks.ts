import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { db, schema } from '../db/index.js'
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from '../lib/stripe.js'
import { setConventionPaidConfirmed, setEventPaidConfirmed } from '../lib/stripe-paid-access.js'
import { syncOrgStripeFlagsByAccountId } from '../lib/stripe-org.js'
import { syncVendorStripeFlagsByAccountId } from '../lib/stripe-vendor.js'

/** Claim idempotency key; false if already claimed. Delete on handler failure so Stripe can retry. */
async function claimWebhookEvent(eventId: string, type: string): Promise<boolean> {
  try {
    await db.insert(schema.stripeWebhookEvents).values({
      stripeEventId: eventId,
      type,
    })
    return true
  } catch {
    return false
  }
}

async function releaseWebhookEventClaim(eventId: string): Promise<void> {
  await db
    .delete(schema.stripeWebhookEvents)
    .where(eq(schema.stripeWebhookEvents.stripeEventId, eventId))
}

async function upsertMembershipBilling(params: {
  orgId: string
  userId: string
  billing: Record<string, unknown>
  /** When false, never auto-create a membership row (subscription lifecycle updates). */
  allowInsert: boolean
}) {
  const [mine] = await db
    .select({ id: schema.organizationMembers.id })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, params.orgId),
        eq(schema.organizationMembers.userId, params.userId),
      ),
    )
    .limit(1)

  if (mine) {
    await db
      .update(schema.organizationMembers)
      .set({ membershipBilling: params.billing })
      .where(eq(schema.organizationMembers.id, mine.id))
    return
  }

  if (!params.allowInsert) return

  await db.insert(schema.organizationMembers).values({
    organizationId: params.orgId,
    userId: params.userId,
    role: 'MEMBER',
    membershipBilling: params.billing,
  })
}

function checkoutSessionIsPaid(session: Stripe.Checkout.Session): boolean {
  if (session.mode === 'subscription') {
    return session.status === 'complete' || session.payment_status === 'paid'
  }
  return session.payment_status === 'paid'
}

/**
 * Fulfill only platform-created Checkout sessions (row in stripe_checkout_sessions).
 * Never trust connected-account Checkout metadata alone — Full Dashboard accounts can forge it.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null,
) {
  if (!checkoutSessionIsPaid(session)) return

  const [row] = await db
    .select()
    .from(schema.stripeCheckoutSessions)
    .where(eq(schema.stripeCheckoutSessions.stripeSessionId, session.id))
    .limit(1)
  if (!row) return

  if (
    connectedAccountId &&
    row.stripeAccountId &&
    connectedAccountId !== row.stripeAccountId
  ) {
    return
  }

  const userId = row.userId
  const meta = session.metadata ?? {}

  await db
    .update(schema.stripeCheckoutSessions)
    .set({
      status: 'complete',
      completedAt: new Date(),
    })
    .where(eq(schema.stripeCheckoutSessions.id, row.id))

  if (row.conventionId) {
    await setConventionPaidConfirmed({ conventionId: row.conventionId, userId })
    return
  }

  if (row.eventId) {
    await setEventPaidConfirmed({ eventId: row.eventId, userId })
    return
  }

  if (row.vendorProfileId) {
    /* Product sales settle on the vendor Connect account; session row marks complete above. */
    return
  }

  if (row.mode === 'subscription' && row.orgId) {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null
    await upsertMembershipBilling({
      orgId: row.orgId,
      userId,
      allowInsert: true,
      billing: {
        status: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: meta.c2k_price_id ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const meta = sub.metadata ?? {}
  const orgId = meta.c2k_org_id
  const userId = meta.c2k_user_id
  if (!orgId || !userId) return
  const item = sub.items.data[0]
  const priceId = item?.price?.id ?? meta.c2k_price_id ?? null
  const periodEnd = item?.current_period_end
  // Lifecycle updates only touch existing members — never grant membership from subscription metadata alone.
  await upsertMembershipBilling({
    orgId,
    userId,
    allowInsert: false,
    billing: {
      status: sub.status,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  })
}

export async function registerStripeWebhookRoutes(app: FastifyInstance) {
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers()
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body)
    })

    scope.post('/api/v1/webhooks/stripe', async (req, reply) => {
      if (!isStripeConfigured()) {
        return reply.status(503).send({ error: 'Stripe is not configured' })
      }
      const whSecret = getStripeWebhookSecret()
      if (!whSecret) {
        return reply.status(503).send({ error: 'STRIPE_WEBHOOK_SECRET is not configured' })
      }
      const stripe = getStripe()!
      const rawBody = req.body as Buffer
      const sig = req.headers['stripe-signature']
      if (typeof sig !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature' })
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, whSecret)
      } catch {
        return reply.status(400).send({ error: 'Invalid signature' })
      }

      const claimed = await claimWebhookEvent(event.id, event.type)
      if (!claimed) {
        return reply.send({ received: true, duplicate: true })
      }

      try {
        const connectedAccountId =
          typeof event.account === 'string' ? event.account : null

        switch (event.type) {
          case 'checkout.session.completed': {
            await handleCheckoutCompleted(
              event.data.object as Stripe.Checkout.Session,
              connectedAccountId,
            )
            break
          }
          case 'account.updated': {
            /* Only sync flags for accounts already bound in DB — never establish binding from metadata. */
            const account = event.data.object as Stripe.Account
            await syncOrgStripeFlagsByAccountId(account)
            await syncVendorStripeFlagsByAccountId(account)
            break
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
            break
          }
          default:
            break
        }
      } catch (err) {
        await releaseWebhookEventClaim(event.id)
        req.log.error({ err, eventType: event.type }, 'stripe webhook handler failed')
        return reply.status(500).send({ error: 'Webhook handler failed' })
      }

      return reply.send({ received: true })
    })
  })
}
