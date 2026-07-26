import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type ClaimTokenPreview = {
  valid: boolean
  reason?: 'not_found' | 'expired' | 'already_redeemed' | 'already_claimed'
  organization?: {
    slug: string
    displayName: string
    logoUrl: string | null
  }
  expiresAt?: string
}

export async function findClaimToken(token: string) {
  const [row] = await db
    .select()
    .from(schema.organizationClaimTokens)
    .where(eq(schema.organizationClaimTokens.token, token))
    .limit(1)
  return row ?? null
}

export async function previewClaimToken(token: string): Promise<ClaimTokenPreview> {
  const invite = await findClaimToken(token)
  if (!invite) return { valid: false, reason: 'not_found' }

  if (invite.redeemedAt) return { valid: false, reason: 'already_redeemed' }
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'expired' }

  const [org] = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
      logoUrl: schema.organizations.logoUrl,
      ownerId: schema.organizations.ownerId,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, invite.organizationId))
    .limit(1)

  if (!org) return { valid: false, reason: 'not_found' }
  if (org.ownerId !== invite.createdByUserId) {
    return { valid: false, reason: 'already_claimed' }
  }

  return {
    valid: true,
    organization: {
      slug: org.slug,
      displayName: org.displayName,
      logoUrl: org.logoUrl,
    },
    expiresAt: invite.expiresAt.toISOString(),
  }
}

export function mintClaimTokenValue(): string {
  return randomBytes(24).toString('hex')
}

export type RedeemClaimResult =
  | { ok: true; organizationSlug: string; ownerId: string; alreadyOwner: boolean }
  | { ok: false; error: string; status: number }

export async function redeemOrganizationClaimToken(input: {
  token: string
  claimerUserId: string
}): Promise<RedeemClaimResult> {
  const invite = await findClaimToken(input.token)
  if (!invite) return { ok: false, error: 'Invite not found', status: 404 }
  if (invite.redeemedAt) return { ok: false, error: 'Invite already redeemed', status: 409 }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'Invite expired', status: 410 }
  }

  const [org] = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      ownerId: schema.organizations.ownerId,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, invite.organizationId))
    .limit(1)

  if (!org) return { ok: false, error: 'Organization not found', status: 404 }
  if (org.ownerId !== invite.createdByUserId) {
    return { ok: false, error: 'Organization already claimed', status: 409 }
  }

  const oldOwnerId = org.ownerId
  const claimerId = input.claimerUserId

  if (oldOwnerId === claimerId) {
    await db
      .update(schema.organizationClaimTokens)
      .set({ redeemedByUserId: claimerId, redeemedAt: new Date() })
      .where(eq(schema.organizationClaimTokens.id, invite.id))
    return { ok: true, organizationSlug: org.slug, ownerId: claimerId, alreadyOwner: true }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.organizations)
      .set({ ownerId: claimerId })
      .where(eq(schema.organizations.id, org.id))

    const [existingMember] = await tx
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, org.id),
          eq(schema.organizationMembers.userId, claimerId),
        ),
      )
      .limit(1)

    if (existingMember) {
      await tx
        .update(schema.organizationMembers)
        .set({ role: 'OWNER' })
        .where(eq(schema.organizationMembers.id, existingMember.id))
    } else {
      await tx.insert(schema.organizationMembers).values({
        organizationId: org.id,
        userId: claimerId,
        role: 'OWNER',
      })
    }

    await tx
      .delete(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, org.id),
          eq(schema.organizationMembers.userId, oldOwnerId),
        ),
      )

    await tx
      .update(schema.events)
      .set({ hostId: claimerId })
      .where(eq(schema.events.organizationId, org.id))

    await tx
      .update(schema.organizationClaimTokens)
      .set({ redeemedByUserId: claimerId, redeemedAt: new Date() })
      .where(eq(schema.organizationClaimTokens.id, invite.id))
  })

  return { ok: true, organizationSlug: org.slug, ownerId: claimerId, alreadyOwner: false }
}

export function resolveClaimPublicUrl(token: string): string {
  const base = (process.env.C2K_APP_URL?.trim() || process.env.APP_URL?.trim() || 'https://kink.social').replace(
    /\/$/,
    '',
  )
  return `${base}/orgs/claim/${encodeURIComponent(token)}`
}
