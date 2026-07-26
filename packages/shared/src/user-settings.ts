import { z } from 'zod'
import { connectionsListVisibilitySchema } from './connections-list-visibility.js'
import { feedActivityPrivacySchema, defaultFeedActivityPrivacy } from './feed-activity-privacy.js'
import { ADULT_CONTENT_PREFERENCES, adultContentPreferenceSchema } from './media-types.js'
import { defaultMediaSettings, mediaSettingsSchema } from './media-social.js'
import { userAutoDeleteDaysSchema, dmRetentionDaysSchema } from './retention-policy.js'

/**
 * Privacy JSON for messaging and follow rules.
 * Profile card visibility stays on profiles.visibility.
 *
 * Prefer connections_only / connections in product copy.
 * Stored friends on whoCanMessage and emphasizedReactionsFrom is still valid.
 * DM start treats friends like connections_only (mutual accepted connection).
 * Do not drop friends without a migrate path.
 */
export const privacySettingsSchema = z.object({
  schemaVersion: z.number(),
  whoCanMessage: z.enum(['open', 'connections_only', 'friends', 'groups_only', 'nobody']),
  allowFollow: z.boolean(),
  /** When false, user is excluded from /home People regional suggestions. */
  appearInRegionalPeopleSuggestions: z.boolean(),
  /** Public visibility for cross-event participation history on capability profiles. */
  activityHistoryVisibility: z.enum(['public', 'members', 'hidden']),
  /** Who can browse your accepted connections list on your public profile. */
  connectionsListVisibility: connectionsListVisibilitySchema,
  /** When true, new followers require approval before appearing in your Following list. */
  requireFollowApproval: z.boolean(),
  /** Who may send a connection request. */
  whoCanSendConnectionRequest: z.enum(['open', 'connections_only', 'nobody']),
  /** Who may invite you to events on C2K. */
  whoCanInviteToEvent: z.enum(['open', 'connections', 'organizers_i_follow']),
  /** Who may invite you to groups. */
  whoCanInviteToGroup: z.enum(['open', 'connections', 'group_leaders_i_know']),
  /** Master override: hide profile from Places / regional browse even when location is visible elsewhere. */
  hideFromPlacesDirectory: z.boolean(),
  /** Show typing indicators in direct messages. */
  showTypingInMessages: z.boolean(),
  /** Who may send image attachments in DMs. */
  allowImagesInDirectMessages: z.enum(['open', 'connections_only', 'nobody']),
  /** Viewer preference for adult-tagged media (SHOW | BLUR | HIDE). Alpha default BLUR. */
  adultContentPreference: adultContentPreferenceSchema,
  /** Auto-shred DMs you sent after N days (null = disabled). */
  directMessageAutoDeleteDays: userAutoDeleteDaysSchema,
  /** Auto-shred convention hub chat messages you sent after N days (null = disabled). */
  hubChatAutoDeleteDays: userAutoDeleteDaysSchema,
  /** Auto-shred your feed activity rows after N days (null = disabled). */
  activityAutoDeleteDays: userAutoDeleteDaysSchema,
  /** DM conversation retention: 180 / 365 / 730 days, or null = keep until you delete. */
  dmRetentionDays: dmRetentionDaysSchema,
  /** What actions appear in other people's activity feeds. */
  feedActivityPrivacy: feedActivityPrivacySchema,
  /** Uploaded photos/videos, tagging, albums, and media activity defaults. */
  mediaSettings: mediaSettingsSchema,
})

export type PrivacySettings = z.infer<typeof privacySettingsSchema>

