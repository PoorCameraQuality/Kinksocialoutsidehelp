import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type LegalHoldTargetType =
  | 'user'
  | 'account'
  | 'message_thread'
  | 'media'
  | 'event'
  | 'organization'
  | 'report'
  | 'other'

/** Returns true when an active legal hold covers the target (blocks scheduled deletion). */
export async function isUnderLegalHold(
  targetType: LegalHoldTargetType,
  targetId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.legalHolds.id })
    .from(schema.legalHolds)
    .where(
      and(
        eq(schema.legalHolds.targetType, targetType),
        eq(schema.legalHolds.targetId, targetId),
        eq(schema.legalHolds.active, true)
      )
    )
    .limit(1)
  if (!row) return false
  return true
}
