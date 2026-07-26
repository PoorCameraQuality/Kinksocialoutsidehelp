import { count, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { isBlockedPair, loadBlockedPairUserIds } from './blocks.js'
import {
  loadPublicProfileConnections,
  resolveProfileConnectionsAccess,
  type ProfileConnectionListItem,
  type ProfileConnectionsAccess,
} from './profile-connections.js'

export const SOCIAL_PREVIEW_LIMIT = 10

export type SocialPersonPreview = {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export type ProfileConnectionsSummaryPayload = ProfileConnectionsAccess & {
  preview: SocialPersonPreview[]
}

export type ProfileFollowsSummaryPayload = {
  followerCount: number
  followingCount: number
  listsVisible: boolean
  followersPreview: SocialPersonPreview[]
  followingPreview: SocialPersonPreview[]
}

export type ProfileSocialSummaryPayload = {
  connections: ProfileConnectionsSummaryPayload
  follows: ProfileFollowsSummaryPayload
  mutualConnections: {
    count: number | null
    preview: SocialPersonPreview[]
  }
}

function toPreview(item: ProfileConnectionListItem): SocialPersonPreview {
  return {
    username: item.username,
    displayName: item.displayName,
    avatarUrl: item.avatarUrl,
  }
}

export async function loadMutualConnectionsPreview(
  userA: string,
  userB: string,
  limit: number,
): Promise<SocialPersonPreview[]> {
  const [aFriends, bFriends] = await Promise.all([
    loadAcceptedFriendUserIds(userA),
    loadAcceptedFriendUserIds(userB),
  ])
  const mutualIds: string[] = []
  for (const id of aFriends) {
    if (bFriends.has(id)) mutualIds.push(id)
    if (mutualIds.length >= limit) break
  }
  if (mutualIds.length === 0) return []

  const users = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.users.id, mutualIds))

  const byId = new Map(users.map((u) => [u.id, u]))
  const preview: SocialPersonPreview[] = []
  for (const id of mutualIds) {
    const u = byId.get(id)
    if (!u) continue
    preview.push({
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
    })
  }
  return preview
}

async function countFollowers(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.userFollows)
    .where(eq(schema.userFollows.followingId, userId))
  return Number(row?.total ?? 0)
}

async function countFollowing(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.userFollows)
    .where(eq(schema.userFollows.followerId, userId))
  return Number(row?.total ?? 0)
}

async function loadFollowPreview(
  userId: string,
  direction: 'followers' | 'following',
  limit: number,
  excludeUserIds: Set<string> = new Set(),
): Promise<SocialPersonPreview[]> {
  const peerColumn =
    direction === 'followers' ? schema.userFollows.followerId : schema.userFollows.followingId
  const anchorCondition =
    direction === 'followers'
      ? eq(schema.userFollows.followingId, userId)
      : eq(schema.userFollows.followerId, userId)
  const rows = await db
    .select({
      peerId: peerColumn,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.userFollows)
    .innerJoin(schema.users, eq(peerColumn, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(anchorCondition)
    .orderBy(desc(schema.userFollows.createdAt))
    .limit(limit + excludeUserIds.size)

  return rows
    .filter((r) => !excludeUserIds.has(r.peerId))
    .slice(0, limit)
    .map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    }))
}

export async function loadPublicProfileFollows(
  targetUserId: string,
  direction: 'followers' | 'following',
  viewerUserId: string | null,
  limit?: number,
): Promise<{ items: SocialPersonPreview[]; totalCount: number; listsVisible: boolean }> {
  const isOwner = viewerUserId !== null && viewerUserId === targetUserId
  // PR 3 (P5): follower/following lists reuse the profile's
  // connectionsListVisibility gate — "authenticated" is not enough.
  const access = await resolveProfileConnectionsAccess(targetUserId, viewerUserId)
  const listsVisible = access.listVisible
  const totalCount =
    direction === 'followers' ?
      await countFollowers(targetUserId)
    : await countFollowing(targetUserId)

  if (!listsVisible) {
    return { items: [], totalCount, listsVisible: false }
  }

  const cap = limit ?? SOCIAL_PREVIEW_LIMIT
  const excludeUserIds =
    viewerUserId && !isOwner ? await loadBlockedPairUserIds(viewerUserId) : new Set<string>()
  const items = await loadFollowPreview(targetUserId, direction, cap, excludeUserIds)
  return { items, totalCount, listsVisible: true }
}

export async function resolveProfileSocialSummary(
  targetUserId: string,
  viewerUserId: string | null,
  connectionsAccess: ProfileConnectionsAccess,
): Promise<ProfileSocialSummaryPayload> {
  const isOwner = viewerUserId !== null && viewerUserId === targetUserId
  let blocked = false
  if (viewerUserId && !isOwner) {
    blocked = await isBlockedPair(viewerUserId, targetUserId)
  }

  const { access, items } = await loadPublicProfileConnections(targetUserId, viewerUserId)
  const connections: ProfileConnectionsSummaryPayload = {
    ...access,
    preview: access.listVisible ? items.slice(0, SOCIAL_PREVIEW_LIMIT).map(toPreview) : [],
  }

  const [followerCount, followingCount] = await Promise.all([
    countFollowers(targetUserId),
    countFollowing(targetUserId),
  ])
  // PR 3 (P5): follow lists/previews follow the same visibility rule as the
  // connections list (connectionsListVisibility), already resolved above.
  const listsVisible = access.listVisible
  const previewExcludeIds =
    viewerUserId && !isOwner ? await loadBlockedPairUserIds(viewerUserId) : new Set<string>()
  const [followersPreview, followingPreview] =
    listsVisible ?
      await Promise.all([
        loadFollowPreview(targetUserId, 'followers', SOCIAL_PREVIEW_LIMIT, previewExcludeIds),
        loadFollowPreview(targetUserId, 'following', SOCIAL_PREVIEW_LIMIT, previewExcludeIds),
      ])
    : [[], []]

  const follows: ProfileFollowsSummaryPayload = {
    followerCount,
    followingCount,
    listsVisible,
    followersPreview,
    followingPreview,
  }

  const mutualCount = connectionsAccess.mutualCount
  let mutualPreview: SocialPersonPreview[] = []
  if (viewerUserId && !isOwner && !blocked && mutualCount != null && mutualCount > 0) {
    mutualPreview = await loadMutualConnectionsPreview(
      viewerUserId,
      targetUserId,
      SOCIAL_PREVIEW_LIMIT,
    )
  }

  return {
    connections,
    follows,
    mutualConnections: {
      count: mutualCount,
      preview: mutualPreview,
    },
  }
}
