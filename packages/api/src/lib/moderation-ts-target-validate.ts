import { and, eq, isNotNull, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Canonical T&S-1 report target types (stored on cases). */
export const MODERATION_REPORT_TARGET_TYPES = [
  'profile',
  'profile_photo',
  'post',
  'comment',
  'message',
  'group',
  'group_thread',
  'group_reply',
  'organization',
  'org_chat_message',
  'org_forum_thread',
  'org_forum_reply',
  'event',
  'convention',
  'vendor',
  'presenter',
  'media_asset',
  'education_article',
  'media_show',
  'media_episode',
  'convention_chat_message',
  'conversation',
  'platform',
] as const

export type ModerationReportTargetType = (typeof MODERATION_REPORT_TARGET_TYPES)[number]

const TARGET_TYPE_SET = new Set<string>(MODERATION_REPORT_TARGET_TYPES)

/** Legacy web intake aliases → canonical target types. */
const LEGACY_TARGET_TYPE_ALIASES: Record<string, ModerationReportTargetType> = {
  user: 'profile',
  feed_post: 'post',
  org_channel_message: 'org_chat_message',
  org_forum_post: 'org_forum_reply',
  group_forum_thread: 'group_thread',
  group_forum_post: 'group_reply',
  event_discussion_thread: 'group_thread',
  event_discussion_post: 'group_reply',
  platform_organization: 'organization',
  convention_hub_channel_message: 'convention_chat_message',
}

export function isModerationReportTargetType(value: string): value is ModerationReportTargetType {
  return TARGET_TYPE_SET.has(value)
}

export function normalizeModerationReportTargetType(raw: string): ModerationReportTargetType | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isModerationReportTargetType(trimmed)) return trimmed
  const alias = LEGACY_TARGET_TYPE_ALIASES[trimmed]
  return alias ?? null
}

/** Map canonical types to legacy scope/context resolver names where they differ. */
export function toLegacyContextTargetType(targetType: ModerationReportTargetType): string {
  switch (targetType) {
    case 'post':
      return 'feed_post'
    case 'org_chat_message':
      return 'org_channel_message'
    case 'org_forum_reply':
      return 'org_forum_post'
    case 'group_thread':
      return 'group_forum_thread'
    case 'group_reply':
      return 'group_forum_post'
    case 'convention_chat_message':
      return 'convention_hub_channel_message'
    default:
      return targetType
  }
}

export type TargetValidationResult =
  | { ok: true; targetType: ModerationReportTargetType; targetId: string }
  | { ok: false; error: string }

async function existsById(
  table: { id: unknown },
  targetId: string,
  extraWhere?: ReturnType<typeof eq>
): Promise<boolean> {
  const conditions = extraWhere ? and(eq(table.id as never, targetId), extraWhere) : eq(table.id as never, targetId)
  const [row] = await db
    .select({ id: table.id as never })
    .from(table as never)
    .where(conditions)
    .limit(1)
  return Boolean(row)
}

