import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'
import { listConversationsForInbox } from './conversations-inbox.js'
import { filterNotificationsForViewer } from './notification-privacy.js'

export type ActivityInboxKind = 'notification' | 'message' | 'connection_request' | 'feed'

export type ActivityInboxItem = {
  id: string
  kind: ActivityInboxKind
  title: string
  body: string | null
  href: string
  unread: boolean
  createdAt: string
}

function notificationToInbox(row: {
  id: string
  type: string
  payload: unknown
  readAt: Date | null
  createdAt: Date
}): ActivityInboxItem | null {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  const createdAt = row.createdAt.toISOString()
  const unread = !row.readAt

  if (row.type === 'connection_request') {
    const from = typeof payload.requesterUsername === 'string' ? payload.requesterUsername : 'Someone'
    return {
      id: `notif-${row.id}`,
      kind: 'notification',
      title: 'Connection request',
      body: `@${from} sent you a connection request.`,
      href: '/connections?tab=requests',
      unread,
      createdAt,
    }
  }
  if (row.type === 'connection_accepted') {
    const from = typeof payload.accepterUsername === 'string' ? payload.accepterUsername : 'Someone'
    return {
      id: `notif-${row.id}`,
      kind: 'notification',
      title: 'Connection accepted',
      body: `@${from} accepted your connection request.`,
      href: `/profile/${encodeURIComponent(from)}`,
      unread,
      createdAt,
    }
  }
  if (row.type === 'dm_request') {
    const from =
      typeof payload.senderUsername === 'string' ? payload.senderUsername
      : 'Someone'
    const convId = typeof payload.conversationId === 'string' ? payload.conversationId : ''
    const displayName = from === 'Someone' ? 'Someone' : `@${from}`
    return {
      id: `notif-${row.id}`,
      kind: 'notification',
      title: 'Message request',
      body: `${displayName} sent you a message request.`,
      href: convId ? `/messaging?folder=requests&c=${encodeURIComponent(convId)}` : '/messaging?folder=requests',
      unread,
      createdAt,
    }
  }
  if (row.type === 'new_message') {
    const from = typeof payload.senderUsername === 'string' ? payload.senderUsername : 'Someone'
    const preview = typeof payload.bodyPreview === 'string' ? payload.bodyPreview : ''
    const convId = typeof payload.conversationId === 'string' ? payload.conversationId : ''
    return {
      id: `notif-${row.id}`,
      kind: 'message',
      title: `Message from @${from}`,
      body: preview || null,
      href: convId ? `/messaging?c=${encodeURIComponent(convId)}` : '/messaging',
      unread,
      createdAt,
    }
  }

  return {
    id: `notif-${row.id}`,
    kind: 'notification',
    title: row.type.replace(/_/g, ' '),
    body: null,
    href: '/notifications',
    unread,
    createdAt,
  }
}

export async function listActivityInbox(params: {
  userId: string
  limit?: number
  filter?: 'all' | 'messages' | 'social' | 'notifications' | 'requests'
}): Promise<{ items: ActivityInboxItem[] }> {
  const limit = Math.min(80, Math.max(1, params.limit ?? 50))
  const filterRaw = params.filter ?? 'all'
  const filter = filterRaw === 'notifications' ? 'social' : filterRaw

  const items: ActivityInboxItem[] = []

  if (filter === 'all' || filter === 'social' || filter === 'requests') {
    const notifRows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, params.userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(40)

    const visibleRows = await filterNotificationsForViewer(params.userId, notifRows)

    for (const row of visibleRows) {
      const mapped = notificationToInbox(row)
      if (!mapped) continue
      if (filter === 'requests' && !mapped.href.includes('requests')) continue
      if (filter === 'social' && mapped.kind === 'message') continue
      items.push(mapped)
    }
  }

  if (filter === 'all' || filter === 'requests') {
    const blocked = new Set([
      ...(await loadBlockedUserIds(params.userId)),
      ...(await loadUserIdsWhoBlockedUser(params.userId)),
    ])
    const pending = await db
      .select({
        id: schema.connections.id,
        requesterId: schema.connections.requesterId,
        createdAt: schema.connections.createdAt,
      })
      .from(schema.connections)
      .where(
        and(eq(schema.connections.recipientId, params.userId), eq(schema.connections.status, 'PENDING')),
      )
      .orderBy(desc(schema.connections.createdAt))
      .limit(20)

    const requesterIds = [...new Set(pending.map((p) => p.requesterId))]
    const users =
      requesterIds.length > 0 ?
        await db
          .select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users)
          .where(inArray(schema.users.id, requesterIds))
      : []
    const names = new Map(users.map((u) => [u.id, u.username]))

    for (const p of pending) {
      if (blocked.has(p.requesterId)) continue
      const uname = names.get(p.requesterId) ?? 'someone'
      items.push({
        id: `conn-${p.id}`,
        kind: 'connection_request',
        title: 'Connection request',
        body: `@${uname} sent you a connection request.`,
        href: '/connections?tab=requests',
        unread: true,
        createdAt: p.createdAt.toISOString(),
      })
    }
  }

  if (filter === 'all' || filter === 'messages') {
    const convs = await listConversationsForInbox({
      userId: params.userId,
      folder: 'main',
      filter: 'all',
      sort: 'newest',
    })
    for (const c of convs.slice(0, 25)) {
      if (!c.lastMessageAt) continue
      items.push({
        id: `conv-${c.id}`,
        kind: 'message',
        title: c.title,
        body: c.lastMessageBody,
        href: `/messaging?c=${encodeURIComponent(c.id)}`,
        unread: c.unreadCount > 0,
        createdAt: c.lastMessageAt,
      })
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const seen = new Set<string>()
  const deduped: ActivityInboxItem[] = []
  for (const item of items) {
    const key = `${item.kind}:${item.href}:${item.title}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
    if (deduped.length >= limit) break
  }

  return { items: deduped }
}
