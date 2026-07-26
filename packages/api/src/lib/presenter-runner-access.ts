import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const RUNNER_ORG_ROLES = ['OWNER', 'ADMIN', 'MODERATOR'] as const

/**
 * True if the viewer may see `presenter_offerings.runner_materials`:
 * the presenter themself, or org OWNER/ADMIN/MODERATOR for an org that either
 * (a) runs a convention where this presenter is on the program, or
 * (b) has an APPROVED `convention_presenter_requests` row for this presenter.
 */
export async function canAccessPresenterRunnerMaterials(
  viewerId: string | null,
  presenterUserId: string
): Promise<boolean> {
  if (!viewerId) return false
  if (viewerId === presenterUserId) return true

  const modOrgs = await db
    .select({ organizationId: schema.organizationMembers.organizationId })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.userId, viewerId),
        inArray(schema.organizationMembers.role, [...RUNNER_ORG_ROLES])
      )
    )
  const orgIds = [...new Set(modOrgs.map((r) => r.organizationId))]
  if (orgIds.length === 0) return false

  const [onProgram] = await db
    .select({ one: sql`1` })
    .from(schema.scheduleSlotPresenters)
    .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlotPresenters.scheduleSlotId, schema.scheduleSlots.id))
    .innerJoin(schema.conventions, eq(schema.scheduleSlots.conventionId, schema.conventions.id))
    .where(
      and(
        eq(schema.scheduleSlotPresenters.userId, presenterUserId),
        inArray(schema.conventions.organizationId, orgIds)
      )
    )
    .limit(1)

  if (onProgram) return true

  const [approvedReq] = await db
    .select({ one: sql`1` })
    .from(schema.conventionPresenterRequests)
    .innerJoin(schema.conventions, eq(schema.conventionPresenterRequests.conventionId, schema.conventions.id))
    .where(
      and(
        eq(schema.conventionPresenterRequests.presenterUserId, presenterUserId),
        eq(schema.conventionPresenterRequests.status, 'APPROVED'),
        inArray(schema.conventions.organizationId, orgIds)
      )
    )
    .limit(1)

  return Boolean(approvedReq)
}
