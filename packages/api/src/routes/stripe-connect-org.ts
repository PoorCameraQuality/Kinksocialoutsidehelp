import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { getEmailFromUserRow, userEmailSelect } from '../lib/user-email.js'
import {
  getStripe,
  getStripePublishableKey,
  isStripeConfigured,
  publicWebBaseUrl,
  stripeBusinessProfileUrl,
} from '../lib/stripe.js'
import Stripe from 'stripe'
import { zLooseHttpUrl } from '../lib/loose-http-url.js'
import { requirePaymentsVaultUnlocked } from '../lib/payments-vault.js'
import {
  loadOrgStripe,
  parsePaymentProcessor,
  persistStripeAccountFlags,
  requireOrgOwner,
  requireOrgPaymentsManage,
  resolveOrganizationId,
  resolveOrgPaymentsManageAccess,
  serializeOrgPaymentSettings,
  serializeOrgStripeStatus,
  PAYMENT_PROCESSORS,
} from '../lib/stripe-org.js'

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

async function ensureConnectedAccount(orgId: string, actorUserId: string) {
  const stripe = getStripe()
  if (!stripe) return null
  const org = await loadOrgStripe(orgId)
  if (!org) return null

  if (org.stripeConnectAccountId) {
    const account = await stripe.accounts.retrieve(org.stripeConnectAccountId)
    await persistStripeAccountFlags(orgId, account)
    return account
  }

  const [userRow] = await db
    .select(userEmailSelect)
    .from(schema.users)
    .where(eq(schema.users.id, actorUserId))
    .limit(1)
  const email = userRow ? getEmailFromUserRow(userRow) : null

  const account = await stripe.accounts.create({
    country: 'US',
    email: email || undefined,
    controller: {
      fees: { payer: 'account' },
      losses: { payments: 'stripe' },
      stripe_dashboard: { type: 'full' },
      requirement_collection: 'stripe',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: org.displayName,
      url: stripeBusinessProfileUrl(org.slug),
    },
    metadata: {
      c2k_org_id: org.id,
      c2k_org_slug: org.slug,
    },
  })
  await persistStripeAccountFlags(orgId, account)
  return account
}

