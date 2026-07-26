import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { canViewerSeeEventDetail } from '../lib/event-access.js'
import { getStripe, isStripeConfigured, publicWebBaseUrl } from '../lib/stripe.js'
import { safeCheckoutReturnPath } from '../lib/stripe-checkout-return-path.js'
import { loadOrgStripe, parsePaymentProcessor } from '../lib/stripe-org.js'
import { loadVendorStripe } from '../lib/stripe-vendor.js'
import { getConventionWithAccess } from './conventions-routes.js'

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

export async function registerStripeCheckoutRoutes(app: FastifyInstance) {
  app.post('/api/v1/conventions/:key/checkout', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }

    const body = z
      .object({
        categoryId: z.string().uuid(),
        successPath: z.string().max(500).optional(),
        cancelPath: z.string().max(500).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body', details: body.error.flatten() })

    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })

    const orgId = resolved.conv.organizationId
    if (!orgId) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const org = await loadOrgStripe(orgId)
    if (!org || parsePaymentProcessor(org.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'This organization is not using Stripe for ticket payments',
        code: 'processor_not_stripe',
      })
    }
    if (!org.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
      return reply.status(400).send({
        error: 'This organization has not finished Stripe Connect onboarding',
        code: 'stripe_not_ready',
      })
    }

    const [category] = await db
      .select()
      .from(schema.conventionRegistrationCategories)
      .where(
        and(
          eq(schema.conventionRegistrationCategories.id, body.data.categoryId),
          eq(schema.conventionRegistrationCategories.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!category) return reply.status(404).send({ error: 'Category not found' })
    const priceCents = category.priceCents ?? 0
    if (priceCents <= 0) {
      return reply.status(400).send({ error: 'This category does not require payment' })
    }

    const base = publicWebBaseUrl()
    const convSlug = resolved.conv.slug || key
    const successPath = safeCheckoutReturnPath(
      body.data.successPath,
      `/conventions/${encodeURIComponent(convSlug)}/register?paid=1`,
    )
    const cancelPath = safeCheckoutReturnPath(
      body.data.cancelPath,
      `/conventions/${encodeURIComponent(convSlug)}/register?paid=cancel`,
    )

    const stripe = getStripe()!
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: undefined,
        client_reference_id: user.userId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: priceCents,
              product_data: {
                name: `${resolved.conv.name ?? 'Convention'} — ${category.name}`,
              },
            },
          },
        ],
        success_url: `${base}${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}${cancelPath}`,
        metadata: {
          c2k_org_id: orgId,
          c2k_user_id: user.userId,
          c2k_convention_id: resolved.conv.id,
          c2k_category_id: category.id,
          c2k_mode: 'ticket',
        },
        payment_intent_data: {
          metadata: {
            c2k_org_id: orgId,
            c2k_user_id: user.userId,
            c2k_convention_id: resolved.conv.id,
            c2k_category_id: category.id,
          },
        },
      },
      { stripeAccount: org.stripeConnectAccountId },
    )

    await db.insert(schema.stripeCheckoutSessions).values({
      orgId,
      userId: user.userId,
      conventionId: resolved.conv.id,
      categoryId: category.id,
      stripeSessionId: session.id,
      stripeAccountId: org.stripeConnectAccountId,
      mode: 'payment',
      status: session.status ?? 'open',
      amountCents: priceCents,
      currency: 'usd',
    })

    if (!session.url) return reply.status(500).send({ error: 'Checkout session missing URL' })
    return { url: session.url, sessionId: session.id }
  })

  app.post('/api/v1/organizations/:orgKey/membership/checkout', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const body = z.object({ priceId: z.string().min(3).max(200) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })

    const { orgKey } = req.params as { orgKey: string }
    const { resolveOrganizationId } = await import('../lib/stripe-org.js')
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    const org = await loadOrgStripe(orgId)
    if (!org || parsePaymentProcessor(org.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'This organization is not using Stripe for memberships',
        code: 'processor_not_stripe',
      })
    }
    if (!org.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
      return reply.status(400).send({ error: 'Organization Stripe is not ready', code: 'stripe_not_ready' })
    }

    const cfg =
      org.stripeMembershipConfig && typeof org.stripeMembershipConfig === 'object'
        ? (org.stripeMembershipConfig as { plans?: { priceId?: string; active?: boolean }[] })
        : { plans: [] }
    const plan = (cfg.plans ?? []).find((p) => p.priceId === body.data.priceId && p.active !== false)
    if (!plan) return reply.status(404).send({ error: 'Membership plan not found' })

    const base = publicWebBaseUrl()
    const stripe = getStripe()!
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: body.data.priceId, quantity: 1 }],
        success_url: `${base}/orgs/${encodeURIComponent(org.slug)}?membership=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/orgs/${encodeURIComponent(org.slug)}?membership=cancel`,
        client_reference_id: user.userId,
        metadata: {
          c2k_org_id: orgId,
          c2k_user_id: user.userId,
          c2k_mode: 'membership',
          c2k_price_id: body.data.priceId,
        },
        subscription_data: {
          metadata: {
            c2k_org_id: orgId,
            c2k_user_id: user.userId,
            c2k_price_id: body.data.priceId,
          },
        },
      },
      { stripeAccount: org.stripeConnectAccountId },
    )

    await db.insert(schema.stripeCheckoutSessions).values({
      orgId,
      userId: user.userId,
      conventionId: null,
      categoryId: null,
      stripeSessionId: session.id,
      stripeAccountId: org.stripeConnectAccountId,
      mode: 'subscription',
      status: session.status ?? 'open',
      currency: 'usd',
    })

    if (!session.url) return reply.status(500).send({ error: 'Checkout session missing URL' })
    return { url: session.url, sessionId: session.id }
  })

  app.post('/api/v1/organizations/:orgKey/membership/portal', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const { orgKey } = req.params as { orgKey: string }
    const { resolveOrganizationId } = await import('../lib/stripe-org.js')
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    const org = await loadOrgStripe(orgId)
    if (!org?.stripeConnectAccountId) {
      return reply.status(400).send({ error: 'Organization Stripe is not connected' })
    }

    const [member] = await db
      .select({ membershipBilling: schema.organizationMembers.membershipBilling })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, user.userId),
        ),
      )
      .limit(1)
    const billing =
      member?.membershipBilling && typeof member.membershipBilling === 'object'
        ? (member.membershipBilling as { stripeCustomerId?: string })
        : {}
    if (!billing.stripeCustomerId) {
      return reply.status(400).send({ error: 'No Stripe customer on file for this membership' })
    }

    const stripe = getStripe()!
    const portal = await stripe.billingPortal.sessions.create(
      {
        customer: billing.stripeCustomerId,
        return_url: `${publicWebBaseUrl()}/orgs/${encodeURIComponent(org.slug)}`,
      },
      { stripeAccount: org.stripeConnectAccountId },
    )
    return { url: portal.url }
  })

  /** Org-owned event ticket Checkout (same Connect account as conventions). */
  app.post('/api/v1/events/:eventId/checkout', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const { eventId } = req.params as { eventId: string }
    const [event] = await db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        organizationId: schema.events.organizationId,
        priceCents: schema.events.priceCents,
        ticketPurchaseUrl: schema.events.ticketPurchaseUrl,
        visibility: schema.events.visibility,
        hostId: schema.events.hostId,
        groupId: schema.events.groupId,
      })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (
      !(await canViewerSeeEventDetail(user.userId, {
        id: event.id,
        visibility: event.visibility,
        hostId: event.hostId,
        groupId: event.groupId,
        organizationId: event.organizationId,
      }))
    ) {
      return reply.status(404).send({ error: 'Event not found' })
    }
    if (!event.organizationId) {
      return reply.status(400).send({
        error: 'Event must belong to an organization to use Stripe Checkout',
        code: 'event_not_org_owned',
      })
    }
    const priceCents = event.priceCents ?? 0
    if (priceCents <= 0) {
      return reply.status(400).send({ error: 'This event does not require payment' })
    }

    const org = await loadOrgStripe(event.organizationId)
    if (!org || parsePaymentProcessor(org.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'This organization is not using Stripe for ticket payments',
        code: 'processor_not_stripe',
      })
    }
    if (!org.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
      return reply.status(400).send({
        error: 'This organization has not finished Stripe Connect onboarding',
        code: 'stripe_not_ready',
      })
    }

    const base = publicWebBaseUrl()
    const successPath = `/events/${encodeURIComponent(event.id)}?paid=1`
    const cancelPath = `/events/${encodeURIComponent(event.id)}?paid=cancel`
    const stripe = getStripe()!
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: user.userId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: priceCents,
              product_data: { name: event.title },
            },
          },
        ],
        success_url: `${base}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}${cancelPath}`,
        metadata: {
          c2k_mode: 'event_ticket',
          c2k_org_id: event.organizationId,
          c2k_user_id: user.userId,
          c2k_event_id: event.id,
        },
        payment_intent_data: {
          metadata: {
            c2k_org_id: event.organizationId,
            c2k_user_id: user.userId,
            c2k_event_id: event.id,
          },
        },
      },
      { stripeAccount: org.stripeConnectAccountId },
    )

    await db.insert(schema.stripeCheckoutSessions).values({
      orgId: event.organizationId,
      userId: user.userId,
      eventId: event.id,
      stripeSessionId: session.id,
      stripeAccountId: org.stripeConnectAccountId,
      mode: 'payment',
      status: session.status ?? 'open',
      amountCents: priceCents,
      currency: 'usd',
    })

    if (!session.url) return reply.status(500).send({ error: 'Checkout session missing URL' })
    return { url: session.url, sessionId: session.id }
  })

  /** Vendor-owned product Checkout (vendor Connect account = MoR). */
  app.post('/api/v1/vendors/:vendorKey/products/:productId/checkout', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const { vendorKey, productId } = req.params as { vendorKey: string; productId: string }

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const [vendorRow] = await db
      .select({ id: schema.vendorProfiles.id, slug: schema.vendorProfiles.slug })
      .from(schema.vendorProfiles)
      .where(
        UUID_RE.test(vendorKey)
          ? eq(schema.vendorProfiles.id, vendorKey)
          : eq(schema.vendorProfiles.slug, vendorKey),
      )
      .limit(1)
    if (!vendorRow) return reply.status(404).send({ error: 'Vendor not found' })

    const vendor = await loadVendorStripe(vendorRow.id)
    if (!vendor || parsePaymentProcessor(vendor.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'This vendor is not using Stripe for in-platform checkout',
        code: 'processor_not_stripe',
      })
    }
    if (!vendor.stripeConnectAccountId || !vendor.stripeConnectChargesEnabled) {
      return reply.status(400).send({
        error: 'Vendor Stripe Connect is not ready',
        code: 'stripe_not_ready',
      })
    }

    const [product] = await db
      .select()
      .from(schema.products)
      .where(
        and(eq(schema.products.id, productId), eq(schema.products.vendorId, vendor.id)),
      )
      .limit(1)
    if (!product) return reply.status(404).send({ error: 'Product not found' })
    const priceCents = product.priceCents ?? 0
    if (priceCents <= 0) {
      return reply.status(400).send({ error: 'This product does not have a price for Checkout' })
    }

    const base = publicWebBaseUrl()
    const successPath = `/vendors/${encodeURIComponent(vendor.slug)}?paid=1`
    const cancelPath = `/vendors/${encodeURIComponent(vendor.slug)}?paid=cancel`
    const stripe = getStripe()!
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: user.userId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: priceCents,
              product_data: { name: product.title },
            },
          },
        ],
        success_url: `${base}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}${cancelPath}`,
        metadata: {
          c2k_mode: 'vendor_product',
          c2k_vendor_id: vendor.id,
          c2k_product_id: product.id,
          c2k_user_id: user.userId,
        },
        payment_intent_data: {
          metadata: {
            c2k_vendor_id: vendor.id,
            c2k_product_id: product.id,
            c2k_user_id: user.userId,
          },
        },
      },
      { stripeAccount: vendor.stripeConnectAccountId },
    )

    await db.insert(schema.stripeCheckoutSessions).values({
      orgId: null,
      userId: user.userId,
      vendorProfileId: vendor.id,
      productId: product.id,
      stripeSessionId: session.id,
      stripeAccountId: vendor.stripeConnectAccountId,
      mode: 'payment',
      status: session.status ?? 'open',
      amountCents: priceCents,
      currency: 'usd',
    })

    if (!session.url) return reply.status(500).send({ error: 'Checkout session missing URL' })
    return { url: session.url, sessionId: session.id }
  })
}
