import { randomUUID } from 'node:crypto'
import {
  MEDIA_UPLOAD_STATUSES,
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  readMediaScannerStartupConfig,
  type ModerationCaseStatus,
  type ModerationQueue,
  isKnownModerationCaseStatus,
  isKnownModerationQueue,
  isKnownPolicySeverity,
  moderationCaseStatusSchema,
} from '@c2k/shared'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { ModerationInternalNote } from '../db/schema.js'
import { executeModerationAction } from './moderation-action-execute.js'
import { getMediaAssetById } from './media-asset-service.js'
import {
  approveMediaAssetByModerator,
  assetHasMalwareBlock,
  keepMediaQuarantined,
  removeMediaAssetByModerator,
  resolveMediaAssetIdFromCase,
  restoreMediaAssetByModerator,
} from './media-mod-actions.js'
import { resolveMediaServingKey } from './media-pipeline.js'
import { isSiteAdmin } from './platform-staff.js'
import { getMediaPolicyAdminSnapshot } from './media-policy.js'
import { resolveModerationCaseContextLinks } from './moderation-case-context.js'
import {
  deleteModerationContent,
  preserveModerationEvidence,
  resolveContentAuthorUserId,
  suspendModerationSubject,
} from './moderation-content-enforcement.js'

export const RESTRICTED_MODERATION_QUEUE = MODERATION_QUEUES.minorSafetyRestricted

export const MODERATION_CASE_EVENT_TYPES = {
  assigned: 'case.assigned',
  statusChanged: 'case.status_changed',
  noteAdded: 'case.note_added',
  markNoViolation: 'case.action_mark_no_violation',
  closeDuplicate: 'case.action_close_duplicate',
  escalate: 'case.action_escalate',
  hideContent: 'case.action_hide_content',
  mediaViewed: 'media.viewed_by_moderator',
  mediaRemoved: 'case.action_media_removed',
  mediaKeptQuarantined: 'case.action_media_kept_quarantined',
  mediaRestored: 'case.action_media_restored',
  deleteContent: 'case.action_delete_content',
  suspendSubject: 'case.action_suspend_subject',
  actionUnsupported: 'case.action_unsupported',
} as const

const DASHBOARD_OPEN_CASE_STATUSES: ModerationCaseStatus[] = [
  MODERATION_CASE_STATUSES.open,
  MODERATION_CASE_STATUSES.triaged,
  MODERATION_CASE_STATUSES.escalated,
]

const TERMINAL_CASE_STATUSES: ModerationCaseStatus[] = [
  MODERATION_CASE_STATUSES.closedNoViolation,
  MODERATION_CASE_STATUSES.closedDuplicate,
]

/** Case statuses that leave the active mod queue after enforcement. */
const RESOLVED_FROM_QUEUE_CASE_STATUSES: ModerationCaseStatus[] = [
  ...TERMINAL_CASE_STATUSES,
  MODERATION_CASE_STATUSES.actioned,
]

async function closeModerationQueueItemsForCase(caseId: string): Promise<void> {
  await db
    .update(schema.moderationQueueItems)
    .set({ status: 'CLOSED' })
    .where(eq(schema.moderationQueueItems.caseId, caseId))
}

export class ModerationCaseAccessError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ModerationCaseAccessError'
  }
}

export class ModerationCaseNotFoundError extends Error {
  constructor() {
    super('Case not found')
    this.name = 'ModerationCaseNotFoundError'
  }
}

export async function canViewRestrictedQueue(userId: string): Promise<boolean> {
  return isSiteAdmin(userId)
}

export async function assertRestrictedQueueFilter(
  userId: string,
  queueFilter: string | undefined
): Promise<void> {
  if (queueFilter === RESTRICTED_MODERATION_QUEUE && !(await canViewRestrictedQueue(userId))) {
    throw new ModerationCaseAccessError('Site admin required for restricted queue')
  }
}

async function assertCaseQueueAccess(
  userId: string,
  queue: ModerationQueue
): Promise<void> {
  if (queue === RESTRICTED_MODERATION_QUEUE && !(await canViewRestrictedQueue(userId))) {
    throw new ModerationCaseAccessError()
  }
}