export const defaultPrivacySettings: PrivacySettings = {
  schemaVersion: 9,
  whoCanMessage: 'connections_only',
  allowFollow: true,
  appearInRegionalPeopleSuggestions: true,
  activityHistoryVisibility: 'public',
  connectionsListVisibility: 'hidden',
  requireFollowApproval: false,
  whoCanSendConnectionRequest: 'open',
  whoCanInviteToEvent: 'connections',
  whoCanInviteToGroup: 'connections',
  hideFromPlacesDirectory: false,
  showTypingInMessages: true,
  allowImagesInDirectMessages: 'connections_only',
  /** Safer alpha default: blur adult-tagged media until the member opts in to show. */
  adultContentPreference: ADULT_CONTENT_PREFERENCES.blur,
  directMessageAutoDeleteDays: null,
  hubChatAutoDeleteDays: null,
  activityAutoDeleteDays: null,
  dmRetentionDays: 365,
  feedActivityPrivacy: defaultFeedActivityPrivacy,
  mediaSettings: defaultMediaSettings,
}

/** Push + email pair for notification matrix rows. */
export const notificationChannelPairSchema = z.object({
  push: z.boolean(),
  email: z.boolean(),
})

export type NotificationChannelPair = z.infer<typeof notificationChannelPairSchema>

/** Notification matrix schema v3. Legacy v1/v2 flat booleans migrate on read. */
export const notificationSettingsSchema = z.object({
  schemaVersion: z.number(),
  inbox: z.object({
    directMessages: notificationChannelPairSchema,
    messageRequests: notificationChannelPairSchema,
  }),
  connections: z.object({
    incomingRequests: notificationChannelPairSchema,
    requestAccepted: notificationChannelPairSchema,
  }),
  relationships: z.object({
    partnerRequests: notificationChannelPairSchema,
    partnerAccepted: notificationChannelPairSchema,
  }),
  events: z.object({
    reminders: notificationChannelPairSchema,
    organizerUpdates: notificationChannelPairSchema,
    invitations: notificationChannelPairSchema,
    rsvpOnMyEvents: notificationChannelPairSchema,
    canceled: notificationChannelPairSchema,
  }),
  groups: z.object({
    forumMentions: notificationChannelPairSchema,
    invitations: notificationChannelPairSchema,
    newDiscussions: notificationChannelPairSchema,
  }),
  conventions: z.object({
    pinnedAnnouncements: notificationChannelPairSchema,
    pinnedChat: notificationChannelPairSchema,
    weeklyDigest: notificationChannelPairSchema,
  }),
  organizer: z.object({
    orgWeeklyDigest: notificationChannelPairSchema,
  }),
  /** Per-group overrides keyed by group id (new forum posts, etc.). */
  groupOverrides: z.record(z.string(), notificationChannelPairSchema).default({}),
})

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>

const PAIR_ON = { push: true, email: true } satisfies NotificationChannelPair
const PUSH_ON = { push: true, email: false } satisfies NotificationChannelPair
const EMAIL_ON = { push: false, email: true } satisfies NotificationChannelPair

export const defaultNotificationSettings: NotificationSettings = {
  schemaVersion: 3,
  inbox: {
    directMessages: PAIR_ON,
    messageRequests: PAIR_ON,
  },
  connections: {
    incomingRequests: PAIR_ON,
    requestAccepted: PAIR_ON,
  },
  relationships: {
    partnerRequests: PAIR_ON,
    partnerAccepted: PAIR_ON,
  },
  events: {
    reminders: PAIR_ON,
    organizerUpdates: PAIR_ON,
    invitations: PUSH_ON,
    rsvpOnMyEvents: PUSH_ON,
    canceled: EMAIL_ON,
  },
  groups: {
    forumMentions: PAIR_ON,
    invitations: PUSH_ON,
    newDiscussions: PAIR_ON,
  },
  conventions: {
    pinnedAnnouncements: PUSH_ON,
    pinnedChat: PUSH_ON,
    weeklyDigest: EMAIL_ON,
  },
  organizer: {
    orgWeeklyDigest: EMAIL_ON,
  },
  groupOverrides: {},
}