async function listPaymentManagers(orgId: string) {
  const rows = await db
    .select({
      userId: schema.organizationMembers.userId,
      role: schema.organizationMembers.role,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(
      and(
        eq(schema.organizationMembers.organizationId, orgId),
        eq(schema.organizationMembers.canManagePayments, true),
      ),
    )
  return rows
}

export async function registerStripeConnectOrgRoutes(app: FastifyInstance) {
  /**
   * Payment settings (processor + Stripe status). Works even when platform Stripe keys are unset
   * so orgs can choose external/manual without a 503.
   */
  app.get('/api/v1/organizations/:orgKey/stripe/status', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgPaymentsManage(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const access = await resolveOrgPaymentsManageAccess(orgId, user.userId)
    let org = await loadOrgStripe(orgId)
    if (!org) return reply.status(404).send({ error: 'Organization not found' })

    const platformConfigured = isStripeConfigured()
    if (platformConfigured && org.stripeConnectAccountId) {
      try {
        const stripe = getStripe()!
        const account = await stripe.accounts.retrieve(org.stripeConnectAccountId)
        await persistStripeAccountFlags(orgId, account)
        org = (await loadOrgStripe(orgId))!
      } catch {
        /* keep cached flags */
      }
    }

    const managers = access.isOwner ? await listPaymentManagers(orgId) : []

    return {
      payments: serializeOrgPaymentSettings(org),
      stripe: serializeOrgStripeStatus(org),
      processor: org.paymentProcessor,
      externalPaymentUrl: org.externalPaymentUrl,
      platformStripeConfigured: platformConfigured,
      publishableKey: platformConfigured ? getStripePublishableKey() : null,
      canManage: access.canManage,
      isOwner: access.isOwner,
      managers,
    }
  })

  app.patch('/api/v1/organizations/:orgKey/payments', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const body = z
      .object({
        processor: z.enum(PAYMENT_PROCESSORS).optional(),
        externalPaymentUrl: z
          .union([zLooseHttpUrl, z.literal(''), z.null()])
          .optional(),
      })
      .refine((d) => d.processor !== undefined || d.externalPaymentUrl !== undefined, {
        message: 'No changes',
      })
      .safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', details: body.error.flatten() })
    }

    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgPaymentsManage(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const patch: {
      paymentProcessor?: string
      externalPaymentUrl?: string | null
    } = {}
    if (body.data.processor !== undefined) patch.paymentProcessor = body.data.processor
    if (body.data.externalPaymentUrl !== undefined) {
      patch.externalPaymentUrl =
        body.data.externalPaymentUrl === '' || body.data.externalPaymentUrl === null
          ? null
          : body.data.externalPaymentUrl
    }

    await db.update(schema.organizations).set(patch).where(eq(schema.organizations.id, orgId))
    const org = await loadOrgStripe(orgId)
    if (!org) return reply.status(404).send({ error: 'Organization not found' })
    return { payments: serializeOrgPaymentSettings(org) }
  })

  /** Owner-only: grant or revoke payment management for a member. */
  app.put('/api/v1/organizations/:orgKey/payments/managers/:userId', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const body = z.object({ canManage: z.boolean() }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })

    const { orgKey, userId: targetUserId } = req.params as { orgKey: string; userId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgOwner(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    if (targetUserId === user.userId) {
      return reply.status(400).send({ error: 'Owner already manages payments' })
    }

    const [target] = await db
      .select({
        userId: schema.organizationMembers.userId,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId),
        ),
      )
      .limit(1)
    if (!target) return reply.status(404).send({ error: 'Member not found' })
    if (target.role === 'OWNER') {
      return reply.status(400).send({ error: 'Owner already manages payments' })
    }

    await db
      .update(schema.organizationMembers)
      .set({ canManagePayments: body.data.canManage })
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId),
        ),
      )

    return { ok: true, managers: await listPaymentManagers(orgId) }
  })

  app.post('/api/v1/organizations/:orgKey/stripe/connect', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgPaymentsManage(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const orgBefore = await loadOrgStripe(orgId)
    if (orgBefore && parsePaymentProcessor(orgBefore.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'Switch payment processor to Stripe before connecting an account',
        code: 'processor_not_stripe',
      })
    }

    const stripe = getStripe()!
    try {
      const account = await ensureConnectedAccount(orgId, user.userId)
      if (!account) return reply.status(500).send({ error: 'Could not create Stripe account' })

      const base = publicWebBaseUrl()
      const returnUrl = `${base}/organizer/orgs/${encodeURIComponent(orgKey)}?tab=payments&stripe=return`
      const refreshUrl = `${base}/organizer/orgs/${encodeURIComponent(orgKey)}?tab=payments&stripe=refresh`

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      })

      let accountSessionClientSecret: string | null = null
      try {
        const session = await stripe.accountSessions.create({
          account: account.id,
          components: {
            account_onboarding: { enabled: true },
            notification_banner: { enabled: true },
          },
        })
        accountSessionClientSecret = session.client_secret
      } catch {
        /* Account Sessions may be unavailable; Account Link still works */
      }

      const org = (await loadOrgStripe(orgId))!
      return {
        stripe: serializeOrgStripeStatus(org),
        payments: serializeOrgPaymentSettings(org),
        publishableKey: getStripePublishableKey(),
        accountLinkUrl: accountLink.url,
        accountSessionClientSecret,
      }
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        return reply.status(400).send({
          error: err.message || 'Stripe Connect failed',
          code: err.code || 'stripe_error',
        })
      }
      throw err
    }
  })

  app.post('/api/v1/organizations/:orgKey/stripe/dashboard-link', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgPaymentsManage(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const org = await loadOrgStripe(orgId)
    if (!org?.stripeConnectAccountId) {
      return reply.status(400).send({ error: 'Stripe is not connected for this organization' })
    }

    return {
      url: `https://dashboard.stripe.com/${org.stripeConnectAccountId}`,
    }
  })

  app.post('/api/v1/organizations/:orgKey/stripe/membership-plans', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        amountCents: z.number().int().positive().max(10_000_000),
        interval: z.enum(['month', 'year']).default('month'),
        currency: z.string().trim().toLowerCase().length(3).default('usd'),
      })
      .safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body', details: body.error.flatten() })

    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgPaymentsManage(orgId, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const org = await loadOrgStripe(orgId)
    if (!org || parsePaymentProcessor(org.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({ error: 'Membership plans require Stripe as the payment processor' })
    }
    if (!org.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
      return reply.status(400).send({ error: 'Connect Stripe and finish onboarding before creating plans' })
    }

    const stripe = getStripe()!
    const product = await stripe.products.create(
      {
        name: body.data.name,
        metadata: { c2k_org_id: orgId },
      },
      { stripeAccount: org.stripeConnectAccountId },
    )
    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: body.data.amountCents,
        currency: body.data.currency,
        recurring: { interval: body.data.interval },
        metadata: { c2k_org_id: orgId },
      },
      { stripeAccount: org.stripeConnectAccountId },
    )

    const prev =
      org.stripeMembershipConfig && typeof org.stripeMembershipConfig === 'object'
        ? (org.stripeMembershipConfig as { plans?: unknown[] })
        : { plans: [] }
    const plans = Array.isArray(prev.plans) ? [...prev.plans] : []
    const plan = {
      priceId: price.id,
      productId: product.id,
      name: body.data.name,
      interval: body.data.interval,
      amountCents: body.data.amountCents,
      currency: body.data.currency,
      active: true,
    }
    plans.push(plan)
    await db
      .update(schema.organizations)
      .set({ stripeMembershipConfig: { plans } })
      .where(eq(schema.organizations.id, orgId))

    return { plan, plans }
  })

  app.get('/api/v1/organizations/:orgKey/stripe/membership-plans', async (req, reply) => {
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    const org = await loadOrgStripe(orgId)
    if (!org) return reply.status(404).send({ error: 'Organization not found' })
    const cfg =
      org.stripeMembershipConfig && typeof org.stripeMembershipConfig === 'object'
        ? (org.stripeMembershipConfig as { plans?: unknown[] })
        : { plans: [] }
    return {
      readyForCheckout: Boolean(
        org.paymentProcessor === 'stripe' &&
          org.stripeConnectAccountId &&
          org.stripeConnectChargesEnabled,
      ),
      processor: org.paymentProcessor,
      plans: Array.isArray(cfg.plans) ? cfg.plans : [],
    }
  })
}
