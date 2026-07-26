import { z } from 'zod'

/** Who may see this activity type in other people's feeds. */
export const FEED_ACTIVITY_VISIBILITY_LEVELS = ['on', 'connections_only', 'off'] as const
export type FeedActivityVisibility = (typeof FEED_ACTIVITY_VISIBILITY_LEVELS)[number]

export const feedActivityVisibilitySchema = z.enum(FEED_ACTIVITY_VISIBILITY_LEVELS)

export const GROUP_JOIN_FEED_VISIBILITY_LEVELS = ['ask', 'on', 'off'] as const
export type GroupJoinFeedVisibility = (typeof GROUP_JOIN_FEED_VISIBILITY_LEVELS)[number]

export const DEFAULT_GROUP_MEMBER_LIST_PREF_LEVELS = ['ask', 'visible', 'hidden'] as const
export type DefaultGroupMemberListPref = (typeof DEFAULT_GROUP_MEMBER_LIST_PREF_LEVELS)[number]

export const feedActivityPrivacySchema = z.object({
  /** Feed default for posts. Post visibility rules still apply separately. */
  showPostsInFeeds: z.enum(['normal', 'connections_only', 'only_me']),
  showReactions: feedActivityVisibilitySchema,
  showComments: feedActivityVisibilitySchema,
  showFollows: feedActivityVisibilitySchema,
  showEventRsvps: feedActivityVisibilitySchema,
  /** ask means prompt on each join. This value is the stored default. */
  showGroupJoins: z.enum(['ask', 'on', 'off']),
  showMediaUploads: feedActivityVisibilitySchema,
  showVendorActivity: z.enum(['on', 'off']),
  showPresenterActivity: z.enum(['on', 'off']),
  showInConnectionSuggestions: z.boolean(),
  showRecentlyActive: z.boolean(),
  defaultGroupMemberListVisibility: z.enum(DEFAULT_GROUP_MEMBER_LIST_PREF_LEVELS),
  defaultShowGroupsOnProfile: z.boolean(),
  defaultAnnounceGroupJoins: z.boolean(),
})

export type FeedActivityPrivacy = z.infer<typeof feedActivityPrivacySchema>

export const defaultFeedActivityPrivacy: FeedActivityPrivacy = {
  showPostsInFeeds: 'normal',
  showReactions: 'connections_only',
  showComments: 'connections_only',
  showFollows: 'connections_only',
  showEventRsvps: 'off',
  showGroupJoins: 'ask',
  showMediaUploads: 'connections_only',
  showVendorActivity: 'on',
  showPresenterActivity: 'on',
  showInConnectionSuggestions: true,
  showRecentlyActive: false,
  defaultGroupMemberListVisibility: 'ask',
  defaultShowGroupsOnProfile: false,
  defaultAnnounceGroupJoins: false,
}

export type FeedActivityVerbKey =
  | 'posted'
  | 'reacted'
  | 'loved'
  | 'commented'
  | 'followed'
  | 'joined_group'
  | 'rsvped_event'
  | 'uploaded_media'
  | 'added_vendor_product'
  | 'published_class'
  | 'replied_discussion'
  | 'shared'
  | 'connection_accepted'
  | 'group_join'
  | 'event_rsvp'
  | 'event_created'
  | 'org_join'
  | 'org_announcement'
  | 'convention_pin'
  | 'presenter_assigned'
  | 'vendor_shop_live'

export type FeedActivityPrivacyContext = {
  /**
   * Viewer may see connections_only activities when this is true.
   * Callers pass the follow edge today, even though the label says connections.
   * Do not treat this as mutual connection without updating callers and tests.
   */
  viewerFollowsActor: boolean
}

function visibilityAllows(
  level: FeedActivityVisibility,
  ctx: FeedActivityPrivacyContext,
): boolean {
  if (level === 'off') return false
  if (level === 'on') return true
  return ctx.viewerFollowsActor
}

/**
 * Whether this activity verb may show in another member's feed.
 * showGroupJoins ask always returns false here. The join path must store a
 * real choice before emit. This helper does not prompt.
 */
export function canActorActivityAppearInFeed(
  privacy: FeedActivityPrivacy,
  verb: FeedActivityVerbKey,
  ctx: FeedActivityPrivacyContext,
): boolean {
  switch (verb) {
    case 'posted':
      if (privacy.showPostsInFeeds === 'only_me') return false
      if (privacy.showPostsInFeeds === 'connections_only') return ctx.viewerFollowsActor
      return true
    case 'reacted':
    case 'loved':
      return visibilityAllows(privacy.showReactions, ctx)
    case 'commented':
    case 'replied_discussion':
      return visibilityAllows(privacy.showComments, ctx)
    case 'followed':
    case 'connection_accepted':
      return visibilityAllows(privacy.showFollows, ctx)
    case 'rsvped_event':
    case 'event_rsvp':
      return visibilityAllows(privacy.showEventRsvps, ctx)
    case 'joined_group':
    case 'group_join':
      if (privacy.showGroupJoins === 'off') return false
      if (privacy.showGroupJoins === 'ask') return false
      return true
    case 'uploaded_media':
      return visibilityAllows(privacy.showMediaUploads, ctx)
    case 'added_vendor_product':
    case 'vendor_shop_live':
      return privacy.showVendorActivity === 'on'
    case 'published_class':
    case 'presenter_assigned':
      return privacy.showPresenterActivity === 'on'
    default:
      return true
  }
}
