import { POLICY_REASON_LABELS, type PolicyReason } from '@c2k/shared'



export const REPORT_TARGET_LABELS: Record<string, string> = {

  platform: 'Platform / support',

  organization: 'Organization',

  platform_organization: 'Organization (platform escalation)',

  org_forum_thread: 'Org forum thread',

  org_forum_post: 'Org forum post',

  org_channel_message: 'Org chat message',

  org_chat_message: 'Org chat message',

  group_forum_thread: 'Group forum thread',

  group_forum_post: 'Group forum post',

  group_thread: 'Group forum thread',

  group_reply: 'Group forum post',

  event_discussion_thread: 'Event discussion thread',

  event_discussion_post: 'Event discussion post',

  profile: 'User profile',

  user: 'User profile',

  event: 'Event',

  group: 'Group',

  comment: 'Comment',

  convention: 'Convention',

  education_article: 'Education article',

  media_show: 'Media channel',

  media_episode: 'Media episode',

  media_asset: 'Media asset',

  profile_photo: 'Profile photo',

  feed_post: 'Feed post',

  post: 'Feed post',

  message: 'Direct message',

  conversation: 'Conversation',

  convention_chat_message: 'Convention chat message',

  convention_hub_channel_message: 'Convention chat message',

  presenter: 'Presenter profile',

  vendor: 'Vendor profile',

}



export const REPORT_STATUS_LABELS: Record<string, string> = {

  OPEN: 'Open',

  open: 'Open',

  TRIAGED: 'In review',

  triaged: 'In review',

  RESOLVED: 'Resolved',

  resolved: 'Resolved',

  DISMISSED: 'Dismissed',

  dismissed: 'Dismissed',

  ACTIONED: 'Actioned',

  CLOSED_NO_VIOLATION: 'Closed: no violation',

  CLOSED_DUPLICATE: 'Closed: duplicate',

  ESCALATED: 'Escalated',

}



/**

 * Legacy `reports.category` strings from pre–T&S-1 intake.

 * New member reports use canonical `PolicyReason` via `ReportAction` → `TsReportModal` → `POST /api/v1/moderation/reports`.

 */

export const REPORT_CATEGORY_LABELS: Record<string, string> = {

  harassment: 'Harassment',

  spam: 'Spam',

  impersonation: 'Impersonation',

  safety: 'Safety',

  content: 'Content',

  illegal: 'Illegal / safety',

  other: 'Other',

}



/** Canonical policy reason labels (re-export for mod inbox / settings backward compat). */

export { POLICY_REASON_LABELS }



export function labelPolicyReason(reason: string): string {

  return (POLICY_REASON_LABELS as Record<string, string>)[reason] ?? reason.replace(/_/g, ' ')

}



export function isPolicyReason(value: string): value is PolicyReason {

  return value in POLICY_REASON_LABELS

}



export function labelReportTarget(type: string): string {

  return REPORT_TARGET_LABELS[type] ?? type.replace(/_/g, ' ')

}



export function labelReportStatus(status: string): string {

  return REPORT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')

}



export function labelReportCategory(category: string): string {

  if (isPolicyReason(category)) return labelPolicyReason(category)

  return REPORT_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ')

}



/** Surfaces wired to canonical ReportAction + TsReportModal (2026-06). */

export const TS_REPORT_MODAL_SURFACES = [

  { targetType: 'profile', surface: '/profile/:username', label: 'Public profile · Report profile' },

  {

    targetType: 'media_asset',

    surface: '/profile/:username?tab=Photos',

    label: 'Profile gallery · Report photo (when mediaAssetId linked)',

  },

  { targetType: 'group', surface: '/groups/:id', label: 'Group hub · Report group' },

  { targetType: 'group_forum_thread', surface: '/groups/:id', label: 'Group forums · Report thread' },

  { targetType: 'group_forum_post', surface: '/groups/:id', label: 'Group forums · Report post' },

  { targetType: 'feed_post', surface: '/home', label: 'Feed · Report post' },

  { targetType: 'comment', surface: '/home', label: 'Feed · Report comment' },

  { targetType: 'message', surface: '/messaging', label: 'DM · Report message' },

  { targetType: 'conversation', surface: '/messaging', label: 'DM · Report conversation' },

  { targetType: 'org_forum_thread', surface: '/orgs/:slug', label: 'Org forums · Report thread' },

  { targetType: 'org_forum_post', surface: '/orgs/:slug', label: 'Org forums · Report post' },

  { targetType: 'org_channel_message', surface: '/orgs/:slug', label: 'Org chat · Report message' },

  { targetType: 'organization', surface: '/orgs/:slug', label: 'Org hub · Report organization' },

  { targetType: 'event_discussion_thread', surface: '/events/:id', label: 'Event discussion · Report thread' },

  { targetType: 'event_discussion_post', surface: '/events/:id', label: 'Event discussion · Report post' },

  { targetType: 'event', surface: '/events/:id', label: 'Event · Report event' },

  { targetType: 'education_article', surface: '/education/:slug', label: 'Education · Report article' },

  { targetType: 'media_show', surface: '/media/:slug', label: 'Media · Report channel' },

  { targetType: 'media_episode', surface: '/media/:slug', label: 'Media · Report episode' },

  { targetType: 'presenter', surface: '/presenters/:username', label: 'Presenter · Report profile' },

  { targetType: 'vendor', surface: '/vendors/:id', label: 'Vendor shop · Report vendor' },

  { targetType: 'profile', surface: '/people', label: 'People directory · Report profile card' },

  { targetType: 'convention', surface: '/conventions/:slug', label: 'Convention hub · Report convention' },

  { targetType: 'convention_chat_message', surface: '/conventions/:slug', label: 'Convention hub · Report chat message' },

  { targetType: 'platform', surface: '/support', label: 'Platform support form' },

] as const



/** All target types currently submitted from the web app. */

export const REPORT_INTAKE_SURFACES = TS_REPORT_MODAL_SURFACES


