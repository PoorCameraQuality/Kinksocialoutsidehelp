import { and, desc, eq, gt, inArray, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { deliverAvatarUrl } from './image-delivery.js'

export type ConnectionRsvpPreviewItem = {
  username: string
  avatarUrl: string | null
}

const PREVIEW_LIMIT = 3
const ACTIVE_PROFILE_WITHIN_MS = 365 * 24 * 60 * 60 * 1000

/** Up to 3 accepted connections marked going per event (most recent RSVP first). */
export async function loadConnectionRsvpPreviewByEventIds(
  viewerId: string | null | undefined,
  eventIds: string[]
): Promise<Map<string, ConnectionRsvpPreviewItem[]>> {
  const result = new Map<string, ConnectionRsvpPreviewItem[]>()
  if (!viewerId || eventIds.length === 0) return result

  const connectedUserIds = [...(await loadAcceptedFriendUserIds(viewerId))]
  if (connectedUserIds.length === 0) return result

  const oneYearAgo = new Date(Date.now() - ACTIVE_PROFILE_WITHIN_MS)
  const rows = await db
    .select({
      eventId: schema.eventRsvps.eventId,
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
      updatedAt: schema.eventRsvps.updatedAt,
    })
    .from(schema.eventRsvps)
    .innerJoin(schema.users, eq(schema.eventRsvps.userId, schema.users.id))
    .innerJoin(schema.profiles, eq(schema.eventRsvps.userId, schema.profiles.userId))
    .where(
      and(
        inArray(schema.eventRsvps.eventId, eventIds),
        inArray(schema.eventRsvps.userId, connectedUserIds),
        eq(schema.eventRsvps.status, 'going'),
        or(
          eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
          eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
        ),
        gt(schema.profiles.updatedAt, oneYearAgo)
      )
    )
    .orderBy(desc(schema.eventRsvps.updatedAt))

  for (const row of rows) {
    const list = result.get(row.eventId) ?? []
    if (list.length >= PREVIEW_LIMIT) continue
    if (list.some((item) => item.username === row.username)) continue
    list.push({ username: row.username, avatarUrl: deliverAvatarUrl(row.avatarUrl, 'sm') })
    result.set(row.eventId, list)
  }

  return result
}
