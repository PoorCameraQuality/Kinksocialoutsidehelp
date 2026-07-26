import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { loadBlockedPairUserIds } from './blocks.js'
import { loadFollowerUserIds, loadFollowingUserIds } from './follows.js'
import {
  conversationIncludedInFolder,
  isIsoInboxThreadForViewer,
} from './iso-access.js'

export type InboxListParams = {
  userId: string
  folder: 'main' | 'requests' | 'iso'
  filter?: 'all' | 'unread' | 'friends' | 'followers' | 'following' | 'favorites'
  sort?: 'newest' | 'oldest'
  q?: string
}

export type InboxListItem = {
  id: string
  title: string
  partnerUsername: string | null
  partnerAvatarUrl: string | null
  lastMessageBody: string | null
  lastMessageAt: string | null
  unreadCount: number
  folder: 'main' | 'requests' | 'iso'
  isFavorite: boolean
  isPinned: boolean
  awaitingPartnerAcceptance: boolean
}

export async function listConversationsForInbox(params: InboxListParams): Promise<InboxListItem[]> {
  const { userId, folder } = params
  const filter = params.filter ?? 'all'
  const sort = params.sort === 'oldest' ? 'oldest' : 'newest'
  const searchQ = params.q?.trim().toLowerCase() ?? ''

  const needsFriends = filter === 'friends'
  const needsFollowing = filter === 'following'
  const needsFollowers = filter === 'followers'
  const [friends, following, followers, blockedPairIds] = await Promise.all([
    needsFriends ? loadAcceptedFriendUserIds(userId) : Promise.resolve(new Set<string>()),
    needsFollowing ? loadFollowingUserIds(userId) : Promise.resolve(new Set<string>()),
    needsFollowers ? loadFollowerUserIds(userId) : Promise.resolve(new Set<string>()),
    loadBlockedPairUserIds(userId),
  ])

  const parts = await db
    .select()
    .from(schema.conversationParticipants)
    .where(
      and(
        eq(schema.conversationParticipants.userId, userId),
        isNull(schema.conversationParticipants.deletedAt)
      )
    )
  const convIds = [...new Set(parts.map((p) => p.conversationId))]
  const partByConv = new Map(parts.map((p) => [p.conversationId, p]))

  const items: InboxListItem[] = []

  for (const convId of convIds) {
    const myPart = partByConv.get(convId)
    if (!myPart) continue

    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).limit(1)
    const participants = await db
      .select({
        userId: schema.conversationParticipants.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        acceptanceStatus: schema.conversationParticipants.acceptanceStatus,
      })
      .from(schema.conversationParticipants)
      .innerJoin(schema.users, eq(schema.conversationParticipants.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conversationParticipants.conversationId, convId))

    const isRequest =
      myPart.acceptanceStatus === 'PENDING' &&
      conv?.initiatorUserId != null &&
      conv.initiatorUserId !== userId
    const isIsoThread = isIsoInboxThreadForViewer(conv?.dmEntryPoint, conv?.isoSubjectUserId, userId)
    if (!conversationIncludedInFolder(folder, { isPendingIncomingDmRequest: isRequest, isIsoInboxForViewer: isIsoThread })) {
      continue
    }

    const others = participants.filter((p) => p.userId !== userId)
    // PR 3 (P3): omit 1:1 threads with a blocked partner (either direction).
    // The thread (and its history) stays in the DB; it simply is not listed.
    if (others.length === 1 && blockedPairIds.has(others[0]!.userId)) {
      continue
    }
    const title =
      others.length === 1 ?
        others[0]!.displayName || others[0]!.username
      : others.map((o) => o.displayName || o.username).join(', ') || 'Conversation'

    const [last] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, convId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1)

    let unreadCount = 0
    if (last && last.senderId !== userId) {
      const lastRead = myPart.lastReadAt
      if (!lastRead || last.createdAt > lastRead) unreadCount = 1
    }

    if (filter === 'unread' && unreadCount === 0) continue
    if (filter === 'favorites' && !myPart.isFavorite) continue
    if (filter === 'friends') {
      const otherIds = others.map((o) => o.userId)
      if (!otherIds.some((id) => friends.has(id))) continue
    }
    if (filter === 'following') {
      const otherIds = others.map((o) => o.userId)
      if (!otherIds.some((id) => following.has(id))) continue
    }
    if (filter === 'followers') {
      const otherIds = others.map((o) => o.userId)
      if (!otherIds.some((id) => followers.has(id))) continue
    }

    if (searchQ) {
      const titleMatch = title.toLowerCase().includes(searchQ)
      const userMatch = others.some((o) => o.username.toLowerCase().includes(searchQ))
      const bodyMatch = (last?.body ?? '').toLowerCase().includes(searchQ)
      if (!titleMatch && !userMatch && !bodyMatch) continue
    }

    const primaryOther = others[0]
    const awaitingPartnerAcceptance =
      conv?.initiatorUserId === userId &&
      others.some((o) => o.acceptanceStatus === 'PENDING')
    items.push({
      id: convId,
      title,
      partnerUsername: primaryOther?.username ?? null,
      partnerAvatarUrl: primaryOther?.avatarUrl ?? null,
      lastMessageBody: last?.body
        ? last.bodyFormat === 'html'
          ? last.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
          : last.body
        : null,
      lastMessageAt: last?.createdAt?.toISOString() ?? null,
      unreadCount,
      folder: isIsoThread ? 'iso' : isRequest ? 'requests' : 'main',
      isFavorite: myPart.isFavorite,
      isPinned: Boolean(myPart.pinnedAt),
      awaitingPartnerAcceptance,
    })
  }

  items.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return sort === 'oldest' ? ta - tb : tb - ta
  })

  return items
}
