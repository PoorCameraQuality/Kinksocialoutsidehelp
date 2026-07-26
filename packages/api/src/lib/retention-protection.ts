import { and, eq, inArray, sql } from 'drizzle-orm'
import { MODERATION_CASE_STATUSES } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { isUnderLegalHold } from './legal-hold.js'

const ACTIVE_CASE_STATUSES = [
  MODERATION_CASE_STATUSES.open,
  MODERATION_CASE_STATUSES.triaged,
  MODERATION_CASE_STATUSES.escalated,
  MODERATION_CASE_STATUSES.actioned,
] as const

/** True when message content is preserved for an open moderation case (snapshot exists). */
export async function hasActiveCaseSnapshotForMessage(messageId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.contentSnapshots.id })
    .from(schema.contentSnapshots)
    .innerJoin(schema.moderationCases, eq(schema.moderationCases.id, schema.contentSnapshots.caseId))
    .where(
      and(
        eq(schema.contentSnapshots.targetContentType, 'message'),
        eq(schema.contentSnapshots.targetContentId, messageId),
        inArray(schema.moderationCases.status, [...ACTIVE_CASE_STATUSES])
      )
    )
    .limit(1)
  return rows.length > 0
}

/** True when a reported message has any case snapshot (evidence preserved even after case closes). */
export async function hasCaseSnapshotForMessage(messageId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.contentSnapshots.id })
    .from(schema.contentSnapshots)
    .where(
      and(
        eq(schema.contentSnapshots.targetContentType, 'message'),
        eq(schema.contentSnapshots.targetContentId, messageId)
      )
    )
    .limit(1)
  return rows.length > 0
}

export async function isConversationUnderRetentionHold(conversationId: string): Promise<boolean> {
  if (await isUnderLegalHold('message_thread', conversationId)) return true
  const participants = await db
    .select({ userId: schema.conversationParticipants.userId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.conversationId, conversationId))
  for (const p of participants) {
    if (await isUnderLegalHold('user', p.userId)) return true
  }
  return false
}

export async function isMessageProtectedFromRetention(
  messageId: string,
  conversationId: string
): Promise<boolean> {
  if (await isConversationUnderRetentionHold(conversationId)) return true
  if (await hasActiveCaseSnapshotForMessage(messageId)) return true
  return false
}

export function cutoffSql(days: number) {
  return sql`now() - (${days}::int * interval '1 day')`
}
