import { and, eq, lt, or, isNull, gt } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Expire timed restrictions and trust signals with passed expires_at. */
export async function runTrustDecaySweep(): Promise<{
  expiredScopeBans: number
  expiredMessagingRestrictions: number
  expiredTrustSignals: number
}> {
  const now = new Date()
  let expiredScopeBans = 0
  let expiredMessagingRestrictions = 0
  let expiredTrustSignals = 0

  const expiredBans = await db
    .update(schema.scopeBans)
    .set({ active: false })
    .where(and(eq(schema.scopeBans.active, true), lt(schema.scopeBans.expiresAt, now)))
    .returning({ id: schema.scopeBans.id })
  expiredScopeBans = expiredBans.length

  const expiredMsg = await db
    .update(schema.messagingRestrictions)
    .set({ status: 'EXPIRED' })
    .where(
      and(
        eq(schema.messagingRestrictions.status, 'ACTIVE'),
        lt(schema.messagingRestrictions.expiresAt, now)
      )
    )
    .returning({ id: schema.messagingRestrictions.id })
  expiredMessagingRestrictions = expiredMsg.length

  const expiredSignals = await db
    .update(schema.trustSignalEvents)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(
      and(eq(schema.trustSignalEvents.status, 'ACTIVE'), lt(schema.trustSignalEvents.expiresAt, now))
    )
    .returning({ id: schema.trustSignalEvents.id })
  expiredTrustSignals = expiredSignals.length

  return { expiredScopeBans, expiredMessagingRestrictions, expiredTrustSignals }
}

export async function hasActiveMessagingRestriction(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.messagingRestrictions.id })
    .from(schema.messagingRestrictions)
    .where(
      and(
        eq(schema.messagingRestrictions.userId, userId),
        eq(schema.messagingRestrictions.status, 'ACTIVE'),
        or(isNull(schema.messagingRestrictions.expiresAt), gt(schema.messagingRestrictions.expiresAt, new Date()))
      )
    )
    .limit(1)
  return Boolean(row)
}
