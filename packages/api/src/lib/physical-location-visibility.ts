import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isVirtualHttpsJoinLocation } from './virtual-event-join-visibility.js'

const ORG_EVENT_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

export type PhysicalLocationRow = {
  id: string
  hostId: string
  organizationId: string | null
  eventFormat: string
  locationVisibility: string
}

/**
 * Event IDs where the viewer may see full in-person `location` (not public tier).
 */
export async function physicalLocationDetailVisibleEventIds(
  viewerId: string | null,
  rows: PhysicalLocationRow[]
): Promise<Set<string>> {
  const visible = new Set<string>()
  if (!viewerId) return visible

  const gated = rows.filter(
    (r) => r.eventFormat === 'in-person' && r.locationVisibility !== 'public' && r.locationVisibility
  )
  if (gated.length === 0) return visible

  for (const r of gated) {
    if (r.hostId === viewerId) visible.add(r.id)
  }

  const orgIds = [...new Set(gated.map((r) => r.organizationId).filter(Boolean))] as string[]
  if (orgIds.length > 0) {
    const memberships = await db
      .select({
        organizationId: schema.organizationMembers.organizationId,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.userId, viewerId),
          inArray(schema.organizationMembers.organizationId, orgIds)
        )
      )
    const modOrgs = new Set(
      memberships
        .filter((m) => (ORG_EVENT_ROLE_RANK[m.role] ?? 0) >= ORG_EVENT_ROLE_RANK.MODERATOR)
        .map((m) => m.organizationId)
    )
    for (const r of gated) {
      if (r.organizationId && modOrgs.has(r.organizationId)) visible.add(r.id)
    }
  }

  const pending = gated.filter((r) => !visible.has(r.id)).map((r) => r.id)
  if (pending.length === 0) return visible

  const rsvpRows = await db
    .select({
      eventId: schema.eventRsvps.eventId,
      status: schema.eventRsvps.status,
      rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
    })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.userId, viewerId),
        inArray(schema.eventRsvps.eventId, pending),
        inArray(schema.eventRsvps.status, ['going', 'maybe'])
      )
    )

  const byEvent = new Map<string, { status: string; rsvpApprovalStatus: string }>()
  for (const rv of rsvpRows) {
    byEvent.set(rv.eventId, { status: rv.status, rsvpApprovalStatus: rv.rsvpApprovalStatus })
  }

  for (const r of gated) {
    if (visible.has(r.id)) continue
    const rv = byEvent.get(r.id)
    if (!rv) continue
    if (r.locationVisibility === 'rsvp') {
      visible.add(r.id)
      continue
    }
    if (r.locationVisibility === 'approved' && rv.rsvpApprovalStatus === 'approved') {
      visible.add(r.id)
    }
  }

  return visible
}

export type EventLocationRedactionRow = {
  id: string
  hostId: string
  organizationId: string | null
  eventFormat: string
  location: string | null
  locationVisibility: string | null
  publicLocationSummary: string | null
}

export function applyEventLocationRedaction<Row extends EventLocationRedactionRow>(
  row: Row,
  virtualJoinVisible: Set<string>,
  physicalDetailVisible: Set<string>
): Row & { hasVirtualJoinLink: boolean; joinLinkRedacted: boolean; locationRedacted: boolean } {
  const hasVirtualJoinLink = isVirtualHttpsJoinLocation(row.eventFormat, row.location)
  const joinLinkRedacted = hasVirtualJoinLink && !virtualJoinVisible.has(row.id)
  const vis = row.locationVisibility ?? 'public'
  const physicalDetailRedacted =
    row.eventFormat === 'in-person' && vis !== 'public' && !physicalDetailVisible.has(row.id)
  const locationRedacted = physicalDetailRedacted
  let location: string | null = row.location
  if (joinLinkRedacted) location = null
  else if (locationRedacted) location = null
  return {
    ...row,
    location,
    locationVisibility: vis,
    publicLocationSummary: row.publicLocationSummary,
    hasVirtualJoinLink,
    joinLinkRedacted,
    locationRedacted,
  }
}
