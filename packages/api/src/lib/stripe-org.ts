import { and, eq } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import type Stripe from 'stripe'
import { db, schema } from '../db/index.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const PAYMENT_PROCESSORS = ['stripe', 'external', 'manual'] as const
export type PaymentProcessor = (typeof PAYMENT_PROCESSORS)[number]

export function parsePaymentProcessor(raw: unknown): PaymentProcessor {
  if (raw === 'external' || raw === 'manual' || raw === 'stripe') return raw
  return 'stripe'
}

export async function resolveOrganizationId(orgKey: string): Promise<string | null> {
  if (UUID_RE.test(orgKey)) return orgKey
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgKey))
    .limit(1)
  return row?.id ?? null
}

/** @deprecated Prefer requireOrgPaymentsManage for Connect / processor settings. */
export async function requireOrgAdmin(
  organizationId: string,
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  return requireOrgPaymentsManage(organizationId, userId, reply)
}

/**
 * Org owner, or a member with `can_manage_payments`.
 * Sensitive: Connect onboarding, processor choice, membership product create.
 */
export async function requireOrgPaymentsManage(
  organizationId: string,
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const access = await resolveOrgPaymentsManageAccess(organizationId, userId)
  if (!access.orgExists) {
    reply.status(404).send({ error: 'Organization not found' })
    return false
  }
  if (!access.canManage) {
    reply.status(403).send({
      error: 'Only the organization owner (or a member granted payment management) can manage payments',
      code: 'payments_manage_forbidden',
    })
    return false
  }
  return true
}

export async function requireOrgOwner(
  organizationId: string,
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const [orgRow] = await db
    .select({ ownerId: schema.organizations.ownerId })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1)
  if (!orgRow) {
    reply.status(404).send({ error: 'Organization not found' })
    return false
  }
  if (orgRow.ownerId !== userId) {
    reply.status(403).send({ error: 'Only the organization owner can do this', code: 'owner_required' })
    return false
  }
  return true
}

export async function resolveOrgPaymentsManageAccess(
  organizationId: string,
  userId: string,
): Promise<{ orgExists: boolean; isOwner: boolean; canManage: boolean }> {
  const [orgRow] = await db
    .select({ ownerId: schema.organizations.ownerId })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1)
  if (!orgRow) return { orgExists: false, isOwner: false, canManage: false }
  if (orgRow.ownerId === userId) return { orgExists: true, isOwner: true, canManage: true }
  const [m] = await db
    .select({ canManagePayments: schema.organizationMembers.canManagePayments })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    )
    .limit(1)
  return {
    orgExists: true,
    isOwner: false,
    canManage: Boolean(m?.canManagePayments),
  }
}

export type OrgStripeRow = {
  id: string
  slug: string
  displayName: string
  ownerId: string
  stripeConnectAccountId: string | null
  stripeConnectChargesEnabled: boolean
  stripeConnectPayoutsEnabled: boolean
  stripeConnectDetailsSubmitted: boolean
  stripeMembershipConfig: unknown
  paymentProcessor: PaymentProcessor
  externalPaymentUrl: string | null
}

export async function loadOrgStripe(orgId: string): Promise<OrgStripeRow | null> {
  const [row] = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
      ownerId: schema.organizations.ownerId,
      stripeConnectAccountId: schema.organizations.stripeConnectAccountId,
      stripeConnectChargesEnabled: schema.organizations.stripeConnectChargesEnabled,
      stripeConnectPayoutsEnabled: schema.organizations.stripeConnectPayoutsEnabled,
      stripeConnectDetailsSubmitted: schema.organizations.stripeConnectDetailsSubmitted,
      stripeMembershipConfig: schema.organizations.stripeMembershipConfig,
      paymentProcessor: schema.organizations.paymentProcessor,
      externalPaymentUrl: schema.organizations.externalPaymentUrl,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)
  if (!row) return null
  return {
    ...row,
    paymentProcessor: parsePaymentProcessor(row.paymentProcessor),
    externalPaymentUrl: row.externalPaymentUrl ?? null,
  }
}

/** Bind / refresh Connect flags for an org we already resolved in Connect onboarding. */
export async function persistStripeAccountFlags(
  orgId: string,
  account: Stripe.Account,
): Promise<void> {
  await db
    .update(schema.organizations)
    .set({
      stripeConnectAccountId: account.id,
      stripeConnectChargesEnabled: Boolean(account.charges_enabled),
      stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
      stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
      stripeConnectUpdatedAt: new Date(),
    })
    .where(eq(schema.organizations.id, orgId))
}

/**
 * Webhook-safe flag sync: only updates rows already bound to this Connect account id.
 * Never establishes a new org↔account binding from Account metadata.
 */
export async function syncOrgStripeFlagsByAccountId(account: Stripe.Account): Promise<void> {
  await db
    .update(schema.organizations)
    .set({
      stripeConnectChargesEnabled: Boolean(account.charges_enabled),
      stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
      stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
      stripeConnectUpdatedAt: new Date(),
    })
    .where(eq(schema.organizations.stripeConnectAccountId, account.id))
}

export function serializeOrgStripeStatus(org: OrgStripeRow) {
  return {
    configured: Boolean(org.stripeConnectAccountId),
    accountId: org.stripeConnectAccountId,
    chargesEnabled: org.stripeConnectChargesEnabled,
    payoutsEnabled: org.stripeConnectPayoutsEnabled,
    detailsSubmitted: org.stripeConnectDetailsSubmitted,
    readyForCheckout: Boolean(org.stripeConnectAccountId && org.stripeConnectChargesEnabled),
    dashboardUrl: org.stripeConnectAccountId
      ? `https://dashboard.stripe.com/${org.stripeConnectAccountId}`
      : null,
  }
}

export function serializeOrgPaymentSettings(org: OrgStripeRow) {
  return {
    processor: org.paymentProcessor,
    externalPaymentUrl: org.externalPaymentUrl,
    stripe: serializeOrgStripeStatus(org),
  }
}
