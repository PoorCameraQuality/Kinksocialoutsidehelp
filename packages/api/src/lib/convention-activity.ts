/**
 * Convention-adjacent feed activities — Following/Home viewer filtering and metadata redaction.
 */
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'
import { resolveConventionCommandAccess } from './convention-command-access.js'
import {
  isPublicProgramListing,
  publicProgramViewerFromAccess,
  slotVisibleOnPublicProgram,
  type PublicProgramSlot,
} from './convention-program-policy.js'

const CONVENTION_ACTIVITY_VERBS = new Set(['convention_pin', 'presenter_assigned'])

export type ConventionActivityRow = {
  id: string
  actorId: string
  verb?: string
  objectId?: string
  objectType?: string
  metadata?: Record<string, unknown>
}

export type ConventionHubAccess = {
  canView: boolean
  canManage: boolean
  isStaff: boolean
}

/** Hub access for a viewer on an org-owned convention (mirrors getConventionWithAccess). */
export async function loadConventionHubAccessForViewer(
  conv: { id: string; organizationId: string | null },
  viewerId: string,
): Promise<ConventionHubAccess> {
  if (!conv.organizationId) {
    return { canView: false, canManage: false, isStaff: false }
  }
  const [grant] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conv.id),
        eq(schema.conventionAccessGrants.userId, viewerId),
      ),
    )
    .limit(1)
  const commandAccess = await resolveConventionCommandAccess(
    conv as typeof schema.conventions.$inferSelect,
    viewerId,
  )
  const hasPaidAccess = Boolean(grant && grant.paidConfirmed && grant.attendingConfirmed)
  const isStaff = Boolean(grant && (grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess))
  const canManage = Boolean(commandAccess.permissions.isFullAdmin || commandAccess.hasAnyAccess)
  return {
    canView: hasPaidAccess || isStaff || canManage,
    canManage,
    isStaff,
  }
}

/** Whether a convention pin activity may appear for this viewer. */
export function canViewerSeeConventionPinActivity(
  viewerId: string,
  actorId: string,
  access: ConventionHubAccess,
): boolean {
  if (viewerId === actorId) return true
  return access.canView || access.canManage
}

/** Whether a presenter assignment activity may appear for this viewer. */
export function canViewerSeePresenterAssignedActivity(
  viewerId: string,
  actorId: string,
  slot: PublicProgramSlot & { isPublished: boolean },
  opts: {
    listingPublic: boolean
    access: ConventionHubAccess
  },
): boolean {
  if (viewerId === actorId) return true
  if (!opts.listingPublic && !opts.access.canView && !opts.access.canManage) return false
  const includeStaffOnProgram = opts.access.canManage || opts.access.isStaff
  const programViewer = publicProgramViewerFromAccess(includeStaffOnProgram, viewerId)
  return slotVisibleOnPublicProgram(slot, programViewer)
}

/** Strip sensitive fields from convention activity feed objects. */
export function sanitizeConventionActivityObjectForViewer(
  object: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...object }
  delete out.location
  return out
}

export async function filterRowsForConventionActivity<T extends ConventionActivityRow>(
  viewerId: string,
  rows: T[],
): Promise<T[]> {
  const conventionRows = rows.filter((r) => r.verb && CONVENTION_ACTIVITY_VERBS.has(r.verb))
  if (conventionRows.length === 0) return rows

  const [blockedByViewer, viewersBlockers] = await Promise.all([
    loadBlockedUserIds(viewerId),
    loadUserIdsWhoBlockedUser(viewerId),
  ])
  const blockedActorIds = new Set<string>([...blockedByViewer, ...viewersBlockers])

  const pinConventionIds = [
    ...new Set(
      conventionRows
        .filter((r) => r.verb === 'convention_pin' && r.objectType === 'convention')
        .map((r) => r.objectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const presenterSlotIds = [
    ...new Set(
      conventionRows
        .filter((r) => r.verb === 'presenter_assigned' && r.objectType === 'schedule_slot')
        .map((r) => r.objectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const slots =
    presenterSlotIds.length > 0 ?
      await db
        .select({
          id: schema.scheduleSlots.id,
          conventionId: schema.scheduleSlots.conventionId,
          isPublished: schema.scheduleSlots.isPublished,
          visibility: schema.scheduleSlots.visibility,
        })
        .from(schema.scheduleSlots)
        .where(inArray(schema.scheduleSlots.id, presenterSlotIds))
    : []

  const slotById = new Map(slots.map((s) => [s.id, s]))
  const conventionIds = [
    ...new Set([
      ...pinConventionIds,
      ...slots.map((s) => s.conventionId),
    ]),
  ]

  const conventions =
    conventionIds.length > 0 ?
      await db
        .select({
          id: schema.conventions.id,
          organizationId: schema.conventions.organizationId,
          settings: schema.conventions.settings,
        })
        .from(schema.conventions)
        .where(inArray(schema.conventions.id, conventionIds))
    : []

  const conventionById = new Map(conventions.map((c) => [c.id, c]))
  const accessByConventionId = new Map<string, ConventionHubAccess>()
  await Promise.all(
    conventions.map(async (conv) => {
      accessByConventionId.set(conv.id, await loadConventionHubAccessForViewer(conv, viewerId))
    }),
  )

  const deny = new Set<string>()

  for (const row of conventionRows) {
    if (row.actorId !== viewerId && blockedActorIds.has(row.actorId)) {
      deny.add(row.id)
      continue
    }

    if (row.verb === 'convention_pin') {
      const conventionId = row.objectId
      if (!conventionId) {
        deny.add(row.id)
        continue
      }
      const conv = conventionById.get(conventionId)
      if (!conv?.organizationId) {
        deny.add(row.id)
        continue
      }
      const access = accessByConventionId.get(conventionId) ?? {
        canView: false,
        canManage: false,
        isStaff: false,
      }
      if (!canViewerSeeConventionPinActivity(viewerId, row.actorId, access)) {
        deny.add(row.id)
      }
      continue
    }

    if (row.verb === 'presenter_assigned') {
      const slotId = row.objectId
      if (!slotId) {
        deny.add(row.id)
        continue
      }
      const slot = slotById.get(slotId)
      if (!slot) {
        deny.add(row.id)
        continue
      }
      const conv = conventionById.get(slot.conventionId)
      if (!conv?.organizationId) {
        deny.add(row.id)
        continue
      }
      const access = accessByConventionId.get(conv.id) ?? {
        canView: false,
        canManage: false,
        isStaff: false,
      }
      const listingPublic = isPublicProgramListing(conv.settings)
      if (
        !canViewerSeePresenterAssignedActivity(viewerId, row.actorId, slot, {
          listingPublic,
          access,
        })
      ) {
        deny.add(row.id)
      }
    }
  }

  return rows.filter((r) => !r.verb || !CONVENTION_ACTIVITY_VERBS.has(r.verb) || !deny.has(r.id))
}