export async function recordModerationCaseEvent(params: {
  caseId: string
  actorUserId: string
  eventType: string
  payload?: Record<string, unknown>
}): Promise<string> {
  const [row] = await db
    .insert(schema.moderationEvents)
    .values({
      caseId: params.caseId,
      actorUserId: params.actorUserId,
      eventType: params.eventType,
      payload: params.payload ?? {},
    })
    .returning({ id: schema.moderationEvents.id })
  return row.id
}

function restrictedQueueCondition(canViewRestricted: boolean) {
  if (canViewRestricted) return undefined
  return ne(schema.moderationCases.queue, RESTRICTED_MODERATION_QUEUE)
}

export async function getModerationDashboardCounts(userId: string) {
  const canViewRestricted = await canViewRestrictedQueue(userId)
  const conditions = [inArray(schema.moderationCases.status, DASHBOARD_OPEN_CASE_STATUSES)]
  const restrictedFilter = restrictedQueueCondition(canViewRestricted)
  if (restrictedFilter) conditions.push(restrictedFilter)

  const rows = await db
    .select({
      queue: schema.moderationCases.queue,
      severity: schema.moderationCases.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.moderationCases)
    .where(and(...conditions))
    .groupBy(schema.moderationCases.queue, schema.moderationCases.severity)

  const byQueue: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  for (const row of rows) {
    byQueue[row.queue] = (byQueue[row.queue] ?? 0) + row.count
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + row.count
  }

  const openCases = rows.reduce((sum, row) => sum + row.count, 0)

  const queueItemConditions = [eq(schema.moderationQueueItems.status, 'OPEN')]
  if (!canViewRestricted) {
    queueItemConditions.push(ne(schema.moderationQueueItems.queue, RESTRICTED_MODERATION_QUEUE))
  }
  const [queueCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.moderationQueueItems)
    .where(and(...queueItemConditions))

  const { items: recentCases } = await listModerationCases(userId, {
    limit: 5,
    status: MODERATION_CASE_STATUSES.open,
  })

  return {
    byQueueAndSeverity: rows,
    byQueue,
    bySeverity,
    total: openCases,
    openCases,
    openQueueItems: queueCountRow?.count ?? 0,
    nciiUrgentCount: byQueue[MODERATION_QUEUES.nciiUrgent] ?? 0,
    minorSafetyRestrictedCount: canViewRestricted
      ? (byQueue[MODERATION_QUEUES.minorSafetyRestricted] ?? 0)
      : undefined,
    canViewRestrictedQueue: canViewRestricted,
    recentCases: recentCases.map((c) => ({
      id: c.id,
      queue: c.queue,
      severity: c.severity,
      status: c.status,
      policyReason: c.policyReason,
      targetContentType: c.targetContentType,
      createdAt: c.createdAt,
    })),
    trustSafety: {
      mediaPolicy: getMediaPolicyAdminSnapshot(),
      mediaScanner: readMediaScannerStartupConfig(),
    },
  }
}

export async function listModerationQueueItems(
  userId: string,
  opts: { queue?: string; limit?: number; offset?: number }
) {
  await assertRestrictedQueueFilter(userId, opts.queue)

  const canViewRestricted = await canViewRestrictedQueue(userId)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  const conditions = [eq(schema.moderationQueueItems.status, 'OPEN')]
  if (opts.queue) {
    if (!isKnownModerationQueue(opts.queue)) {
      throw new Error('Invalid queue filter')
    }
    conditions.push(eq(schema.moderationQueueItems.queue, opts.queue))
  }
  if (!canViewRestricted) {
    conditions.push(ne(schema.moderationQueueItems.queue, RESTRICTED_MODERATION_QUEUE))
  }

  const rows = await db
    .select({
      id: schema.moderationQueueItems.id,
      caseId: schema.moderationQueueItems.caseId,
      queue: schema.moderationQueueItems.queue,
      severity: schema.moderationQueueItems.severity,
      status: schema.moderationQueueItems.status,
      assignedToUserId: schema.moderationQueueItems.assignedToUserId,
      createdAt: schema.moderationQueueItems.createdAt,
      policyReason: schema.moderationCases.policyReason,
      caseStatus: schema.moderationCases.status,
      targetContentType: schema.moderationCases.targetContentType,
      targetContentId: schema.moderationCases.targetContentId,
    })
    .from(schema.moderationQueueItems)
    .innerJoin(schema.moderationCases, eq(schema.moderationQueueItems.caseId, schema.moderationCases.id))
    .where(and(...conditions))
    .orderBy(desc(schema.moderationQueueItems.createdAt))
    .limit(limit)
    .offset(offset)

  return { items: rows, limit, offset }
}

export async function listModerationCases(
  userId: string,
  opts: { queue?: string; status?: string; severity?: string; limit?: number; offset?: number }
) {
  await assertRestrictedQueueFilter(userId, opts.queue)

  const canViewRestricted = await canViewRestrictedQueue(userId)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  const conditions = []
  if (opts.queue) {
    if (!isKnownModerationQueue(opts.queue)) throw new Error('Invalid queue filter')
    conditions.push(eq(schema.moderationCases.queue, opts.queue))
  }
  if (opts.status) {
    if (!isKnownModerationCaseStatus(opts.status)) throw new Error('Invalid status filter')
    conditions.push(eq(schema.moderationCases.status, opts.status))
  }
  if (opts.severity) {
    if (!isKnownPolicySeverity(opts.severity)) throw new Error('Invalid severity filter')
    conditions.push(eq(schema.moderationCases.severity, opts.severity))
  }
  if (!canViewRestricted) {
    conditions.push(ne(schema.moderationCases.queue, RESTRICTED_MODERATION_QUEUE))
  }

  const rows = await db
    .select({
      id: schema.moderationCases.id,
      targetContentType: schema.moderationCases.targetContentType,
      targetContentId: schema.moderationCases.targetContentId,
      targetUserId: schema.moderationCases.targetUserId,
      policyReason: schema.moderationCases.policyReason,
      severity: schema.moderationCases.severity,
      queue: schema.moderationCases.queue,
      status: schema.moderationCases.status,
      assignedToUserId: schema.moderationCases.assignedToUserId,
      createdAt: schema.moderationCases.createdAt,
      updatedAt: schema.moderationCases.updatedAt,
    })
    .from(schema.moderationCases)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.moderationCases.createdAt))
    .limit(limit)
    .offset(offset)

  return { items: rows, limit, offset }
}

