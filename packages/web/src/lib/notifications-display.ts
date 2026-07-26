import type { MockNotification } from '../data/types.ts'
import { shortTime } from './format-time.ts'

export const READ_IDS_KEY = 'c2k_notifications_read_ids_v1'

export function loadReadIdsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(READ_IDS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveReadIdsToStorage(ids: Set<string>) {
  try {
    sessionStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

export type ApiNotificationRow = {
  id: string
  type: string
  payload: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

/** Local calendar day key `YYYY-MM-DD` for grouping. */
export function localDayKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function localDayKeyFromIso(iso: string): string {
  return localDayKeyFromDate(new Date(iso))
}

/** Section title for a calendar day (Today / Yesterday / formatted date). */
export function notificationDayHeading(dayKeyLocal: string): string {
  const today = localDayKeyFromDate(new Date())
  const yd = new Date()
  yd.setDate(yd.getDate() - 1)
  const yesterday = localDayKeyFromDate(yd)
  if (dayKeyLocal === today) return 'Today'
  if (dayKeyLocal === yesterday) return 'Yesterday'
  const [yy, mm, dd] = dayKeyLocal.split('-').map(Number)
  const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function notificationActorFromPayload(
  type: string,
  payload: Record<string, unknown>,
): Pick<MockNotification, 'actorUsername' | 'actorAvatarUrl'> {
  void type
  const usernameKeys = ['senderUsername', 'requesterUsername', 'accepterUsername', 'partnerUsername'] as const
  for (const key of usernameKeys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      const avatarKey =
        key === 'senderUsername' ? 'senderAvatarUrl'
        : key === 'requesterUsername' ? 'requesterAvatarUrl'
        : key === 'accepterUsername' ? 'accepterAvatarUrl'
        : 'partnerAvatarUrl'
      const avatarRaw = payload[avatarKey]
      return {
        actorUsername: value.trim(),
        actorAvatarUrl: typeof avatarRaw === 'string' ? avatarRaw : null,
      }
    }
  }
  return {}
}

export function mapApiToDisplay(row: ApiNotificationRow): MockNotification {
  const actor = notificationActorFromPayload(row.type, row.payload ?? {})
  return { ...mapApiToDisplayRow(row), ...actor }
}

function mapApiToDisplayRow(row: ApiNotificationRow): MockNotification {
  const payload = row.payload ?? {}
  const createdAtIso = row.createdAt
  if (row.type === 'connection_request') {
    const from =
      typeof payload.requesterUsername === 'string' ? payload.requesterUsername : 'Someone'
    return {
      id: row.id,
      kind: 'system',
      title: 'Connection request',
      body: `@${from} sent you a connection request.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/connections?tab=requests',
    }
  }
  if (row.type === 'connection_accepted') {
    const from = typeof payload.accepterUsername === 'string' ? payload.accepterUsername : 'Someone'
    return {
      id: row.id,
      kind: 'system',
      title: 'Connection accepted',
      body: `@${from} accepted your connection request.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: `/profile/${encodeURIComponent(from)}`,
    }
  }
  if (row.type === 'profile_relationship_request') {
    const from =
      typeof payload.requesterUsername === 'string' ? payload.requesterUsername : 'Someone'
    const label = typeof payload.label === 'string' ? payload.label : 'a relationship'
    return {
      id: row.id,
      kind: 'mention',
      title: 'Profile relationship request',
      body: `@${from} wants to list you as “${label}”.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/profile/edit/relationships',
    }
  }
  if (row.type === 'profile_relationship_accepted') {
    const from = typeof payload.partnerUsername === 'string' ? payload.partnerUsername : 'Someone'
    const label = typeof payload.label === 'string' ? payload.label : 'your link'
    return {
      id: row.id,
      kind: 'mention',
      title: 'Relationship link accepted',
      body: `@${from} accepted your profile link (${label}).`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/profile/edit/relationships',
    }
  }
  if (row.type === 'profile_relationship_declined') {
    const from = typeof payload.partnerUsername === 'string' ? payload.partnerUsername : 'Someone'
    const label = typeof payload.label === 'string' ? payload.label : 'your link'
    return {
      id: row.id,
      kind: 'mention',
      title: 'Relationship link declined',
      body: `@${from} declined your profile link (${label}).`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/profile/edit/relationships',
    }
  }
  if (row.type === 'dm_request') {
    const convId = typeof payload.conversationId === 'string' ? payload.conversationId.trim() : ''
    const from =
      typeof payload.senderUsername === 'string' ? payload.senderUsername
      : 'Someone'
    const displayName = from === 'Someone' ? 'Someone' : `@${from}`
    return {
      id: row.id,
      kind: 'mention',
      title: 'Message request',
      body: `${displayName} sent you a message request.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: convId ? `/messaging?folder=requests&c=${encodeURIComponent(convId)}` : '/messaging?folder=requests',
    }
  }
  if (row.type === 'org_announcement') {
    const preview = typeof payload.preview === 'string' ? payload.preview : 'New announcement in your org'
    return {
      id: row.id,
      kind: 'group',
      title: 'Org announcement',
      body: preview,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/home',
    }
  }
  if (row.type === 'group_owner_inactive' || row.type === 'group_idle_warning' || row.type === 'group_disbanded_idle') {
    const name = typeof payload.groupName === 'string' ? payload.groupName : 'Your group'
    const groupId = typeof payload.groupId === 'string' ? payload.groupId : ''
    const titles: Record<string, string> = {
      group_owner_inactive: 'Group leadership needed',
      group_idle_warning: 'Group inactivity warning',
      group_disbanded_idle: 'Group disbanded',
    }
    return {
      id: row.id,
      kind: 'group',
      title: titles[row.type] ?? 'Group update',
      body: name,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: groupId ? `/groups/${encodeURIComponent(groupId)}` : '/groups',
    }
  }
  if (row.type === 'dancecard_booking_requested') {
    const slug = typeof payload.conventionSlug === 'string' ? payload.conventionSlug : ''
    return {
      id: row.id,
      kind: 'event',
      title: 'Scene booking request',
      body: 'Someone requested time on your dancecard.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: slug ? `/conventions/${encodeURIComponent(slug)}?tab=Dancecard` : '/events',
    }
  }
  if (row.type === 'dancecard_booking_accepted') {
    const slug = typeof payload.conventionSlug === 'string' ? payload.conventionSlug : ''
    return {
      id: row.id,
      kind: 'event',
      title: 'Booking accepted',
      body: 'Your scene booking was accepted.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: slug ? `/conventions/${encodeURIComponent(slug)}?tab=Dancecard` : '/events',
    }
  }
  if (row.type === 'dancecard_booking_declined' || row.type === 'dancecard_scene_cancelled') {
    return {
      id: row.id,
      kind: 'event',
      title: row.type === 'dancecard_booking_declined' ? 'Booking declined' : 'Scene cancelled',
      body: 'Check your dancecard for details.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/events',
    }
  }
  if (row.type === 'schedule_conflict_detected') {
    return {
      id: row.id,
      kind: 'event',
      title: 'Schedule conflict',
      body: 'A slot overlaps with another entry on your calendar.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
    }
  }
  if (row.type === 'new_message') {
    const who = typeof payload.senderUsername === 'string' ? payload.senderUsername : 'Someone'
    const preview = typeof payload.bodyPreview === 'string' ? payload.bodyPreview : ''
    const convId = typeof payload.conversationId === 'string' ? payload.conversationId.trim() : ''
    const href = convId ? `/messaging?c=${encodeURIComponent(convId)}` : '/messaging'
    return {
      id: row.id,
      kind: 'mention',
      title: 'New message',
      body: preview ? `${who}: ${preview}` : `@${who} sent you a message.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href,
    }
  }
  if (row.type === 'event_rsvp_confirmed_virtual') {
    const title = typeof payload.title === 'string' ? payload.title : 'Virtual event'
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
    return {
      id: row.id,
      kind: 'rsvp',
      title: "You're on the list",
      body: `${title}. Open the event page for the join link when it's time.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: eventId ? `/events/${encodeURIComponent(eventId)}` : '/events',
    }
  }
  if (row.type === 'event_virtual_reminder_24h') {
    const title = typeof payload.title === 'string' ? payload.title : 'Virtual event'
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
    return {
      id: row.id,
      kind: 'event',
      title: 'Starting in about 24 hours',
      body: title,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: eventId ? `/events/${encodeURIComponent(eventId)}` : '/events',
    }
  }
  if (row.type === 'convention_staff_assignment_updated') {
    const name = typeof payload.conventionName === 'string' ? payload.conventionName : 'A convention'
    const slug = typeof payload.conventionSlug === 'string' ? payload.conventionSlug : ''
    return {
      id: row.id,
      kind: 'event',
      title: 'Schedule / staff update',
      body: `${name}. Your runner-assigned duties or staff roster changed.`,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: slug ? `/conventions/${encodeURIComponent(slug)}` : '/events',
    }
  }
  if (row.type === 'event_virtual_reminder_1h') {
    const title = typeof payload.title === 'string' ? payload.title : 'Virtual event'
    const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
    return {
      id: row.id,
      kind: 'event',
      title: 'Starting soon',
      body: title,
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: eventId ? `/events/${encodeURIComponent(eventId)}` : '/events',
    }
  }
  if (row.type === 'org_moderation_needed') {
    return {
      id: row.id,
      kind: 'system',
      title: 'Organization report needs review',
      body: 'A member report was filed in your organization. Open your moderation inbox to review it.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/settings/trust',
    }
  }
  if (row.type === 'moderation_report_escalated') {
    return {
      id: row.id,
      kind: 'system',
      title: 'Report escalated',
      body: 'A community report was escalated for moderator review.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/moderation/cases?tab=legacy-reports',
    }
  }
  if (row.type === 'moderation_action_pending') {
    return {
      id: row.id,
      kind: 'system',
      title: 'Moderation action pending',
      body: 'Another moderator submitted an action that needs a second review.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/moderation/cases?tab=pending-actions',
    }
  }
  if (row.type === 'p0_moderation_case_created') {
    return {
      id: row.id,
      kind: 'system',
      title: 'Urgent moderation case',
      body: 'A high-priority safety case was opened and needs attention.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/moderation/cases?tab=open',
    }
  }
  if (row.type === 'report_reviewed') {
    return {
      id: row.id,
      kind: 'system',
      title: 'Report update',
      body: 'Your report was reviewed. Check your trust settings for the outcome.',
      timeAgo: shortTime(row.createdAt),
      createdAtIso,
      read: !!row.readAt,
      href: '/settings/trust',
    }
  }
  return {
    id: row.id,
    kind: 'system',
    title: 'Account update',
    body: 'Open your notifications settings if you need to adjust alerts.',
    timeAgo: shortTime(row.createdAt),
    createdAtIso,
    read: !!row.readAt,
  }
}

export function kindLabel(kind: MockNotification['kind'], title?: string): string {
  const t = title?.toLowerCase() ?? ''
  if (t.includes('connection request') || t.includes('message request')) return 'Request'
  if (t.includes('connection accepted')) return 'Connection'
  switch (kind) {
    case 'event':
      return 'Event'
    case 'group':
      return 'Group'
    case 'mention':
      return 'Message'
    case 'rsvp':
      return 'RSVP'
    default:
      return 'Update'
  }
}

/** Short CTA label for notification rows with a destination href. */
export function notificationActionLabel(n: MockNotification): string | null {
  if (!n.href) return null
  const title = n.title.toLowerCase()
  if (title.includes('connection request') || title.includes('message request')) return 'Review request'
  if (title.includes('connection accepted')) return 'View profile'
  if (title.includes('report') && title.includes('review')) return 'Review report'
  if (title.includes('moderation') || title.includes('escalated') || title.includes('urgent')) {
    return 'Open moderation'
  }
  if (title.includes('new message') || title.includes('message from')) return 'Open message'
  if (title.includes('message') || n.kind === 'mention') return 'Open message'
  if (n.kind === 'event' || n.kind === 'rsvp') return 'View event'
  if (n.kind === 'group') return 'View group'
  return 'Open'
}