export async function validateModerationReportTarget(
  rawTargetType: string,
  targetId: string
): Promise<TargetValidationResult> {
  const trimmedId = targetId.trim()
  if (!trimmedId) return { ok: false, error: 'targetId is required' }

  const normalized = normalizeModerationReportTargetType(rawTargetType)
  if (!normalized) {
    return { ok: false, error: `Unknown target type: ${rawTargetType}` }
  }
  if (!isModerationReportTargetType(normalized)) {
    return { ok: false, error: `Unsupported target type: ${rawTargetType}` }
  }

  const targetType = normalized

  switch (targetType) {
    case 'profile':
      if (!(await existsById(schema.users, trimmedId))) {
        return { ok: false, error: 'Profile not found' }
      }
      break
    case 'profile_photo':
      if (!(await existsById(schema.profilePhotos, trimmedId))) {
        return { ok: false, error: 'Profile photo not found' }
      }
      break
    case 'post':
      if (!(await existsById(schema.feedPosts, trimmedId))) {
        return { ok: false, error: 'Post not found' }
      }
      break
    case 'comment':
      if (await existsById(schema.forumPosts, trimmedId)) break
      if (await existsById(schema.feedPostComments, trimmedId)) break
      return { ok: false, error: 'Comment not found' }
    case 'message':
      if (!(await existsById(schema.messages, trimmedId))) {
        return { ok: false, error: 'Message not found' }
      }
      break
    case 'group':
      if (!(await existsById(schema.groups, trimmedId))) {
        return { ok: false, error: 'Group not found' }
      }
      break
    case 'group_thread': {
      const [row] = await db
        .select({ id: schema.forumThreads.id })
        .from(schema.forumThreads)
        .where(
          and(
            eq(schema.forumThreads.id, trimmedId),
            or(isNotNull(schema.forumThreads.groupId), isNotNull(schema.forumThreads.eventId))
          )
        )
        .limit(1)
      if (!row) return { ok: false, error: 'Group thread not found' }
      break
    }
    case 'group_reply': {
      const [post] = await db
        .select({ id: schema.forumPosts.id, threadId: schema.forumPosts.threadId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, trimmedId))
        .limit(1)
      if (!post) return { ok: false, error: 'Group reply not found' }
      const [thread] = await db
        .select({ id: schema.forumThreads.id })
        .from(schema.forumThreads)
        .where(
          and(
            eq(schema.forumThreads.id, post.threadId),
            or(isNotNull(schema.forumThreads.groupId), isNotNull(schema.forumThreads.eventId))
          )
        )
        .limit(1)
      if (!thread) return { ok: false, error: 'Group reply not found' }
      break
    }
    case 'organization':
      if (!(await existsById(schema.organizations, trimmedId))) {
        return { ok: false, error: 'Organization not found' }
      }
      break
    case 'org_chat_message':
      if (!(await existsById(schema.orgChannelMessages, trimmedId))) {
        return { ok: false, error: 'Org chat message not found' }
      }
      break
    case 'org_forum_thread': {
      const [row] = await db
        .select({ id: schema.forumThreads.id })
        .from(schema.forumThreads)
        .where(and(eq(schema.forumThreads.id, trimmedId), isNotNull(schema.forumThreads.organizationId)))
        .limit(1)
      if (!row) return { ok: false, error: 'Org forum thread not found' }
      break
    }
    case 'org_forum_reply': {
      const [post] = await db
        .select({ id: schema.forumPosts.id, threadId: schema.forumPosts.threadId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, trimmedId))
        .limit(1)
      if (!post) return { ok: false, error: 'Org forum reply not found' }
      const [thread] = await db
        .select({ id: schema.forumThreads.id })
        .from(schema.forumThreads)
        .where(and(eq(schema.forumThreads.id, post.threadId), isNotNull(schema.forumThreads.organizationId)))
        .limit(1)
      if (!thread) return { ok: false, error: 'Org forum reply not found' }
      break
    }
    case 'event':
      if (!(await existsById(schema.events, trimmedId))) {
        return { ok: false, error: 'Event not found' }
      }
      break
    case 'convention':
      if (!(await existsById(schema.conventions, trimmedId))) {
        return { ok: false, error: 'Convention not found' }
      }
      break
    case 'vendor':
      if (!(await existsById(schema.vendorProfiles, trimmedId))) {
        return { ok: false, error: 'Vendor profile not found' }
      }
      break
    case 'presenter': {
      const [row] = await db
        .select({ userId: schema.presenterProfiles.userId })
        .from(schema.presenterProfiles)
        .where(eq(schema.presenterProfiles.userId, trimmedId))
        .limit(1)
      if (!row) return { ok: false, error: 'Presenter profile not found' }
      break
    }
    case 'media_asset':
      if (!(await existsById(schema.mediaAssets, trimmedId))) {
        return { ok: false, error: 'Media asset not found' }
      }
      break
    case 'education_article':
      if (!(await existsById(schema.educationArticles, trimmedId))) {
        return { ok: false, error: 'Education article not found' }
      }
      break
    case 'media_show':
      if (!(await existsById(schema.mediaShows, trimmedId))) {
        return { ok: false, error: 'Media show not found' }
      }
      break
    case 'media_episode':
      if (!(await existsById(schema.mediaShowEpisodes, trimmedId))) {
        return { ok: false, error: 'Media episode not found' }
      }
      break
    case 'convention_chat_message':
      if (!(await existsById(schema.conventionHubChannelMessages, trimmedId))) {
        return { ok: false, error: 'Convention chat message not found' }
      }
      break
    case 'conversation':
      if (!(await existsById(schema.conversations, trimmedId))) {
        return { ok: false, error: 'Conversation not found' }
      }
      break
    case 'platform':
      if (!trimmedId) {
        return { ok: false, error: 'Platform report requires a target id' }
      }
      break
    default: {
      const _exhaustive: never = targetType
      void _exhaustive
      return { ok: false, error: 'Unsupported target type' }
    }
  }

  if (!(MODERATION_REPORT_TARGET_TYPES as readonly string[]).includes(targetType)) {
    return { ok: false, error: 'Unsupported target type' }
  }

  return { ok: true, targetType, targetId: trimmedId }
}