async function loadCaseOrThrow(caseId: string) {
  const [row] = await db
    .select()
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.id, caseId))
    .limit(1)
  if (!row) throw new ModerationCaseNotFoundError()
  return row
}

export async function getModerationCaseDetail(userId: string, caseId: string) {
  const caseRow = await loadCaseOrThrow(caseId)
  await assertCaseQueueAccess(userId, caseRow.queue)

  const [reports, snapshots, events] = await Promise.all([
    db
      .select({
        id: schema.moderationReports.id,
        reporterId: schema.moderationReports.reporterId,
        reporterUsername: schema.users.username,
        policyReason: schema.moderationReports.policyReason,
        body: schema.moderationReports.body,
        duplicateOfReportId: schema.moderationReports.duplicateOfReportId,
        createdAt: schema.moderationReports.createdAt,
      })
      .from(schema.moderationReports)
      .innerJoin(schema.users, eq(schema.moderationReports.reporterId, schema.users.id))
      .where(eq(schema.moderationReports.caseId, caseId))
      .orderBy(desc(schema.moderationReports.createdAt)),
    db
      .select()
      .from(schema.contentSnapshots)
      .where(eq(schema.contentSnapshots.caseId, caseId))
      .orderBy(desc(schema.contentSnapshots.createdAt)),
    db
      .select({
        id: schema.moderationEvents.id,
        eventType: schema.moderationEvents.eventType,
        actorUserId: schema.moderationEvents.actorUserId,
        actorUsername: schema.users.username,
        payload: schema.moderationEvents.payload,
        createdAt: schema.moderationEvents.createdAt,
      })
      .from(schema.moderationEvents)
      .innerJoin(schema.users, eq(schema.moderationEvents.actorUserId, schema.users.id))
      .where(eq(schema.moderationEvents.caseId, caseId))
      .orderBy(desc(schema.moderationEvents.createdAt)),
  ])

  const mediaModeration = await getCaseMediaModerationMeta(caseRow)
  const contextLinks = await resolveModerationCaseContextLinks(
    caseRow.targetContentType,
    caseRow.targetContentId,
    snapshots
  )

  return { case: caseRow, reports, snapshots, events, mediaModeration, contextLinks }
}