function migrateLegacyNotificationSettings(raw: Record<string, unknown>): NotificationSettings {
  const on = (key: string) => raw[key] !== false
  return {
    schemaVersion: 3,
    inbox: {
      directMessages: { push: on('newMessages'), email: on('newMessages') },
      messageRequests: PAIR_ON,
    },
    connections: {
      incomingRequests: { push: on('connectionRequests'), email: on('connectionRequests') },
      requestAccepted: PAIR_ON,
    },
    relationships: {
      partnerRequests: { push: on('relationshipRequests'), email: on('relationshipRequests') },
      partnerAccepted: PAIR_ON,
    },
    events: {
      reminders: { push: on('eventReminders'), email: on('eventReminders') },
      organizerUpdates: { push: on('conventionUpdates'), email: on('conventionUpdates') },
      invitations: PUSH_ON,
      rsvpOnMyEvents: PUSH_ON,
      canceled: EMAIL_ON,
    },
    groups: {
      forumMentions: { push: on('groupUpdates'), email: on('groupUpdates') },
      invitations: PUSH_ON,
      newDiscussions: PAIR_ON,
    },
    conventions: {
      pinnedAnnouncements: PUSH_ON,
      pinnedChat: PUSH_ON,
      weeklyDigest: EMAIL_ON,
    },
    organizer: {
      orgWeeklyDigest: EMAIL_ON,
    },
    groupOverrides: (() => {
      if (!isRecord(raw.groupOverrides)) return {}
      const out: Record<string, NotificationChannelPair> = {}
      for (const [key, value] of Object.entries(raw.groupOverrides)) {
        const parsed = notificationChannelPairSchema.safeParse(value)
        if (parsed.success) out[key] = parsed.data
      }
      return out
    })(),
  }
}

/** Maps matrix rows to `user_notification_preferences` columns. */
export function notificationPreferencesFromMatrix(n: NotificationSettings) {
  return {
    orgDigestEmailWeekly: n.organizer.orgWeeklyDigest.email,
    pinnedDigestEmailWeekly: n.conventions.weeklyDigest.email,
    pushHubAnnouncements: n.conventions.pinnedAnnouncements.push,
    pushHubChat: n.conventions.pinnedChat.push,
  }
}

export function applyNotificationPreferencesToMatrix(
  n: NotificationSettings,
  prefs: {
    orgDigestEmailWeekly?: boolean
    pinnedDigestEmailWeekly?: boolean
    pushHubAnnouncements?: boolean
    pushHubChat?: boolean
  }
): NotificationSettings {
  return {
    ...n,
    conventions: {
      ...n.conventions,
      pinnedAnnouncements: {
        ...n.conventions.pinnedAnnouncements,
        push: prefs.pushHubAnnouncements ?? n.conventions.pinnedAnnouncements.push,
      },
      pinnedChat: {
        ...n.conventions.pinnedChat,
        push: prefs.pushHubChat ?? n.conventions.pinnedChat.push,
      },
      weeklyDigest: {
        ...n.conventions.weeklyDigest,
        email: prefs.pinnedDigestEmailWeekly ?? n.conventions.weeklyDigest.email,
      },
    },
    organizer: {
      orgWeeklyDigest: {
        ...n.organizer.orgWeeklyDigest,
        email: prefs.orgDigestEmailWeekly ?? n.organizer.orgWeeklyDigest.email,
      },
    },
  }
}

