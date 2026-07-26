import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { loadFollowingUserIds } from './follows.js'

export const MAX_FOLLOWING_IDS = 2000

/**
 * Audience for post visibility checks: self + one-way follows + accepted connections.
 * Includes the viewer so own posts remain readable under connection-scoped privacy.
 */
export async function followingIds(viewerId: string): Promise<string[]> {
  const audience = await followingFeedAudienceIds(viewerId)
  const merged = new Set<string>([viewerId, ...audience])
  const ids = [...merged]
  if (ids.length > MAX_FOLLOWING_IDS) {
    console.warn(`[following] truncating ${ids.length} ids to ${MAX_FOLLOWING_IDS}`)
    return ids.slice(0, MAX_FOLLOWING_IDS)
  }
  return ids
}

/**
 * Following-tab audience (FetLife-style): people you follow + accepted connections,
 * never the viewer. Own posts/activity belong on profile / My Posts, not Following.
 */
export async function followingFeedAudienceIds(viewerId: string): Promise<string[]> {
  const [friends, follows] = await Promise.all([
    loadAcceptedFriendUserIds(viewerId),
    loadFollowingUserIds(viewerId),
  ])
  const merged = new Set<string>([...friends, ...follows])
  merged.delete(viewerId)
  const ids = [...merged]
  if (ids.length > MAX_FOLLOWING_IDS) {
    console.warn(`[following-feed] truncating ${ids.length} ids to ${MAX_FOLLOWING_IDS}`)
    return ids.slice(0, MAX_FOLLOWING_IDS)
  }
  return ids
}