export type CaseMediaModerationMeta = {
  mediaAssetId: string
  malwareBlocked: boolean
  canViewBytes: boolean
  uploadStatus: string
}

export async function getCaseMediaModerationMeta(
  caseRow: { targetContentType: string; targetContentId: string }
): Promise<CaseMediaModerationMeta | null> {
  const mediaAssetId = await resolveMediaAssetIdFromCase(
    caseRow.targetContentType,
    caseRow.targetContentId
  )
  if (!mediaAssetId) return null

  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) return null

  const malwareBlocked = await assetHasMalwareBlock(mediaAssetId)
  const servingKey = resolveMediaServingKey(asset)
  const canViewBytes =
    !malwareBlocked &&
    Boolean(servingKey && !servingKey.startsWith('http')) &&
    asset.uploadStatus !== MEDIA_UPLOAD_STATUSES.removed

  return {
    mediaAssetId,
    malwareBlocked,
    canViewBytes,
    uploadStatus: asset.uploadStatus,
  }
}

export async function patchModerationCase(
  userId: string,
  caseId: string,
  patch: { assignedToUserId?: string | null; status?: ModerationCaseStatus }
) {
  const existing = await loadCaseOrThrow(caseId)
  await assertCaseQueueAccess(userId, existing.queue)

  const updates: Partial<typeof schema.moderationCases.$inferInsert> = {
    updatedAt: new Date(),
  }
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = []

  if (patch.assignedToUserId !== undefined) {
    updates.assignedToUserId = patch.assignedToUserId
    events.push({
      eventType: MODERATION_CASE_EVENT_TYPES.assigned,
      payload: {
        previousAssignedToUserId: existing.assignedToUserId,
        assignedToUserId: patch.assignedToUserId,
      },
    })
    await db
      .update(schema.moderationQueueItems)
      .set({ assignedToUserId: patch.assignedToUserId })
      .where(
        and(
          eq(schema.moderationQueueItems.caseId, caseId),
          eq(schema.moderationQueueItems.status, 'OPEN')
        )
      )
  }

  if (patch.status !== undefined) {
    updates.status = patch.status
    events.push({
      eventType: MODERATION_CASE_EVENT_TYPES.statusChanged,
      payload: { previousStatus: existing.status, status: patch.status },
    })
    if (RESOLVED_FROM_QUEUE_CASE_STATUSES.includes(patch.status)) {
      await closeModerationQueueItemsForCase(caseId)
    }
  }

  if (Object.keys(updates).length <= 1) {
    throw new Error('No valid patch fields')
  }

  const [updated] = await db
    .update(schema.moderationCases)
    .set(updates)
    .where(eq(schema.moderationCases.id, caseId))
    .returning()

  for (const event of events) {
    await recordModerationCaseEvent({
      caseId,
      actorUserId: userId,
      eventType: event.eventType,
      payload: event.payload,
    })
  }

  return updated
}

export async function addModerationCaseNote(userId: string, caseId: string, body: string) {
  const existing = await loadCaseOrThrow(caseId)
  await assertCaseQueueAccess(userId, existing.queue)

  const note: ModerationInternalNote = {
    id: randomUUID(),
    authorUserId: userId,
    body,
    createdAt: new Date().toISOString(),
  }
  const prevNotes = Array.isArray(existing.internalNotes) ? existing.internalNotes : []
  const [updated] = await db
    .update(schema.moderationCases)
    .set({
      internalNotes: [...prevNotes, note],
      updatedAt: new Date(),
    })
    .where(eq(schema.moderationCases.id, caseId))
    .returning()

  await recordModerationCaseEvent({
    caseId,
    actorUserId: userId,
    eventType: MODERATION_CASE_EVENT_TYPES.noteAdded,
    payload: { noteId: note.id, bodyPreview: body.slice(0, 200) },
  })

  return updated
}

