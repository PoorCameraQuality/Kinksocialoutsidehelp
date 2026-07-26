import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type MarkConversationReadResult =
  | { ok: true; readAt: string }
  | { ok: false; status: number; error: string }

/**
 * Advance the viewer's DM read cursor and clear related in-app notifications.
 * Idempotent — safe to call on every thread open.
 */
export async function markConversationReadForUser(
  userId: string,
  conversationId: string
): Promise<MarkConversationReadResult> {
  const [mem] = await db
    .select({
      deletedAt: schema.conversationParticipants.deletedAt,
    })
    .from(schema.conversationParticipants)
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, conversationId),
        eq(schema.conversationParticipants.userId, userId)
      )
    )
    .limit(1)

  if (!mem || mem.deletedAt != null) {
    return { ok: false, status: 403, error: 'Not a participant' }
  }

  const [last] = await db
    .select({ createdAt: schema.messages.createdAt })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(1)

  const readAt = last?.createdAt ?? new Date()

  await db
    .update(schema.conversationParticipants)
    .set({ lastReadAt: readAt })
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, conversationId),
        eq(schema.conversationParticipants.userId, userId)
      )
    )

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt),
        inArray(schema.notifications.type, ['new_message', 'dm_request']),
        sql`${schema.notifications.payload}->>'conversationId' = ${conversationId}`
      )
    )

  return { ok: true, readAt: readAt.toISOString() }
}
