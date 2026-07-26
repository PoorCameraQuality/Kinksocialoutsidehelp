import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'

export type ConnectionLikerPreviewItem = {
  username: string
  avatarUrl: string | null
}

const PREVIEW_LIMIT = 3
const ACTIVE_PROFILE_WITHIN_MS = 365 * 24 * 60 * 60 * 1000

/** Up to 3 accepted connections who liked each post (most recent like first). */
export async function loadConnectionLikerPreviewByPostIds(
  viewerId: string | null | undefined,
  postIds: string[]
): Promise<Map<string, ConnectionLikerPreviewItem[]>> {
  const result = new Map<string, ConnectionLikerPreviewItem[]>()
  if (!viewerId || postIds.length === 0) return result

  const connectedUserIds = [...(await loadAcceptedFriendUserIds(viewerId))]
  if (connectedUserIds.length === 0) return result

  const oneYearAgo = new Date(Date.now() - ACTIVE_PROFILE_WITHIN_MS)
  const rows = await db
    .select({
      postId: schema.postLikes.postId,
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
      createdAt: schema.postLikes.createdAt,
    })
    .from(schema.postLikes)
    .innerJoin(schema.users, eq(schema.postLikes.userId, schema.users.id))
    .innerJoin(schema.profiles, eq(schema.postLikes.userId, schema.profiles.userId))
    .where(
      and(
        inArray(schema.postLikes.postId, postIds),
        inArray(schema.postLikes.userId, connectedUserIds),
        gt(schema.profiles.updatedAt, oneYearAgo)
      )
    )
    .orderBy(desc(schema.postLikes.createdAt))

  for (const row of rows) {
    const list = result.get(row.postId) ?? []
    if (list.length >= PREVIEW_LIMIT) continue
    if (list.some((item) => item.username === row.username)) continue
    list.push({ username: row.username, avatarUrl: row.avatarUrl })
    result.set(row.postId, list)
  }

  return result
}