export type CaseActionType =
  | 'mark_no_violation'
  | 'close_duplicate'
  | 'escalate'
  | 'hide_content'
  | 'delete_content'
  | 'suspend_subject'
  | 'keep_quarantined'
  | 'remove_media'
  | 'restore_media'

const CASE_ACTION_STATUS: Record<
  Exclude<
    CaseActionType,
    'hide_content' | 'delete_content' | 'suspend_subject' | 'keep_quarantined' | 'remove_media' | 'restore_media'
  >,
  ModerationCaseStatus
> = {
  mark_no_violation: MODERATION_CASE_STATUSES.closedNoViolation,
  close_duplicate: MODERATION_CASE_STATUSES.closedDuplicate,
  escalate: MODERATION_CASE_STATUSES.escalated,
}

const CASE_ACTION_EVENT: Record<
  Exclude<
    CaseActionType,
    'hide_content' | 'delete_content' | 'suspend_subject' | 'keep_quarantined' | 'remove_media' | 'restore_media'
  >,
  string
> = {
  mark_no_violation: MODERATION_CASE_EVENT_TYPES.markNoViolation,
  close_duplicate: MODERATION_CASE_EVENT_TYPES.closeDuplicate,
  escalate: MODERATION_CASE_EVENT_TYPES.escalate,
}

const MEDIA_CASE_ACTION_EVENT: Record<
  'keep_quarantined' | 'remove_media' | 'restore_media',
  string
> = {
  keep_quarantined: MODERATION_CASE_EVENT_TYPES.mediaKeptQuarantined,
  remove_media: MODERATION_CASE_EVENT_TYPES.mediaRemoved,
  restore_media: MODERATION_CASE_EVENT_TYPES.mediaRestored,
}

function isMediaCaseTarget(targetContentType: string): boolean {
  return targetContentType === 'media_asset' || targetContentType === 'profile_photo'
}

/** Map case target to executeModerationAction HIDE_CONTENT params, if supported. */
export function resolveHideContentExecuteTarget(
  targetContentType: string,
  targetContentId: string
): { targetType: string; targetId: string; contentKind: string } | null {
  switch (targetContentType) {
    case 'org_forum_reply':
    case 'group_reply':
    case 'comment':
      return { targetType: 'forum_post', targetId: targetContentId, contentKind: 'forum_post' }
    case 'org_chat_message':
      return {
        targetType: 'org_channel_message',
        targetId: targetContentId,
        contentKind: 'org_channel_message',
      }
    default:
      return null
  }
}

