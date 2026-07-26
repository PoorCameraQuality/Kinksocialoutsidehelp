import { NOTIFICATION_TYPES } from '@c2k/shared'
import { createNotification } from './create-notification.js'
import { listPlatformModeratorUserIds } from './platform-staff.js'

export async function notifyModerationReportEscalated(reportId: string, targetType: string): Promise<void> {
  const modIds = await listPlatformModeratorUserIds()
  await Promise.all(
    modIds.map((userId) =>
      createNotification(userId, NOTIFICATION_TYPES.moderationReportEscalated, {
        reportId,
        targetType,
      })
    )
  )
}

export async function notifyModerationActionPending(
  actionId: string,
  excludeUserId: string
): Promise<void> {
  const modIds = (await listPlatformModeratorUserIds()).filter((id) => id !== excludeUserId)
  await Promise.all(
    modIds.map((userId) =>
      createNotification(userId, NOTIFICATION_TYPES.moderationActionPending, { actionId })
    )
  )
}

export async function notifyOrgModerationNeeded(
  orgId: string,
  orgSlug: string,
  moderatorUserIds: string[],
  reportId: string
): Promise<void> {
  await Promise.all(
    moderatorUserIds.map((userId) =>
      createNotification(userId, NOTIFICATION_TYPES.orgModerationNeeded, {
        orgId,
        orgSlug,
        reportId,
      })
    )
  )
}

export async function notifyP0ModerationCaseCreated(
  caseId: string,
  policyReason: string,
  queue: string
): Promise<void> {
  const modIds = await listPlatformModeratorUserIds()
  await Promise.all(
    modIds.map((userId) =>
      createNotification(userId, NOTIFICATION_TYPES.p0ModerationCaseCreated, {
        caseId,
        policyReason,
        queue,
      })
    )
  )
}

/** Generic reporter feedback - avoids revealing enforcement details. */
export async function notifyReportReviewed(reporterUserId: string, reportId: string): Promise<void> {
  await createNotification(reporterUserId, NOTIFICATION_TYPES.reportReviewed, {
    reportId,
    message: 'Your report was reviewed.',
  })
}

export async function notifyCaseReportersReviewed(caseId: string): Promise<void> {
  const { db, schema } = await import('../db/index.js')
  const { eq } = await import('drizzle-orm')
  const rows = await db
    .select({ reporterId: schema.moderationReports.reporterId, reportId: schema.moderationReports.id })
    .from(schema.moderationReports)
    .where(eq(schema.moderationReports.caseId, caseId))
  await Promise.all(
    rows.map((row) => notifyReportReviewed(row.reporterId, row.reportId).catch(() => {}))
  )
}
