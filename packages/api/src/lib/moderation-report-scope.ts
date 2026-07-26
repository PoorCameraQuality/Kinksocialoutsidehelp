import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type ResolvedReportScope = {
  scopeType: string | null
  scopeId: string | null
}

export async function resolveReportScope(
  targetType: string,
  targetId: string
): Promise<ResolvedReportScope> {
  switch (targetType) {
    case 'platform':
      return { scopeType: 'platform', scopeId: null }
    case 'organization':
    case 'platform_organization':
      return { scopeType: 'organization', scopeId: targetId }
    case 'org_forum_thread':
    case 'org_forum_post':
    case 'org_channel_message': {
      if (targetType === 'org_forum_thread') {
        const [t] = await db
          .select({ organizationId: schema.forumThreads.organizationId })
          .from(schema.forumThreads)
          .where(eq(schema.forumThreads.id, targetId))
          .limit(1)
        if (t?.organizationId) return { scopeType: 'organization', scopeId: t.organizationId }
      }
      if (targetType === 'org_forum_post') {
        const [p] = await db
          .select({ threadId: schema.forumPosts.threadId })
          .from(schema.forumPosts)
          .where(eq(schema.forumPosts.id, targetId))
          .limit(1)
        if (p) {
          const [t] = await db
            .select({ organizationId: schema.forumThreads.organizationId })
            .from(schema.forumThreads)
            .where(eq(schema.forumThreads.id, p.threadId))
            .limit(1)
          if (t?.organizationId) return { scopeType: 'organization', scopeId: t.organizationId }
        }
      }
      if (targetType === 'org_channel_message') {
        const [m] = await db
          .select({ orgChannelId: schema.orgChannelMessages.orgChannelId })
          .from(schema.orgChannelMessages)
          .where(eq(schema.orgChannelMessages.id, targetId))
          .limit(1)
        if (m) {
          const [ch] = await db
            .select({ organizationId: schema.orgChannels.organizationId })
            .from(schema.orgChannels)
            .where(eq(schema.orgChannels.id, m.orgChannelId))
            .limit(1)
          if (ch?.organizationId) return { scopeType: 'organization', scopeId: ch.organizationId }
        }
      }
      return { scopeType: null, scopeId: null }
    }
    case 'group_forum_thread':
    case 'group_forum_post':
    case 'group_thread':
    case 'group_reply':
    case 'event_discussion_thread':
    case 'event_discussion_post': {
      // Event discussion aliases normalize to group_thread/group_reply (then
      // group_forum_* via toLegacyContextTargetType). Always check eventId so
      // event-scoped legacy mirrors are not dropped.
      const isReply =
        targetType === 'group_forum_post' ||
        targetType === 'group_reply' ||
        targetType === 'event_discussion_post'
      let threadId = targetId
      if (isReply) {
        const [p] = await db
          .select({ threadId: schema.forumPosts.threadId })
          .from(schema.forumPosts)
          .where(eq(schema.forumPosts.id, targetId))
          .limit(1)
        if (!p) return { scopeType: null, scopeId: null }
        threadId = p.threadId
      }
      const [t] = await db
        .select({
          groupId: schema.forumThreads.groupId,
          eventId: schema.forumThreads.eventId,
        })
        .from(schema.forumThreads)
        .where(eq(schema.forumThreads.id, threadId))
        .limit(1)
      if (t?.groupId) return { scopeType: 'group', scopeId: t.groupId }
      if (t?.eventId) return { scopeType: 'event', scopeId: t.eventId }
      return { scopeType: null, scopeId: null }
    }
    case 'profile':
    case 'feed_post':
      return { scopeType: 'platform', scopeId: null }
    case 'education_article':
    case 'media_show':
    case 'media_episode':
      return { scopeType: 'platform', scopeId: null }
    case 'convention_hub_channel_message':
    case 'convention_chat_message': {
      const [m] = await db
        .select({ channelId: schema.conventionHubChannelMessages.channelId })
        .from(schema.conventionHubChannelMessages)
        .where(eq(schema.conventionHubChannelMessages.id, targetId))
        .limit(1)
      if (!m) return { scopeType: null, scopeId: null }
      const [ch] = await db
        .select({ conventionId: schema.conventionHubChannels.conventionId })
        .from(schema.conventionHubChannels)
        .where(eq(schema.conventionHubChannels.id, m.channelId))
        .limit(1)
      if (ch?.conventionId) return { scopeType: 'convention', scopeId: ch.conventionId }
      return { scopeType: null, scopeId: null }
    }
    default:
      return { scopeType: null, scopeId: null }
  }
}
