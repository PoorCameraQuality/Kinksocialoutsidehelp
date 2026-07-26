import { eq } from 'drizzle-orm'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { recordModerationAudit } from './moderation-audit.js'
import { suspendModerationSubject } from './moderation-content-enforcement.js'
import { isSiteAdmin } from './platform-staff.js'

type ActionRow = typeof schema.moderationActions.$inferSelect

/** Content kinds that `HIDE_CONTENT` can mutate today. */
export type HideContentKind = 'forum_post' | 'org_channel_message'

/**
 * Resolve which hideable content table to update.
 * Prefers explicit `payload.contentKind`, then falls back to `action.targetType`.
 * Returns null when neither identifies a supported kind (caller must fail closed).
 */
export function resolveHideContentKind(
  payloadContentKind: unknown,
  actionTargetType: string,
): HideContentKind | null {
  const contentKind = typeof payloadContentKind === 'string' ? payloadContentKind : undefined
  if (contentKind === 'forum_post' || actionTargetType === 'forum_post') return 'forum_post'
  if (contentKind === 'org_channel_message' || actionTargetType === 'org_channel_message') {
    return 'org_channel_message'
  }
  return null
}

function asActionPayload(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

/**
 * Execute a queued moderation action (hide, lock, ban, suspend, etc.).
 *
 * Side effects: DB mutations + moderation audit rows. Marks the action
 * EXECUTED/OVERRIDDEN only after the branch succeeds — unsupported hide
 * targets throw so the queue cannot silently no-op then mark success.
 */
export async function executeModerationAction(
  action: ActionRow,
  actorUserId: string,
  opts?: { overrideReason?: string },
): Promise<void> {
  const payload = asActionPayload(action.payload)
  const scopeType = typeof payload.scopeType === 'string' ? payload.scopeType : 'platform'
  const scopeId = typeof payload.scopeId === 'string' ? payload.scopeId : null

  switch (action.actionType) {
    case 'HIDE_CONTENT': {
      const hideKind = resolveHideContentKind(payload.contentKind, action.targetType)
      if (!hideKind) {
        // Fail closed: previously an unknown kind audited + marked EXECUTED without hiding.
        throw new Error(
          'HIDE_CONTENT requires forum_post or org_channel_message (contentKind or targetType)',
        )
      }
      const contentId = action.targetId
      if (hideKind === 'forum_post') {
        await db
          .update(schema.forumPosts)
          .set({ hiddenAt: new Date(), hiddenByUserId: actorUserId })
          .where(eq(schema.forumPosts.id, contentId))
      } else {
        await db
          .update(schema.orgChannelMessages)
          .set({ hiddenAt: new Date(), hiddenByUserId: actorUserId })
          .where(eq(schema.orgChannelMessages.id, contentId))
      }
      await recordModerationAudit({
        actorUserId,
        scopeType,
        scopeId,
        verb: MODERATION_AUDIT_VERBS.contentHidden,
        targetType: action.targetType,
        targetId: action.targetId,
        payload,
      })
      break
    }
    case 'LOCK_THREAD': {
      await db
        .update(schema.forumThreads)
        .set({ lockedAt: new Date(), lockedByUserId: actorUserId })
        .where(eq(schema.forumThreads.id, action.targetId))
      await recordModerationAudit({
        actorUserId,
        scopeType,
        scopeId,
        verb: MODERATION_AUDIT_VERBS.threadLocked,
        targetType: 'forum_thread',
        targetId: action.targetId,
      })
      break
    }
    case 'SCOPE_BAN': {
      const banScopeType = payload.banScopeType as 'organization' | 'group'
      const banScopeId = payload.banScopeId as string
      const bannedUserId = action.targetId
      await db.insert(schema.scopeBans).values({
        scopeType: banScopeType,
        scopeId: banScopeId,
        userId: bannedUserId,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
        bannedByUserId: actorUserId,
        active: true,
      })
      await recordModerationAudit({
        actorUserId,
        scopeType: banScopeType,
        scopeId: banScopeId,
        verb: MODERATION_AUDIT_VERBS.scopeBanCreated,
        targetType: 'user',
        targetId: bannedUserId,
        payload,
      })
      break
    }
    case 'RESOLVE_REPORT': {
      const status = typeof payload.reportStatus === 'string' ? payload.reportStatus : 'RESOLVED'
      await db
        .update(schema.reports)
        .set({ status })
        .where(eq(schema.reports.id, action.targetId))
      await recordModerationAudit({
        actorUserId,
        scopeType,
        scopeId,
        verb: MODERATION_AUDIT_VERBS.reportTriaged,
        targetType: 'report',
        targetId: action.targetId,
        payload: { status },
      })
      break
    }
    case 'IDENTITY_BAN': {
      const ipPrefix = typeof payload.ipPrefix === 'string' ? payload.ipPrefix : '0.0.0.0/0'
      await db.insert(schema.identityBans).values({
        userId: action.targetId,
        ipPrefix,
        reason: typeof payload.reason === 'string' ? payload.reason : 'platform_moderation',
      })
      await recordModerationAudit({
        actorUserId,
        scopeType: 'platform',
        scopeId: null,
        verb: MODERATION_AUDIT_VERBS.identityBan,
        targetType: 'user',
        targetId: action.targetId,
        payload,
      })
      break
    }
    case 'FREEZE_ORG': {
      const orgId = action.targetId
      const [org] = await db
        .select({ featureFlags: schema.organizations.featureFlags })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, orgId))
        .limit(1)
      const flags =
        org?.featureFlags && typeof org.featureFlags === 'object' && !Array.isArray(org.featureFlags)
          ? (org.featureFlags as Record<string, unknown>)
          : {}
      await db
        .update(schema.organizations)
        .set({
          featureFlags: { ...flags, hubActive: false, commandBridgeFrozen: true },
        })
        .where(eq(schema.organizations.id, orgId))
      await recordModerationAudit({
        actorUserId,
        scopeType: 'platform',
        scopeId: null,
        verb: MODERATION_AUDIT_VERBS.orgFrozen,
        targetType: 'organization',
        targetId: orgId,
      })
      break
    }
    case 'SUSPEND_USER': {
      const reason =
        typeof payload.reason === 'string' && payload.reason.trim() ?
          payload.reason.trim()
        : 'platform_moderation'
      const permanent = payload.permanent === true
      if (permanent && !(await isSiteAdmin(actorUserId))) {
        throw new Error('Permanent suspension requires site admin access')
      }
      await suspendModerationSubject({
        actorUserId,
        subjectUserId: action.targetId,
        reason,
        permanent: payload.permanent === true,
      })
      break
    }
    case 'DELETE_CONTENT': {
      const { deleteModerationContent } = await import('./moderation-content-enforcement.js')
      const contentKind = typeof payload.contentKind === 'string' ? payload.contentKind : undefined
      const targetType =
        typeof payload.targetContentType === 'string' ? payload.targetContentType
        : contentKind === 'forum_post' || action.targetType === 'forum_post' ? 'org_forum_post'
        : contentKind === 'org_channel_message' || action.targetType === 'org_channel_message' ?
          'org_channel_message'
        : action.targetType
      const result = await deleteModerationContent({
        actorUserId,
        targetType,
        targetId: action.targetId,
        hardDelete: payload.hardDelete === true,
        reason: typeof payload.reason === 'string' ? payload.reason : 'platform_moderation',
      })
      if (!result.ok) {
        throw new Error(result.error)
      }
      break
    }
    default:
      break
  }

  if (opts?.overrideReason) {
    await recordModerationAudit({
      actorUserId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.ruleOfTwoOverridden,
      targetType: 'moderation_action',
      targetId: action.id,
      payload: { reason: opts.overrideReason },
    })
  }

  await db
    .update(schema.moderationActions)
    .set({
      status: opts?.overrideReason ? 'OVERRIDDEN' : 'EXECUTED',
      executedAt: new Date(),
      updatedAt: new Date(),
      ...(opts?.overrideReason
        ? { overrideByUserId: actorUserId, overrideReason: opts.overrideReason }
        : {}),
    })
    .where(eq(schema.moderationActions.id, action.id))
}
