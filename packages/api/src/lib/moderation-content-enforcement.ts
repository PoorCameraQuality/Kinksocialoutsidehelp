import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { recordModerationAudit } from './moderation-audit.js'
import { resolveModerationReportContext } from './moderation-report-context.js'
import {
  removeMediaAssetByModerator,
  resolveMediaAssetIdFromCase,
} from './media-mod-actions.js'

const REMOVED_BODY = '[removed by moderation]'

const FORUM_POST_TARGET_TYPES = new Set([
  'org_forum_post',
  'group_forum_post',
  'event_discussion_post',
  'org_forum_reply',
  'group_reply',
  'comment',
])

const ORG_CHAT_TARGET_TYPES = new Set(['org_channel_message', 'org_chat_message'])

const CONVENTION_CHAT_TARGET_TYPES = new Set([
  'convention_hub_channel_message',
  'convention_chat_message',
])

const MEDIA_TARGET_TYPES = new Set(['media_asset', 'profile_photo', 'media_show', 'media_episode'])

export type ContentDeleteResult =
  | { ok: true; mode: 'soft' | 'hard' | 'media_removed' | 'unpublished' }
  | { ok: false; unsupported: true; error: string }

export async function resolveContentAuthorUserId(
  targetType: string,
  targetId: string,
): Promise<string | null> {
  if (targetType === 'profile') return targetId

  if (FORUM_POST_TARGET_TYPES.has(targetType)) {
    const [post] = await db
      .select({ authorId: schema.forumPosts.authorId })
      .from(schema.forumPosts)
      .where(eq(schema.forumPosts.id, targetId))
      .limit(1)
    return post?.authorId ?? null
  }

  if (ORG_CHAT_TARGET_TYPES.has(targetType)) {
    const [msg] = await db
      .select({ senderId: schema.orgChannelMessages.senderId })
      .from(schema.orgChannelMessages)
      .where(eq(schema.orgChannelMessages.id, targetId))
      .limit(1)
    return msg?.senderId ?? null
  }

  if (CONVENTION_CHAT_TARGET_TYPES.has(targetType)) {
    const [msg] = await db
      .select({ senderId: schema.conventionHubChannelMessages.senderId })
      .from(schema.conventionHubChannelMessages)
      .where(eq(schema.conventionHubChannelMessages.id, targetId))
      .limit(1)
    return msg?.senderId ?? null
  }

  if (targetType === 'education_article') {
    const [article] = await db
      .select({ authorUserId: schema.educationArticles.authorUserId })
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.id, targetId))
      .limit(1)
    return article?.authorUserId ?? null
  }

  if (MEDIA_TARGET_TYPES.has(targetType)) {
    const mediaAssetId = await resolveMediaAssetIdFromCase(targetType, targetId)
    if (!mediaAssetId) return null
    const [asset] = await db
      .select({ uploaderUserId: schema.mediaAssets.uploaderUserId })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, mediaAssetId))
      .limit(1)
    return asset?.uploaderUserId ?? null
  }

  return null
}

export async function preserveModerationEvidence(params: {
  actorUserId: string
  targetType: string
  targetId: string
  reportId?: string
  caseId?: string
  category?: string
  reportBody?: string | null
  note?: string
}): Promise<string> {
  const context = await resolveModerationReportContext(params.targetType, params.targetId)
  return recordModerationAudit({
    actorUserId: params.actorUserId,
    scopeType: context.scopeType,
    scopeId: context.scopeKey,
    verb: MODERATION_AUDIT_VERBS.evidencePreserved,
    targetType: params.targetType,
    targetId: params.targetId,
    payload: {
      reportId: params.reportId ?? null,
      caseId: params.caseId ?? null,
      category: params.category ?? null,
      reportBody: params.reportBody ?? null,
      note: params.note ?? null,
      context,
      preservedAt: new Date().toISOString(),
    },
  })
}

