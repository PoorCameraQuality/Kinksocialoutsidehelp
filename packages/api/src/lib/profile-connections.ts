import {
  canViewerBrowseConnectionsList,
  canViewerSeeMutualConnectionsCount,
  normalizePrivacySettings,
  type ConnectionsListVisibility,
} from '@c2k/shared'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { isBlockedPair, loadBlockedPairUserIds } from './blocks.js'
import { isPlatformModeratorUser } from './platform-staff.js'

export type ProfileConnectionListItem = {
  username: string
  displayName: string | null
  avatarUrl: string | null
  connectedAt: string
}

export type ProfileConnectionsSummary = {
  totalCount: number
  mutualCount: number | null
  listVisible: boolean
}

export type ProfileConnectionsAccess = ProfileConnectionsSummary & {
  visibility: ConnectionsListVisibility
  isOwner: boolean
}

async function loadTargetPrivacySettings(userId: string) {
  const [row] = await db
    .select({ privacySettings: schema.userSettings.privacySettings })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1)
  return normalizePrivacySettings(row?.privacySettings)
}

async function loadAcceptedConnectionRows(userId: string) {
  return db
    .select({
      requesterId: schema.connections.requesterId,
      recipientId: schema.connections.recipientId,
      createdAt: schema.connections.createdAt,
    })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, 'ACCEPTED'),
        or(eq(schema.connections.requesterId, userId), eq(schema.connections.recipientId, userId)),
      ),
    )
    .orderBy(desc(schema.connections.createdAt))
}

function otherPartyUserId(
  row: { requesterId: string; recipientId: string },
  userId: string,
): string {
  return row.requesterId === userId ? row.recipientId : row.requesterId
}

export async function countAcceptedConnections(userId: string): Promise<number> {
  const rows = await loadAcceptedConnectionRows(userId)
  return rows.length
}

export async function countMutualAcceptedConnections(
  userA: string,
  userB: string,
): Promise<number> {
  const [aFriends, bFriends] = await Promise.all([
    loadAcceptedFriendUserIds(userA),
    loadAcceptedFriendUserIds(userB),
  ])
  let mutual = 0
  for (const id of aFriends) {
    if (bFriends.has(id)) mutual += 1
  }
  return mutual
}

export async function resolveProfileConnectionsAccess(
  targetUserId: string,
  viewerUserId: string | null,
): Promise<ProfileConnectionsAccess> {
  const privacy = await loadTargetPrivacySettings(targetUserId)
  const visibility = privacy.connectionsListVisibility
  const isOwner = viewerUserId !== null && viewerUserId === targetUserId
  const isModerator =
    viewerUserId !== null && (await isPlatformModeratorUser(viewerUserId))
  const isAuthenticated = viewerUserId !== null

  let isConnected = false
  if (viewerUserId && !isOwner) {
    const viewerFriends = await loadAcceptedFriendUserIds(viewerUserId)
    isConnected = viewerFriends.has(targetUserId)
  }

  let blocked = false
  if (viewerUserId && !isOwner) {
    blocked = await isBlockedPair(viewerUserId, targetUserId)
  }

  const ctx = { isOwner, isAuthenticated, isConnected, isModerator }
  const listVisible = !blocked && canViewerBrowseConnectionsList(visibility, ctx)
  const totalCount = await countAcceptedConnections(targetUserId)

  let mutualCount: number | null = null
  if (
    viewerUserId &&
    !isOwner &&
    !blocked &&
    canViewerSeeMutualConnectionsCount(visibility, ctx)
  ) {
    mutualCount = await countMutualAcceptedConnections(viewerUserId, targetUserId)
  }

  return { totalCount, mutualCount, listVisible, visibility, isOwner }
}

export async function loadPublicProfileConnections(
  targetUserId: string,
  viewerUserId: string | null,
): Promise<{ access: ProfileConnectionsAccess; items: ProfileConnectionListItem[] }> {
  const access = await resolveProfileConnectionsAccess(targetUserId, viewerUserId)
  if (!access.listVisible) {
    return { access, items: [] }
  }

  const rows = await loadAcceptedConnectionRows(targetUserId)
  const otherIds = rows.map((row) => otherPartyUserId(row, targetUserId))
  if (otherIds.length === 0) {
    return { access, items: [] }
  }

  const users = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.users.id, otherIds))

  const byId = new Map(users.map((u) => [u.id, u]))
  const items: ProfileConnectionListItem[] = []

  // PR 3 (P6): listed peers the VIEWER is in a block pair with are omitted,
  // in addition to peers the profile owner has block relationships with.
  const viewerBlockedPairIds =
    viewerUserId && viewerUserId !== targetUserId
      ? await loadBlockedPairUserIds(viewerUserId)
      : new Set<string>()

  for (const row of rows) {
    const otherId = otherPartyUserId(row, targetUserId)
    if (await isBlockedPair(targetUserId, otherId)) continue
    if (viewerBlockedPairIds.has(otherId)) continue
    const u = byId.get(otherId)
    if (!u) continue
    items.push({
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      connectedAt: row.createdAt.toISOString(),
    })
  }

  return { access, items }
}