/** Feed filters (read path) + home IA prefs. */
export const feedSettingsSchema = z.object({
  schemaVersion: z.number(),
  hideStoryTypes: z.array(z.string()),
  showConnectionLikes: z.boolean(),
  showConnectionShares: z.boolean(),
  homeMode: z.enum(['following', 'discover']).optional(),
  followingFilter: z
    .enum(['all', 'posts', 'photos', 'video', 'articles', 'reactions', 'events', 'groups'])
    .optional(),
  /** Bubble unseen posts from people you follow to the top of Following feed. */
  bubbleUpUnseenFollowing: z.boolean(),
  /** Who gets large emphasis cards for strong reactions (future feed rendering). */
  emphasizedReactionsFrom: z.enum(['everyone', 'connections', 'friends']),
  /** ISO timestamp when member finished first-time onboarding. */
  onboardingCompletedAt: z.string().nullable().optional(),
  /** Current onboarding wizard step (1–11 hybrid flow). */
  onboardingStep: z.number().int().min(1).max(11).optional(),
  /** ISO timestamp when safety / age expectations were acknowledged. */
  onboardingSafetyAckAt: z.string().nullable().optional(),
  /** Selected onboarding intent tags (friends, events, etc.). */
  onboardingIntents: z.array(z.string()).optional(),
  /** When member dismissed the post-onboarding Start here section. */
  startHereDismissedAt: z.string().nullable().optional(),
  /** When member skipped email verification during onboarding (soft gate). */
  emailVerificationSkippedAt: z.string().nullable().optional(),
  /** 2 = hybrid 11-step funnel (legacy 6-step remapped on normalize). */
  onboardingFlowVersion: z.number().int().min(1).max(20).optional(),
})

export type FeedSettings = z.infer<typeof feedSettingsSchema>

export const defaultFeedSettings: FeedSettings = {
  schemaVersion: 6,
  hideStoryTypes: [],
  showConnectionLikes: true,
  showConnectionShares: true,
  homeMode: 'discover',
  followingFilter: 'all',
  bubbleUpUnseenFollowing: true,
  emphasizedReactionsFrom: 'connections',
  onboardingCompletedAt: null,
  onboardingStep: 1,
  onboardingSafetyAckAt: null,
  onboardingIntents: [],
  startHereDismissedAt: null,
  emailVerificationSkippedAt: null,
  onboardingFlowVersion: 2,
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function normalizePrivacySettings(raw: unknown): PrivacySettings {
  const merged = { ...defaultPrivacySettings, ...(isRecord(raw) ? raw : {}) }
  const schemaVersion = typeof merged.schemaVersion === 'number' ? merged.schemaVersion : 0
  if (schemaVersion < 4) {
    merged.schemaVersion = 4
    merged.adultContentPreference = merged.adultContentPreference ?? ADULT_CONTENT_PREFERENCES.blur
  }
  if ((merged.schemaVersion ?? 0) < 5) {
    merged.schemaVersion = 5
    merged.directMessageAutoDeleteDays = merged.directMessageAutoDeleteDays ?? null
    merged.hubChatAutoDeleteDays = merged.hubChatAutoDeleteDays ?? null
    merged.activityAutoDeleteDays = merged.activityAutoDeleteDays ?? null
  }
  if ((merged.schemaVersion ?? 0) < 6) {
    merged.schemaVersion = 6
    merged.dmRetentionDays = merged.dmRetentionDays ?? 365
  }
  if ((merged.schemaVersion ?? 0) < 7) {
    merged.schemaVersion = 7
    merged.connectionsListVisibility = merged.connectionsListVisibility ?? 'hidden'
  }
  if ((merged.schemaVersion ?? 0) < 8) {
    merged.schemaVersion = 8
    merged.feedActivityPrivacy = {
      ...defaultFeedActivityPrivacy,
      ...(isRecord(merged.feedActivityPrivacy) ? merged.feedActivityPrivacy : {}),
    }
  }
  if ((merged.schemaVersion ?? 0) < 9) {
    merged.schemaVersion = 9
    merged.mediaSettings = {
      ...defaultMediaSettings,
      ...(isRecord(merged.mediaSettings) ? merged.mediaSettings : {}),
    }
  }
  return privacySettingsSchema.parse(merged)
}

export function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  if (!isRecord(raw)) return defaultNotificationSettings
  if (raw.schemaVersion === 3 && isRecord(raw.inbox)) {
    return notificationSettingsSchema.parse(raw)
  }
  return notificationSettingsSchema.parse(migrateLegacyNotificationSettings(raw))
}

