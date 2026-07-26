import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isBlockedPair } from './blocks.js'
import { canViewerSeeGroupEvent, getGroupMembership } from './group-access.js'
import { isOrgMember } from './org-visibility.js'
import { viewerCanPatchEvent } from './virtual-event-join-visibility.js'

export type EventDetailAccessRow = {
  id: string
  visibility: string
  hostId: string
  groupId: string | null
  organizationId: string | null
}

async function viewerHasAnyRsvp(eventId: string, viewerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.eventRsvps.id })
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, viewerId)))
    .limit(1)
  return Boolean(row)
}

/**
 * Whether a viewer may load `GET /api/v1/events/:eventId`.
 * UUID possession is not authorization — private events return false for unauthorized viewers.
 */
export async function canViewerSeeEventDetail(
  viewerId: string | null,
  event: EventDetailAccessRow,
): Promise<boolean> {
  if (viewerId && (await isBlockedPair(viewerId, event.hostId))) {
    return false
  }

  const isGroupMember =
    event.groupId && viewerId ?
      Boolean(await getGroupMembership(event.groupId, viewerId))
    : false

  if (event.groupId && !(await canViewerSeeGroupEvent(viewerId, event, isGroupMember))) {
    return false
  }

  if (event.visibility === 'public') {
    return true
  }

  if (!viewerId) return false
  if (event.hostId === viewerId) return true
  // Private group events: members already cleared canViewerSeeGroupEvent above.
  if (isGroupMember) return true

  if (event.organizationId) {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, event.organizationId))
      .limit(1)
    if (org && (await isOrgMember(org, viewerId))) return true
  }

  if (await viewerCanPatchEvent(viewerId, event)) return true

  if (await viewerHasAnyRsvp(event.id, viewerId)) return true

  return false
}
