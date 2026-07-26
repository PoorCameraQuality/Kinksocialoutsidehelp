import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
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
import { zLooseHttpUrl } from '../lib/loose-http-url.js'
import { requirePaymentsVaultUnlocked } from '../lib/payments-vault.js'
import { PAYMENT_PROCESSORS, parsePaymentProcessor } from '../lib/stripe-org.js'
import {
  loadVendorStripe,
  persistVendorStripeAccountFlags,
  requireVendorPaymentsManage,
  serializeVendorStripeStatus,
} from '../lib/stripe-vendor.js'
import { resolveManagedVendorForMeRoutes } from '../lib/vendor-shop-people.js'

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

async function ensureVendorConnectedAccount(vendorId: string, actorUserId: string) {
  const stripe = getStripe()
  if (!stripe) return null
  const vendor = await loadVendorStripe(vendorId)
  if (!vendor) return null

  if (vendor.stripeConnectAccountId) {
    const account = await stripe.accounts.retrieve(vendor.stripeConnectAccountId)
    await persistVendorStripeAccountFlags(vendorId, account)
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
      name: vendor.displayName,
      url: stripeBusinessProfileUrl(vendor.slug, 'vendor'),
    },
    metadata: {
      c2k_vendor_id: vendor.id,
      c2k_vendor_slug: vendor.slug,
    },
  })
  await persistVendorStripeAccountFlags(vendorId, account)
  return account
}

export async function registerStripeConnectVendorRoutes(app: FastifyInstance) {
  app.get('/api/v1/vendors/me/stripe/status', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const resolved = await resolveManagedVendorForMeRoutes(user.userId)
    if (!resolved.ok) return reply.status(resolved.status).send({ error: resolved.error })
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    let vendor = await loadVendorStripe(resolved.vendor.id)
    if (!vendor) return reply.status(404).send({ error: 'Vendor shop not found' })

    const platformConfigured = isStripeConfigured()
    if (platformConfigured && vendor.stripeConnectAccountId) {
      try {
        const account = await getStripe()!.accounts.retrieve(vendor.stripeConnectAccountId)
        await persistVendorStripeAccountFlags(vendor.id, account)
        vendor = (await loadVendorStripe(vendor.id))!
      } catch {
        /* cached flags */
      }
    }

    return {
      processor: vendor.paymentProcessor,
      externalPaymentUrl: vendor.externalPaymentUrl,
      stripe: serializeVendorStripeStatus(vendor),
      platformStripeConfigured: platformConfigured,
      publishableKey: platformConfigured ? getStripePublishableKey() : null,
    }
  })

  app.patch('/api/v1/vendors/me/payments', async (req, reply) => {
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
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })

    const resolved = await resolveManagedVendorForMeRoutes(user.userId)
    if (!resolved.ok) return reply.status(resolved.status).send({ error: resolved.error })
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const patch: { paymentProcessor?: string; externalPaymentUrl?: string | null } = {}
    if (body.data.processor !== undefined) patch.paymentProcessor = body.data.processor
    if (body.data.externalPaymentUrl !== undefined) {
      patch.externalPaymentUrl =
        body.data.externalPaymentUrl === '' || body.data.externalPaymentUrl === null
          ? null
          : body.data.externalPaymentUrl
    }
    await db.update(schema.vendorProfiles).set(patch).where(eq(schema.vendorProfiles.id, resolved.vendor.id))
    const vendor = await loadVendorStripe(resolved.vendor.id)
    return {
      processor: vendor?.paymentProcessor,
      externalPaymentUrl: vendor?.externalPaymentUrl ?? null,
      stripe: vendor ? serializeVendorStripeStatus(vendor) : null,
    }
  })

  app.post('/api/v1/vendors/me/stripe/connect', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Stripe is not configured', code: 'stripe_not_configured' })
    }
    const resolved = await resolveManagedVendorForMeRoutes(user.userId)
    if (!resolved.ok) return reply.status(resolved.status).send({ error: resolved.error })
    if (!(await requireVendorPaymentsManage(resolved.vendor.id, user.userId, reply))) return
    if (!(await requirePaymentsVaultUnlocked(user.userId, reply))) return

    const before = await loadVendorStripe(resolved.vendor.id)
    if (before && parsePaymentProcessor(before.paymentProcessor) !== 'stripe') {
      return reply.status(400).send({
        error: 'Switch payment processor to Stripe before connecting an account',
        code: 'processor_not_stripe',
      })
    }

    const stripe = getStripe()!
    try {
      const account = await ensureVendorConnectedAccount(resolved.vendor.id, user.userId)
      if (!account) return reply.status(500).send({ error: 'Could not create Stripe account' })

      const base = publicWebBaseUrl()
      const returnUrl = `${base}/settings/vendor?stripe=return`
      const refreshUrl = `${base}/settings/vendor?stripe=refresh`
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      })
      const vendor = (await loadVendorStripe(resolved.vendor.id))!
      return {
        stripe: serializeVendorStripeStatus(vendor),
        accountLinkUrl: accountLink.url,
        publishableKey: getStripePublishableKey(),
      }
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        return reply.status(400).send({ error: err.message || 'Stripe Connect failed', code: err.code })
      }
      throw err
    }
  })
}
