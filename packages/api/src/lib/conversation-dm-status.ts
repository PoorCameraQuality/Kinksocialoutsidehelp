import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type DmRequestStatus = 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted'

export type DmRequestStatusResult = {
  status: DmRequestStatus
  conversationId: string | null
}

/** Pending acceptance state for a 1:1 DM between two users. */
export async function getDmRequestStatusBetween(
  viewerId: string,
  targetId: string,
): Promise<DmRequestStatusResult> {
  const viewerParts = await db
    .select({ conversationId: schema.conversationParticipants.conversationId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, viewerId))

  for (const row of viewerParts) {
    const parts = await db
      .select({
        userId: schema.conversationParticipants.userId,
        acceptanceStatus: schema.conversationParticipants.acceptanceStatus,
      })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, row.conversationId))

    if (parts.length !== 2) continue
    const ids = new Set(parts.map((p) => p.userId))
    if (!ids.has(targetId)) continue

    const [conv] = await db
      .select({ initiatorUserId: schema.conversations.initiatorUserId })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, row.conversationId))
      .limit(1)

    const viewerPart = parts.find((p) => p.userId === viewerId)
    const targetPart = parts.find((p) => p.userId === targetId)
    if (!viewerPart || !targetPart) return { status: 'none', conversationId: null }

    if (viewerPart.acceptanceStatus === 'ACCEPTED' && targetPart.acceptanceStatus === 'ACCEPTED') {
      return { status: 'accepted', conversationId: row.conversationId }
    }
    if (conv?.initiatorUserId === viewerId && targetPart.acceptanceStatus === 'PENDING') {
      return { status: 'pending_outgoing', conversationId: row.conversationId }
    }
    if (conv?.initiatorUserId === targetId && viewerPart.acceptanceStatus === 'PENDING') {
      return { status: 'pending_incoming', conversationId: row.conversationId }
    }
    return { status: 'accepted', conversationId: row.conversationId }
  }

  return { status: 'none', conversationId: null }
}
