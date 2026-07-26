import { eq } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import type Stripe from 'stripe'
import { db, schema } from '../db/index.js'
import { requireVendorShopManager } from './vendor-shop-people.js'
import { parsePaymentProcessor, type PaymentProcessor } from './stripe-org.js'

export type VendorStripeRow = {
  id: string
  slug: string
  displayName: string
  userId: string
  paymentProcessor: PaymentProcessor
  externalPaymentUrl: string | null
  stripeConnectAccountId: string | null
  stripeConnectChargesEnabled: boolean
  stripeConnectPayoutsEnabled: boolean
  stripeConnectDetailsSubmitted: boolean
}

export async function loadVendorStripe(vendorId: string): Promise<VendorStripeRow | null> {
  const [row] = await db
    .select({
      id: schema.vendorProfiles.id,
      slug: schema.vendorProfiles.slug,
      displayName: schema.vendorProfiles.displayName,
      userId: schema.vendorProfiles.userId,
      paymentProcessor: schema.vendorProfiles.paymentProcessor,
      externalPaymentUrl: schema.vendorProfiles.externalPaymentUrl,
      stripeConnectAccountId: schema.vendorProfiles.stripeConnectAccountId,
      stripeConnectChargesEnabled: schema.vendorProfiles.stripeConnectChargesEnabled,
      stripeConnectPayoutsEnabled: schema.vendorProfiles.stripeConnectPayoutsEnabled,
      stripeConnectDetailsSubmitted: schema.vendorProfiles.stripeConnectDetailsSubmitted,
    })
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorId))
    .limit(1)
  if (!row) return null
  return {
    ...row,
    paymentProcessor: parsePaymentProcessor(row.paymentProcessor),
    externalPaymentUrl: row.externalPaymentUrl ?? null,
  }
}

/** Bind / refresh Connect flags during vendor Connect onboarding. */
export async function persistVendorStripeAccountFlags(
  vendorId: string,
  account: Stripe.Account,
): Promise<void> {
  await db
    .update(schema.vendorProfiles)
    .set({
      stripeConnectAccountId: account.id,
      stripeConnectChargesEnabled: Boolean(account.charges_enabled),
      stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
      stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
      stripeConnectUpdatedAt: new Date(),
    })
    .where(eq(schema.vendorProfiles.id, vendorId))
}

/**
 * Webhook-safe flag sync: only updates vendors already bound to this Connect account id.
 * Never establishes a new vendor↔account binding from Account metadata.
 */
export async function syncVendorStripeFlagsByAccountId(account: Stripe.Account): Promise<void> {
  await db
    .update(schema.vendorProfiles)
    .set({
      stripeConnectChargesEnabled: Boolean(account.charges_enabled),
      stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
      stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
      stripeConnectUpdatedAt: new Date(),
    })
    .where(eq(schema.vendorProfiles.stripeConnectAccountId, account.id))
}

export function serializeVendorStripeStatus(v: VendorStripeRow) {
  return {
    configured: Boolean(v.stripeConnectAccountId),
    accountId: v.stripeConnectAccountId,
    chargesEnabled: v.stripeConnectChargesEnabled,
    payoutsEnabled: v.stripeConnectPayoutsEnabled,
    detailsSubmitted: v.stripeConnectDetailsSubmitted,
    readyForCheckout: Boolean(v.stripeConnectAccountId && v.stripeConnectChargesEnabled),
    dashboardUrl: v.stripeConnectAccountId
      ? `https://dashboard.stripe.com/${v.stripeConnectAccountId}`
      : null,
  }
}

export async function requireVendorPaymentsManage(
  vendorId: string,
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const gate = await requireVendorShopManager(vendorId, userId)
  if (!gate.ok) {
    reply.status(gate.status).send({
      error: gate.status === 404 ? 'Vendor shop not found' : 'Forbidden',
    })
    return false
  }
  return true
}
