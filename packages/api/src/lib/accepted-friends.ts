import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** User ids with an ACCEPTED connection to `viewerId` (the other party in each row). */
export async function loadAcceptedFriendUserIds(viewerId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      requesterId: schema.connections.requesterId,
      recipientId: schema.connections.recipientId,
    })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, 'ACCEPTED'),
        or(eq(schema.connections.requesterId, viewerId), eq(schema.connections.recipientId, viewerId))
      )
    )
  const ids = new Set<string>()
  for (const r of rows) {
    ids.add(r.requesterId === viewerId ? r.recipientId : r.requesterId)
  }
  return ids
}
