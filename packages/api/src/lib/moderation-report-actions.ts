import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isSiteAdmin } from './platform-staff.js'
import {
  deleteModerationContent,
  preserveModerationEvidence,
  resolveContentAuthorUserId,
  suspendModerationSubject,
} from './moderation-content-enforcement.js'

export type ReportEnforcementAction = 'delete_content' | 'suspend_subject' | 'delete_and_suspend'

export class ReportActionError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 422 = 422,
  ) {
    super(message)
    this.name = 'ReportActionError'
  }
}

export async function executeModerationReportAction(params: {
  actorUserId: string
  reportId: string
  action: ReportEnforcementAction
  note: string
  preserveEvidence?: boolean
  hardDelete?: boolean
  suspendPermanent?: boolean
}) {
  const [report] = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, params.reportId))
    .limit(1)
  if (!report) throw new ReportActionError('Not found', 404)

  const note = params.note.trim()
  if (!note) throw new ReportActionError('Reason note is required', 400)

  if (params.suspendPermanent && !(await isSiteAdmin(params.actorUserId))) {
    throw new ReportActionError('Permanent suspension requires site admin access', 403)
  }

  if (params.preserveEvidence !== false) {
    await preserveModerationEvidence({
      actorUserId: params.actorUserId,
      targetType: report.targetType,
      targetId: report.targetId,
      reportId: report.id,
      category: report.category,
      reportBody: report.body,
      note,
    })
  }

  let deleteResult: Awaited<ReturnType<typeof deleteModerationContent>> | null = null
  let suspendedUserId: string | null = null

  if (params.action === 'delete_content' || params.action === 'delete_and_suspend') {
    deleteResult = await deleteModerationContent({
      actorUserId: params.actorUserId,
      targetType: report.targetType,
      targetId: report.targetId,
      hardDelete: params.hardDelete,
      reason: note,
    })
    if (!deleteResult.ok) {
      throw new ReportActionError(deleteResult.error, 422)
    }
  }

  if (params.action === 'suspend_subject' || params.action === 'delete_and_suspend') {
    const subjectUserId = await resolveContentAuthorUserId(report.targetType, report.targetId)
    if (!subjectUserId) {
      throw new ReportActionError('Could not resolve subject user for this report target', 422)
    }
    await suspendModerationSubject({
      actorUserId: params.actorUserId,
      subjectUserId,
      reason: note,
      permanent: params.suspendPermanent,
    })
    suspendedUserId = subjectUserId
  }

  const prevMeta =
    report.meta && typeof report.meta === 'object' && !Array.isArray(report.meta)
      ? (report.meta as Record<string, unknown>)
      : {}

  const [updated] = await db
    .update(schema.reports)
    .set({
      status: 'RESOLVED',
      meta: {
        ...prevMeta,
        moderatorNote: note,
        lastEnforcementAction: params.action,
        lastActionBy: params.actorUserId,
        lastActionAt: new Date().toISOString(),
        ...(deleteResult?.ok ? { contentDeleteMode: deleteResult.mode } : {}),
        ...(suspendedUserId ? { suspendedUserId } : {}),
      },
    })
    .where(eq(schema.reports.id, params.reportId))
    .returning()

  return {
    report: updated,
    deleteResult,
    suspendedUserId,
  }
}