export function mergeNotificationSettings(
  current: unknown,
  patch: Partial<NotificationSettings>
): NotificationSettings {
  if (isRecord(patch) && isRecord(patch.inbox)) {
    return normalizeNotificationSettings(patch)
  }
  const base = normalizeNotificationSettings(current)
  return notificationSettingsSchema.parse({ ...base, ...patch })
}

export function normalizeFeedSettings(raw: unknown): FeedSettings {
  if (!isRecord(raw)) return defaultFeedSettings
  const merged = { ...defaultFeedSettings, ...raw }
  if ((merged.schemaVersion ?? 0) < 4) {
    merged.schemaVersion = 4
    merged.bubbleUpUnseenFollowing = merged.bubbleUpUnseenFollowing ?? true
    merged.emphasizedReactionsFrom = merged.emphasizedReactionsFrom ?? 'connections'
  }
  if ((merged.schemaVersion ?? 0) < 5) {
    merged.schemaVersion = 5
    if (!('onboardingCompletedAt' in raw)) {
      merged.onboardingCompletedAt = new Date(0).toISOString()
    } else {
      merged.onboardingCompletedAt = merged.onboardingCompletedAt ?? null
    }
    merged.onboardingStep = merged.onboardingStep ?? 1
    merged.onboardingSafetyAckAt = merged.onboardingSafetyAckAt ?? null
    merged.onboardingIntents = merged.onboardingIntents ?? []
    merged.startHereDismissedAt = merged.startHereDismissedAt ?? null
  }
  if ((merged.schemaVersion ?? 0) < 6 || (merged.onboardingFlowVersion ?? 1) < 2) {
    merged.schemaVersion = 6
    const flowVer = typeof merged.onboardingFlowVersion === 'number' ? merged.onboardingFlowVersion : 1
    if (flowVer < 2) {
      const step = typeof merged.onboardingStep === 'number' ? Math.round(merged.onboardingStep) : 1
      // Remap old 6-step ladder → hybrid 11-step (keep inline to avoid import cycle with onboarding.ts).
      const legacyMap: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 8, 5: 9, 6: 11 }
      if (step >= 1 && step <= 6) {
        merged.onboardingStep = legacyMap[step] ?? 1
      }
      merged.onboardingFlowVersion = 2
    }
    merged.emailVerificationSkippedAt = merged.emailVerificationSkippedAt ?? null
  }
  return feedSettingsSchema.parse(merged)
}

export function mergePrivacySettings(current: unknown, patch: Partial<PrivacySettings>): PrivacySettings {
  const base = normalizePrivacySettings(current)
  const merged: PrivacySettings = {
    ...base,
    ...patch,
    feedActivityPrivacy: {
      ...base.feedActivityPrivacy,
      ...(patch.feedActivityPrivacy ?? {}),
    },
    mediaSettings: {
      ...base.mediaSettings,
      ...(patch.mediaSettings ?? {}),
    },
  }
  return privacySettingsSchema.parse(merged)
}

export function mergeFeedSettings(current: unknown, patch: Partial<FeedSettings>): FeedSettings {
  const base = normalizeFeedSettings(current)
  return feedSettingsSchema.parse({ ...base, ...patch })
}

/** Full row shape for API responses. */
export const userSettingsBundleSchema = z.object({
  privacy: privacySettingsSchema,
  notifications: notificationSettingsSchema,
  feed: feedSettingsSchema,
})

export type UserSettingsBundle = z.infer<typeof userSettingsBundleSchema>

export function normalizeUserSettingsBundle(row: {
  privacySettings: unknown
  notificationSettings: unknown
  feedSettings: unknown
}): UserSettingsBundle {
  return {
    privacy: normalizePrivacySettings(row.privacySettings),
    notifications: normalizeNotificationSettings(row.notificationSettings),
    feed: normalizeFeedSettings(row.feedSettings),
  }
}