export async function deleteModerationContent(params: {
  actorUserId: string
  targetType: string
  targetId: string
  hardDelete?: boolean
  reason: string
}): Promise<ContentDeleteResult> {
  const { actorUserId, targetType, targetId, hardDelete, reason } = params
  const now = new Date()

  if (MEDIA_TARGET_TYPES.has(targetType)) {
    const mediaAssetId = await resolveMediaAssetIdFromCase(targetType, targetId)
    if (!mediaAssetId) {
      return { ok: false, unsupported: true, error: 'Could not resolve media asset for deletion' }
    }
    await removeMediaAssetByModerator(actorUserId, mediaAssetId, reason)
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.contentDeleted,
      targetType,
      targetId,
      payload: { mode: 'media_removed', mediaAssetId, reason },
    })
    return { ok: true, mode: 'media_removed' }
  }

  if (FORUM_POST_TARGET_TYPES.has(targetType)) {
    if (hardDelete) {
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.id, targetId))
    } else {
      await db
        .update(schema.forumPosts)
        .set({ body: REMOVED_BODY, hiddenAt: now, hiddenByUserId: actorUserId })
        .where(eq(schema.forumPosts.id, targetId))
    }
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.contentDeleted,
      targetType,
      targetId,
      payload: { mode: hardDelete ? 'hard' : 'soft', reason },
    })
    return { ok: true, mode: hardDelete ? 'hard' : 'soft' }
  }

  if (ORG_CHAT_TARGET_TYPES.has(targetType)) {
    if (hardDelete) {
      await db.delete(schema.orgChannelMessages).where(eq(schema.orgChannelMessages.id, targetId))
    } else {
      await db
        .update(schema.orgChannelMessages)
        .set({ body: REMOVED_BODY, hiddenAt: now, hiddenByUserId: actorUserId })
        .where(eq(schema.orgChannelMessages.id, targetId))
    }
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.contentDeleted,
      targetType,
      targetId,
      payload: { mode: hardDelete ? 'hard' : 'soft', reason },
    })
    return { ok: true, mode: hardDelete ? 'hard' : 'soft' }
  }

  if (CONVENTION_CHAT_TARGET_TYPES.has(targetType)) {
    if (hardDelete) {
      await db
        .delete(schema.conventionHubChannelMessages)
        .where(eq(schema.conventionHubChannelMessages.id, targetId))
    } else {
      await db
        .update(schema.conventionHubChannelMessages)
        .set({ body: REMOVED_BODY, hiddenAt: now, hiddenByUserId: actorUserId })
        .where(eq(schema.conventionHubChannelMessages.id, targetId))
    }
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.contentDeleted,
      targetType,
      targetId,
      payload: { mode: hardDelete ? 'hard' : 'soft', reason },
    })
    return { ok: true, mode: hardDelete ? 'hard' : 'soft' }
  }

  if (targetType === 'education_article') {
    await db
      .update(schema.educationArticles)
      .set({
        publicationStatus: 'DRAFT',
        listInEducation: false,
        eckePublish: false,
        updatedAt: now,
      })
      .where(eq(schema.educationArticles.id, targetId))
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.contentDeleted,
      targetType,
      targetId,
      payload: { mode: 'unpublished', reason },
    })
    return { ok: true, mode: 'unpublished' }
  }

  return {
    ok: false,
    unsupported: true,
    error: `Delete is not supported for target type ${targetType}`,
  }
}

export async function suspendModerationSubject(params: {
  actorUserId: string
  subjectUserId: string
  reason: string
  permanent?: boolean
}): Promise<void> {
  const { actorUserId, subjectUserId, reason, permanent } = params

  const [user] = await db
    .select({ sessionVersion: schema.users.sessionVersion })
    .from(schema.users)
    .where(eq(schema.users.id, subjectUserId))
    .limit(1)
  if (!user) throw new Error('Subject user not found')

  if (permanent) {
    await db.insert(schema.identityBans).values({
      userId: subjectUserId,
      ipPrefix: '0.0.0.0/0',
      reason: reason.slice(0, 500),
    })
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.identityBan,
      targetType: 'user',
      targetId: subjectUserId,
      payload: { reason, via: 'report_suspend_permanent' },
    })
  }

  await db
    .update(schema.users)
    .set({ sessionVersion: (user.sessionVersion ?? 0) + 1 })
    .where(eq(schema.users.id, subjectUserId))

  await recordModerationAudit({
    actorUserId,
    scopeType: 'platform',
    scopeId: null,
    verb: MODERATION_AUDIT_VERBS.userSuspended,
    targetType: 'user',
    targetId: subjectUserId,
    payload: { reason, permanent: Boolean(permanent) },
  })
}
