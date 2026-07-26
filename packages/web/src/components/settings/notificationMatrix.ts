import type { NotificationChannelPair, NotificationSettings } from '@c2k/shared'

type SectionKey = Exclude<keyof NotificationSettings, 'schemaVersion' | 'groupOverrides'>

export type NotificationMatrixRow = {
  id: string
  label: string
  hint?: string
  pushNA?: boolean
  emailNA?: boolean
  section: SectionKey
  field: string
}

export type NotificationMatrixSection = {
  id: string
  eyebrow: string
  title: string
  description?: string
  rows: NotificationMatrixRow[]
}

export const NOTIFICATION_MATRIX_SECTIONS: NotificationMatrixSection[] = [
  {
    id: 'inbox',
    eyebrow: 'Inbox',
    title: 'Messages',
    description: 'Direct messages and requests from members you have not connected with yet.',
    rows: [
      { id: 'dm', label: 'Private messages', section: 'inbox', field: 'directMessages' },
      { id: 'dm-req', label: 'Message requests', section: 'inbox', field: 'messageRequests' },
    ],
  },
  {
    id: 'connections',
    eyebrow: 'Connections',
    title: 'Friends & follows',
    rows: [
      { id: 'conn-req', label: 'You get a new connection request', section: 'connections', field: 'incomingRequests' },
      { id: 'conn-acc', label: 'A connection request of yours is accepted', section: 'connections', field: 'requestAccepted' },
    ],
  },
  {
    id: 'relationships',
    eyebrow: 'Profile',
    title: 'Relationships',
    rows: [
      {
        id: 'rel-req',
        label: 'Partner link requests',
        hint: 'When a connection wants to display a relationship on their profile with you.',
        section: 'relationships',
        field: 'partnerRequests',
      },
      { id: 'rel-acc', label: 'Partner link accepted', section: 'relationships', field: 'partnerAccepted' },
    ],
  },
  {
    id: 'events',
    eyebrow: 'Events',
    title: 'Events & RSVPs',
    description: 'Local events, conventions you pin, and organizer broadcasts.',
    rows: [
      { id: 'ev-rem', label: 'Upcoming event reminders', section: 'events', field: 'reminders' },
      { id: 'ev-org', label: 'Organizer updates for events you are registered for', section: 'events', field: 'organizerUpdates' },
      { id: 'ev-inv', label: 'Someone invited you to an event', section: 'events', field: 'invitations' },
      { id: 'ev-rsvp', label: 'Someone RSVPs to an event you organize', section: 'events', field: 'rsvpOnMyEvents' },
      { id: 'ev-cancel', label: 'An event you RSVP’d to is canceled', pushNA: true, section: 'events', field: 'canceled' },
    ],
  },
  {
    id: 'groups',
    eyebrow: 'Groups',
    title: 'Groups & forums',
    rows: [
      { id: 'grp-men', label: 'You are mentioned in a group forum', section: 'groups', field: 'forumMentions' },
      { id: 'grp-inv', label: 'Someone invited you to join a group', section: 'groups', field: 'invitations' },
      { id: 'grp-new', label: 'New discussion in a group you follow', section: 'groups', field: 'newDiscussions' },
    ],
  },
  {
    id: 'conventions',
    eyebrow: 'Conventions',
    title: 'Pinned convention hubs',
    description: 'Web push for conventions you pin to your home screen (requires browser permission).',
    rows: [
      { id: 'pin-ann', label: 'Hub announcements', emailNA: true, section: 'conventions', field: 'pinnedAnnouncements' },
      { id: 'pin-chat', label: 'Hub chat channels', emailNA: true, section: 'conventions', field: 'pinnedChat' },
      { id: 'pin-dig', label: 'Weekly pinned conventions digest', pushNA: true, section: 'conventions', field: 'weeklyDigest' },
    ],
  },
  {
    id: 'organizer',
    eyebrow: 'Organizer',
    title: 'Organization digests',
    rows: [
      {
        id: 'org-dig',
        label: 'Weekly organization digest',
        pushNA: true,
        section: 'organizer',
        field: 'orgWeeklyDigest',
      },
    ],
  },
]

export function readMatrixPair(
  notifications: NotificationSettings,
  section: SectionKey,
  field: string
): NotificationChannelPair {
  const block = notifications[section] as Record<string, NotificationChannelPair>
  return block[field] ?? { push: true, email: true }
}

export function writeMatrixPair(
  notifications: NotificationSettings,
  section: SectionKey,
  field: string,
  channel: keyof NotificationChannelPair,
  value: boolean
): NotificationSettings {
  const block = notifications[section] as Record<string, NotificationChannelPair>
  const prev = block[field] ?? { push: true, email: true }
  return {
    ...notifications,
    [section]: {
      ...block,
      [field]: { ...prev, [channel]: value },
    },
  }
}

export function setAllMatrixChannels(
  notifications: NotificationSettings,
  channel: keyof NotificationChannelPair,
  value: boolean
): NotificationSettings {
  let next = notifications
  for (const section of NOTIFICATION_MATRIX_SECTIONS) {
    for (const row of section.rows) {
      if (channel === 'push' && row.pushNA) continue
      if (channel === 'email' && row.emailNA) continue
      next = writeMatrixPair(next, row.section, row.field, channel, value)
    }
  }
  return next
}
