import { APP_NAME } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type ModerationReportContext = {
  targetLabel: string
  excerpt: string | null
  href: string | null
  scopeType: 'platform' | 'organization' | 'group' | 'event' | 'unknown'
  scopeName: string | null
  scopeKey: string | null
  contentMissing: boolean
}

const EXCERPT_MAX = 280

function clip(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  return t.length <= EXCERPT_MAX ? t : `${t.slice(0, EXCERPT_MAX)}…`
}

async function orgById(orgId: string) {
  const [row] = await db
    .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)
  return row ?? null
}

async function groupById(groupId: string) {
  const [row] = await db
    .select({ id: schema.groups.id, name: schema.groups.name })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)
  return row ?? null
}

async function eventById(eventId: string) {
  const [row] = await db
    .select({ id: schema.events.id, title: schema.events.title })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  return row ?? null
}

async function threadScope(threadId: string) {
  const [thread] = await db
    .select({
      id: schema.forumThreads.id,
      title: schema.forumThreads.title,
      organizationId: schema.forumThreads.organizationId,
      groupId: schema.forumThreads.groupId,
      eventId: schema.forumThreads.eventId,
    })
    .from(schema.forumThreads)
    .where(eq(schema.forumThreads.id, threadId))
    .limit(1)
  if (!thread) return null
  if (thread.organizationId) {
    const org = await orgById(thread.organizationId)
    return {
      targetLabel: `Forum thread: ${thread.title}`,
      excerpt: null,
      href: org ? `/orgs/${org.slug}?tab=Forums` : null,
      scopeType: 'organization' as const,
      scopeName: org?.displayName ?? null,
      scopeKey: org?.slug ?? null,
      contentMissing: false,
    }
  }
  if (thread.groupId) {
    const group = await groupById(thread.groupId)
    return {
      targetLabel: `Group forum thread: ${thread.title}`,
      excerpt: null,
      href: group ? `/groups/${group.id}?tab=Forums` : null,
      scopeType: 'group' as const,
      scopeName: group?.name ?? null,
      scopeKey: group?.id ?? null,
      contentMissing: false,
    }
  }
  if (thread.eventId) {
    const event = await eventById(thread.eventId)
    return {
      targetLabel: `Event discussion: ${thread.title}`,
      excerpt: null,
      href: event ? `/events/${event.id}?tab=Discussion` : null,
      scopeType: 'event' as const,
      scopeName: event?.title ?? null,
      scopeKey: event?.id ?? null,
      contentMissing: false,
    }
  }
  return null
}

