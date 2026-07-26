/**
 * Event feed activities — Following/Home viewer filtering and metadata redaction.
 */
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'
import { canViewerSeeGroupEvent, getGroupMembership } from './group-access.js'
import { viewerCanPatchEvent } from './virtual-event-join-visibility.js'

const EVENT_ACTIVITY_VERBS = new Set(['event_created', 'event_rsvp'])

export type EventActivityRow = {
  id: string
  actorId: string
  verb?: string
  objectId?: string
  metadata?: Record<string, unknown>
}

/** Plain-language attendee list visibility for RSVP orientation copy. */
export function summarizeAttendeeListVisibility(
  visibility: string | null | undefined,
  opts?: { viewerIsHost?: boolean; viewerIsGoing?: boolean },
): string | null {
  if (visibility === 'count_only') {
    if (opts?.viewerIsHost) return 'Only hosts can see attendee names (counts are public)'
    if (opts?.viewerIsGoing) return 'Attendees can see each other; others see counts only'
    return 'Only hosts can see attendees'
  }
  if (visibility === 'public') return 'Public attendee list'
  return null
}

/** Whether RSVP feed activity may reveal the actor's attendance to this viewer. */
export function canViewerSeeEventRsvpActivity(
  viewerId: string,
  event: { hostId: string; attendeeListVisibility: string },
  actorId: string,
  opts: { viewerHasGoingRsvp: boolean },
): boolean {
  if (event.attendeeListVisibility !== 'count_only') return true
  if (viewerId === actorId) return true
  if (viewerId === event.hostId) return true
  if (opts.viewerHasGoingRsvp) return true
  return false
}

/** Remove raw venue from feed activity objects (use publicLocationSummary when present). */
export function sanitizeEventActivityObjectForViewer(
  object: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...object }
  delete out.location
  return out
}

async function canViewerSeeEventForFeed(
  viewerId: string,
  event: {
    id: string
    visibility: string
    hostId: string
    groupId: string | null
    organizationId: string | null
    attendeeListVisibility: string
  },
  actorId: string,
  opts: {
    isGroupMember: boolean
    viewerHasGoingRsvp: boolean
    isOrgMember: boolean
  },
): Promise<boolean> {
  if (event.visibility === 'public') {
    if (event.groupId) {
      return canViewerSeeGroupEvent(viewerId, event, opts.isGroupMember)
    }
    return true
  }
  if (!viewerId) return false
  if (event.hostId === viewerId) return true
  if (actorId === viewerId) return true
  if (opts.viewerHasGoingRsvp) return true
  if (event.groupId && opts.isGroupMember) return true
  if (event.organizationId && opts.isOrgMember) return true
  if (await viewerCanPatchEvent(viewerId, event)) return true
  return false
}

export async function filterRowsForEventActivity<T extends EventActivityRow>(
  viewerId: string,
  rows: T[],
): Promise<T[]> {
  const eventRows = rows.filter((r) => r.verb && EVENT_ACTIVITY_VERBS.has(r.verb))
  if (eventRows.length === 0) return rows

  const [blockedByViewer, viewersBlockers] = await Promise.all([
    loadBlockedUserIds(viewerId),
    loadUserIdsWhoBlockedUser(viewerId),
  ])
  const blockedActorIds = new Set<string>([...blockedByViewer, ...viewersBlockers])

  const eventIds = [
    ...new Set(eventRows.map((r) => r.objectId).filter((id): id is string => Boolean(id))),
  ]
  if (eventIds.length === 0) {
    return rows.filter((r) => !r.verb || !EVENT_ACTIVITY_VERBS.has(r.verb))
  }

  const events = await db
    .select({
      id: schema.events.id,
      visibility: schema.events.visibility,
      hostId: schema.events.hostId,
      groupId: schema.events.groupId,
      organizationId: schema.events.organizationId,
      attendeeListVisibility: schema.events.attendeeListVisibility,
    })
    .from(schema.events)
    .where(inArray(schema.events.id, eventIds))

  const eventById = new Map(events.map((e) => [e.id, e]))

  const groupIds = [...new Set(events.map((e) => e.groupId).filter((id): id is string => Boolean(id)))]
  const orgIds = [...new Set(events.map((e) => e.organizationId).filter((id): id is string => Boolean(id)))]

  const [groupMemberships, orgMemberships, viewerRsvps] = await Promise.all([
    groupIds.length > 0 ?
      db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, viewerId),
            inArray(schema.groupMembers.groupId, groupIds),
          ),
        )
    : Promise.resolve([]),
    orgIds.length > 0 ?
      db
        .select({ organizationId: schema.organizationMembers.organizationId })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.userId, viewerId),
            inArray(schema.organizationMembers.organizationId, orgIds),
          ),
        )
    : Promise.resolve([]),
    db
      .select({ eventId: schema.eventRsvps.eventId, status: schema.eventRsvps.status })
      .from(schema.eventRsvps)
      .where(
        and(eq(schema.eventRsvps.userId, viewerId), inArray(schema.eventRsvps.eventId, eventIds)),
      ),
  ])

  const memberGroupIds = new Set(groupMemberships.map((m) => m.groupId))
  const memberOrgIds = new Set(orgMemberships.map((m) => m.organizationId))
  const goingEventIds = new Set(
    viewerRsvps.filter((r) => r.status === 'going').map((r) => r.eventId),
  )

  const deny = new Set<string>()

  for (const row of eventRows) {
    if (row.actorId !== viewerId && blockedActorIds.has(row.actorId)) {
      deny.add(row.id)
      continue
    }
    const eventId = row.objectId
    if (!eventId) {
      deny.add(row.id)
      continue
    }
    const event = eventById.get(eventId)
    if (!event) {
      deny.add(row.id)
      continue
    }

    const isGroupMember = event.groupId ? memberGroupIds.has(event.groupId) : false
    const isOrgMember = event.organizationId ? memberOrgIds.has(event.organizationId) : false
    const viewerHasGoingRsvp = goingEventIds.has(eventId)

    const canSeeEvent = await canViewerSeeEventForFeed(viewerId, event, row.actorId, {
      isGroupMember,
      viewerHasGoingRsvp,
      isOrgMember,
    })
    if (!canSeeEvent) {
      deny.add(row.id)
      continue
    }

    if (
      row.verb === 'event_rsvp' &&
      !canViewerSeeEventRsvpActivity(viewerId, event, row.actorId, { viewerHasGoingRsvp })
    ) {
      deny.add(row.id)
    }
  }

  return rows.filter((r) => !r.verb || !EVENT_ACTIVITY_VERBS.has(r.verb) || !deny.has(r.id))
}
