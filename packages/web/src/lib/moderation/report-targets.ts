/**
 * Canonical report target types and legacy aliases for web intake.
 * Server normalizes aliases in moderation-ts-target-validate.ts.
 */

/** Target types accepted by POST /api/v1/moderation/reports (includes legacy aliases). */
export const REPORT_TARGET_TYPES = {
  profile: 'profile',
  user: 'user',
  profilePhoto: 'profile_photo',
  mediaAsset: 'media_asset',
  post: 'post',
  feedPost: 'feed_post',
  message: 'message',
  conversation: 'conversation',
  group: 'group',
  groupForumThread: 'group_forum_thread',
  groupForumPost: 'group_forum_post',
  organization: 'organization',
  platformOrganization: 'platform_organization',
  orgForumThread: 'org_forum_thread',
  orgForumPost: 'org_forum_post',
  orgChannelMessage: 'org_channel_message',
  event: 'event',
  eventDiscussionThread: 'event_discussion_thread',
  eventDiscussionPost: 'event_discussion_post',
  convention: 'convention',
  conventionChatMessage: 'convention_chat_message',
  presenter: 'presenter',
  vendor: 'vendor',
  educationArticle: 'education_article',
  mediaShow: 'media_show',
  mediaEpisode: 'media_episode',
  comment: 'comment',
  platform: 'platform',
} as const

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[keyof typeof REPORT_TARGET_TYPES]

export type ReportTarget = {
  targetType: ReportTargetType | string
  targetId: string
}

export function profileTarget(userId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.profile, targetId: userId }
}

export function messageTarget(messageId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.message, targetId: messageId }
}

export function conversationTarget(conversationId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.conversation, targetId: conversationId }
}

export function feedPostTarget(postId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.feedPost, targetId: postId }
}

export function eventTarget(eventId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.event, targetId: eventId }
}

export function eventDiscussionThreadTarget(threadId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.eventDiscussionThread, targetId: threadId }
}

export function eventDiscussionPostTarget(postId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.eventDiscussionPost, targetId: postId }
}

export function groupForumThreadTarget(threadId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.groupForumThread, targetId: threadId }
}

export function groupForumPostTarget(postId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.groupForumPost, targetId: postId }
}

export function orgForumThreadTarget(threadId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.orgForumThread, targetId: threadId }
}

export function orgForumPostTarget(postId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.orgForumPost, targetId: postId }
}

export function orgChannelMessageTarget(messageId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.orgChannelMessage, targetId: messageId }
}

export function conventionChatMessageTarget(messageId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.conventionChatMessage, targetId: messageId }
}

export function presenterTarget(userId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.presenter, targetId: userId }
}

export function educationArticleTarget(articleId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.educationArticle, targetId: articleId }
}

export function mediaShowTarget(showId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.mediaShow, targetId: showId }
}

export function mediaEpisodeTarget(episodeId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.mediaEpisode, targetId: episodeId }
}

export function mediaAssetTarget(assetId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.mediaAsset, targetId: assetId }
}

export function organizationTarget(orgId: string, escalate = false): ReportTarget {
  return {
    targetType: escalate ? REPORT_TARGET_TYPES.platformOrganization : REPORT_TARGET_TYPES.organization,
    targetId: orgId,
  }
}

export function vendorTarget(vendorProfileId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.vendor, targetId: vendorProfileId }
}

export function groupTarget(groupId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.group, targetId: groupId }
}

export function conventionTarget(conventionId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.convention, targetId: conventionId }
}

export function commentTarget(commentId: string): ReportTarget {
  return { targetType: REPORT_TARGET_TYPES.comment, targetId: commentId }
}