export async function executeModerationCaseAction(
  userId: string,
  caseId: string,
  action: CaseActionType,
  note?: string,
  opts?: { hardDelete?: boolean; suspendPermanent?: boolean }
) {
  const existing = await loadCaseOrThrow(caseId)
  await assertCaseQueueAccess(userId, existing.queue)

  if (action === 'keep_quarantined' || action === 'remove_media' || action === 'restore_media') {
    if (!isMediaCaseTarget(existing.targetContentType)) {
      await recordModerationCaseEvent({
        caseId,
        actorUserId: userId,
        eventType: MODERATION_CASE_EVENT_TYPES.actionUnsupported,
        payload: {
          action,
          targetContentType: existing.targetContentType,
          targetContentId: existing.targetContentId,
          note: note ?? null,
        },
      })
      return {
        ok: false as const,
        unsupported: true,
        error: `Action ${action} is not supported for target type ${existing.targetContentType}`,
      }
    }

    if ((action === 'remove_media' || action === 'restore_media') && !note?.trim()) {
      throw new Error(`Reason required for ${action}`)
    }

    const mediaAssetId = await resolveMediaAssetIdFromCase(
      existing.targetContentType,
      existing.targetContentId
    )
    if (!mediaAssetId) {
      return {
        ok: false as const,
        unsupported: true,
        error: 'Could not resolve media asset for this case',
      }
    }

    if (action === 'keep_quarantined') {
      await keepMediaQuarantined(userId, mediaAssetId)
    } else if (action === 'remove_media') {
      await removeMediaAssetByModerator(userId, mediaAssetId, note!.trim())
    } else {
      await restoreMediaAssetByModerator(userId, mediaAssetId, note!.trim())
    }

    const [updated] = await db
      .update(schema.moderationCases)
      .set({
        status: MODERATION_CASE_STATUSES.actioned,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationCases.id, caseId))
      .returning()

    await recordModerationCaseEvent({
      caseId,
      actorUserId: userId,
      eventType: MEDIA_CASE_ACTION_EVENT[action],
      payload: {
        action,
        mediaAssetId,
        targetContentType: existing.targetContentType,
        targetContentId: existing.targetContentId,
        note: note ?? null,
      },
    })

    if (action !== 'restore_media') {
      await closeModerationQueueItemsForCase(caseId)
      const { notifyCaseReportersReviewed } = await import('./moderation-notify.js')
      await notifyCaseReportersReviewed(caseId).catch(() => {})
    }

    return { ok: true as const, case: updated, mediaAssetId }
  }

  if (action === 'hide_content') {
    const hideTarget = resolveHideContentExecuteTarget(
      existing.targetContentType,
      existing.targetContentId
    )
    if (!hideTarget) {
      await recordModerationCaseEvent({
        caseId,
        actorUserId: userId,
        eventType: MODERATION_CASE_EVENT_TYPES.actionUnsupported,
        payload: {
          action,
          targetContentType: existing.targetContentType,
          targetContentId: existing.targetContentId,
          note: note ?? null,
        },
      })
      return {
        ok: false as const,
        unsupported: true,
        error: `Hide content is not supported for target type ${existing.targetContentType}`,
      }
    }

    const [actionRow] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: 'HIDE_CONTENT',
        targetType: hideTarget.targetType,
        targetId: hideTarget.targetId,
        proposedByUserId: userId,
        status: 'EXECUTED',
        requiredApprovals: 1,
        caseId,
        payload: { contentKind: hideTarget.contentKind, scopeType: 'platform' },
        executedAt: new Date(),
      })
      .returning()

    await executeModerationAction(actionRow, userId)

    const [updated] = await db
      .update(schema.moderationCases)
      .set({
        status: MODERATION_CASE_STATUSES.actioned,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationCases.id, caseId))
      .returning()

    await recordModerationCaseEvent({
      caseId,
      actorUserId: userId,
      eventType: MODERATION_CASE_EVENT_TYPES.hideContent,
      payload: {
        action,
        moderationActionId: actionRow.id,
        targetContentType: existing.targetContentType,
        note: note ?? null,
      },
    })

    const { notifyCaseReportersReviewed } = await import('./moderation-notify.js')
    await notifyCaseReportersReviewed(caseId).catch(() => {})

    await closeModerationQueueItemsForCase(caseId)

    return { ok: true as const, case: updated, moderationActionId: actionRow.id }
  }

  if (action === 'delete_content') {
    if (!note?.trim()) throw new Error('Reason required for delete_content')

    await preserveModerationEvidence({
      actorUserId: userId,
      targetType: existing.targetContentType,
      targetId: existing.targetContentId,
      caseId,
      note: note.trim(),
    })

    const deleteResult = await deleteModerationContent({
      actorUserId: userId,
      targetType: existing.targetContentType,
      targetId: existing.targetContentId,
      hardDelete: opts?.hardDelete,
      reason: note.trim(),
    })
    if (!deleteResult.ok) {
      await recordModerationCaseEvent({
        caseId,
        actorUserId: userId,
        eventType: MODERATION_CASE_EVENT_TYPES.actionUnsupported,
        payload: {
          action,
          targetContentType: existing.targetContentType,
          targetContentId: existing.targetContentId,
          note: note ?? null,
          error: deleteResult.error,
        },
      })
      return {
        ok: false as const,
        unsupported: true,
        error: deleteResult.error,
      }
    }

    const [updated] = await db
      .update(schema.moderationCases)
      .set({
        status: MODERATION_CASE_STATUSES.actioned,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationCases.id, caseId))
      .returning()

    await recordModerationCaseEvent({
      caseId,
      actorUserId: userId,
      eventType: MODERATION_CASE_EVENT_TYPES.deleteContent,
      payload: {
        action,
        mode: deleteResult.mode,
        targetContentType: existing.targetContentType,
        note: note ?? null,
      },
    })

    await closeModerationQueueItemsForCase(caseId)
    const { notifyCaseReportersReviewed } = await import('./moderation-notify.js')
    await notifyCaseReportersReviewed(caseId).catch(() => {})

    return { ok: true as const, case: updated, deleteMode: deleteResult.mode }
  }

  if (action === 'suspend_subject') {
    if (!note?.trim()) throw new Error('Reason required for suspend_subject')
    if (opts?.suspendPermanent && !(await isSiteAdmin(userId))) {
      throw new ModerationCaseAccessError('Permanent suspension requires site admin access')
    }

    const subjectUserId =
      existing.targetUserId ??
      (await resolveContentAuthorUserId(existing.targetContentType, existing.targetContentId))
    if (!subjectUserId) {
      return {
        ok: false as const,
        unsupported: true,
        error: 'Could not resolve subject user for this case',
      }
    }

    await suspendModerationSubject({
      actorUserId: userId,
      subjectUserId,
      reason: note.trim(),
      permanent: opts?.suspendPermanent,
    })

    const [updated] = await db
      .update(schema.moderationCases)
      .set({
        status: MODERATION_CASE_STATUSES.actioned,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationCases.id, caseId))
      .returning()

    await recordModerationCaseEvent({
      caseId,
      actorUserId: userId,
      eventType: MODERATION_CASE_EVENT_TYPES.suspendSubject,
      payload: {
        action,
        subjectUserId,
        permanent: Boolean(opts?.suspendPermanent),
        note: note ?? null,
      },
    })

    await closeModerationQueueItemsForCase(caseId)
    const { notifyCaseReportersReviewed } = await import('./moderation-notify.js')
    await notifyCaseReportersReviewed(caseId).catch(() => {})

    return { ok: true as const, case: updated, subjectUserId }
  }

  const nextStatus = CASE_ACTION_STATUS[action]

  let approvedMediaAssetId: string | null = null
  if (action === 'mark_no_violation' && isMediaCaseTarget(existing.targetContentType)) {
    const mediaAssetId = await resolveMediaAssetIdFromCase(
      existing.targetContentType,
      existing.targetContentId
    )
    if (mediaAssetId) {
      await approveMediaAssetByModerator(userId, mediaAssetId)
      approvedMediaAssetId = mediaAssetId
    }
  }

  const [updated] = await db
    .update(schema.moderationCases)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(schema.moderationCases.id, caseId))
    .returning()

  if (TERMINAL_CASE_STATUSES.includes(nextStatus)) {
    await closeModerationQueueItemsForCase(caseId)
  }

  await recordModerationCaseEvent({
    caseId,
    actorUserId: userId,
    eventType: CASE_ACTION_EVENT[action],
    payload: {
      action,
      previousStatus: existing.status,
      status: nextStatus,
      note: note ?? null,
      mediaAssetId: approvedMediaAssetId,
    },
  })

  if (TERMINAL_CASE_STATUSES.includes(nextStatus)) {
    const { notifyCaseReportersReviewed } = await import('./moderation-notify.js')
    await notifyCaseReportersReviewed(caseId).catch(() => {})
  }

  return {
    ok: true as const,
    case: updated,
    ...(approvedMediaAssetId ? { mediaAssetId: approvedMediaAssetId } : {}),
  }
}

export { moderationCaseStatusSchema }