export async function resolveModerationReportContext(
  targetType: string,
  targetId: string
): Promise<ModerationReportContext> {
  const missing = (label: string): ModerationReportContext => ({
    targetLabel: label,
    excerpt: null,
    href: null,
    scopeType: 'unknown',
    scopeName: null,
    scopeKey: null,
    contentMissing: true,
  })

  switch (targetType) {
    case 'platform':
      return {
        targetLabel: 'Platform / support',
        excerpt: null,
        href: '/support',
        scopeType: 'platform',
        scopeName: APP_NAME,
        scopeKey: null,
        contentMissing: false,
      }
    case 'organization':
    case 'platform_organization': {
      const org = await orgById(targetId)
      if (!org) return missing('Organization (removed or unknown)')
      return {
        targetLabel: targetType === 'platform_organization' ? `Organization escalation: ${org.displayName}` : org.displayName,
        excerpt: null,
        href: `/orgs/${org.slug}`,
        scopeType: 'organization',
        scopeName: org.displayName,
        scopeKey: org.slug,
        contentMissing: false,
      }
    }
    case 'org_forum_thread': {
      const ctx = await threadScope(targetId)
      return ctx ?? missing('Org forum thread (not found)')
    }
    case 'org_forum_post': {
      const [post] = await db
        .select({ body: schema.forumPosts.body, threadId: schema.forumPosts.threadId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, targetId))
        .limit(1)
      if (!post) return missing('Org forum post (not found)')
      const ctx = await threadScope(post.threadId)
      if (!ctx) return missing('Org forum post (thread missing)')
      return {
        ...ctx,
        targetLabel: 'Org forum post',
        excerpt: clip(post.body),
      }
    }
    case 'org_channel_message': {
      const [msg] = await db
        .select({
          body: schema.orgChannelMessages.body,
          orgChannelId: schema.orgChannelMessages.orgChannelId,
        })
        .from(schema.orgChannelMessages)
        .where(eq(schema.orgChannelMessages.id, targetId))
        .limit(1)
      if (!msg) return missing('Org chat message (not found)')
      const [channel] = await db
        .select({
          name: schema.orgChannels.name,
          organizationId: schema.orgChannels.organizationId,
        })
        .from(schema.orgChannels)
        .where(eq(schema.orgChannels.id, msg.orgChannelId))
        .limit(1)
      const org = channel?.organizationId ? await orgById(channel.organizationId) : null
      return {
        targetLabel: org ? `Org chat #${channel?.name ?? 'channel'}` : 'Org chat message',
        excerpt: clip(msg.body),
        href: org ? `/orgs/${org.slug}?tab=Chat` : null,
        scopeType: 'organization',
        scopeName: org?.displayName ?? null,
        scopeKey: org?.slug ?? null,
        contentMissing: false,
      }
    }
    case 'group_forum_thread': {
      const ctx = await threadScope(targetId)
      return ctx ?? missing('Group forum thread (not found)')
    }
    case 'group_forum_post': {
      const [post] = await db
        .select({ body: schema.forumPosts.body, threadId: schema.forumPosts.threadId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, targetId))
        .limit(1)
      if (!post) return missing('Group forum post (not found)')
      const ctx = await threadScope(post.threadId)
      if (!ctx) return missing('Group forum post (thread missing)')
      return {
        ...ctx,
        targetLabel: 'Group forum post',
        excerpt: clip(post.body),
      }
    }
    case 'event_discussion_thread': {
      const ctx = await threadScope(targetId)
      return ctx ?? missing('Event discussion thread (not found)')
    }
    case 'event_discussion_post': {
      const [post] = await db
        .select({ body: schema.forumPosts.body, threadId: schema.forumPosts.threadId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, targetId))
        .limit(1)
      if (!post) return missing('Event discussion post (not found)')
      const ctx = await threadScope(post.threadId)
      if (!ctx) return missing('Event discussion post (thread missing)')
      return {
        ...ctx,
        targetLabel: 'Event discussion post',
        excerpt: clip(post.body),
      }
    }
    case 'profile': {
      const [user] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, targetId))
        .limit(1)
      if (!user) return missing('User profile (not found)')
      return {
        targetLabel: `Profile @${user.username}`,
        excerpt: null,
        href: `/profile/${user.username}`,
        scopeType: 'unknown',
        scopeName: null,
        scopeKey: null,
        contentMissing: false,
      }
    }
    case 'media_show': {
      const [show] = await db
        .select({ slug: schema.mediaShows.slug, title: schema.mediaShows.title })
        .from(schema.mediaShows)
        .where(eq(schema.mediaShows.id, targetId))
        .limit(1)
      if (!show) return missing('Media channel (not found)')
      return {
        targetLabel: show.title,
        excerpt: null,
        href: `/media/${show.slug}`,
        scopeType: 'platform',
        scopeName: APP_NAME,
        scopeKey: null,
        contentMissing: false,
      }
    }
    case 'media_episode': {
      const [ep] = await db
        .select({
          title: schema.mediaShowEpisodes.title,
          slug: schema.mediaShowEpisodes.slug,
          showSlug: schema.mediaShows.slug,
        })
        .from(schema.mediaShowEpisodes)
        .innerJoin(schema.mediaShows, eq(schema.mediaShows.id, schema.mediaShowEpisodes.showId))
        .where(eq(schema.mediaShowEpisodes.id, targetId))
        .limit(1)
      if (!ep) return missing('Media episode (not found)')
      return {
        targetLabel: ep.title,
        excerpt: null,
        href: `/media/${ep.showSlug}`,
        scopeType: 'platform',
        scopeName: APP_NAME,
        scopeKey: null,
        contentMissing: false,
      }
    }
    case 'convention_hub_channel_message':
    case 'convention_chat_message': {
      const [msg] = await db
        .select({
          body: schema.conventionHubChannelMessages.body,
          channelId: schema.conventionHubChannelMessages.channelId,
        })
        .from(schema.conventionHubChannelMessages)
        .where(eq(schema.conventionHubChannelMessages.id, targetId))
        .limit(1)
      if (!msg) return missing('Convention chat message (not found)')
      const [channel] = await db
        .select({
          name: schema.conventionHubChannels.name,
          conventionId: schema.conventionHubChannels.conventionId,
        })
        .from(schema.conventionHubChannels)
        .where(eq(schema.conventionHubChannels.id, msg.channelId))
        .limit(1)
      const [conv] = channel?.conventionId
        ? await db
            .select({ slug: schema.conventions.slug, name: schema.conventions.name })
            .from(schema.conventions)
            .where(eq(schema.conventions.id, channel.conventionId))
            .limit(1)
        : [undefined]
      return {
        targetLabel: conv ? `Convention chat #${channel?.name ?? 'channel'}` : 'Convention chat message',
        excerpt: clip(msg.body),
        href: conv ? `/conventions/${conv.slug}?tab=Chat` : null,
        scopeType: 'unknown',
        scopeName: conv?.name ?? null,
        scopeKey: conv?.slug ?? null,
        contentMissing: false,
      }
    }
    case 'education_article': {
      const [article] = await db
        .select({ slug: schema.educationArticles.slug, title: schema.educationArticles.title })
        .from(schema.educationArticles)
        .where(eq(schema.educationArticles.id, targetId))
        .limit(1)
      if (!article) return missing('Education article (not found)')
      return {
        targetLabel: article.title,
        excerpt: null,
        href: `/education/${article.slug}`,
        scopeType: 'platform',
        scopeName: APP_NAME,
        scopeKey: null,
        contentMissing: false,
      }
    }
    default:
      return {
        targetLabel: targetType.replace(/_/g, ' '),
        excerpt: null,
        href: null,
        scopeType: 'unknown',
        scopeName: null,
        scopeKey: null,
        contentMissing: false,
      }
  }
}
