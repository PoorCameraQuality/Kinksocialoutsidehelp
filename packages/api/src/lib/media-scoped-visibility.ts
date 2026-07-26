/**
 * Scoped media visibility: GROUP_ONLY, ORG_ONLY, EVENT_ATTENDEES, CONVENTION_ATTENDEES.
 * Reuses existing group/org/event/convention access helpers.
 */
import { MEDIA_VISIBILITIES } from '@c2k/shared'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { MediaAsset, MediaItem } from '../db/schema.js'
import { getGroupMembership } from './group-access.js'
import { isOrgMember } from './org-visibility.js'
import { viewerCanPatchEvent } from './virtual-event-join-visibility.js'

const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

type ScopedMediaItem = Pick<
  MediaItem,
  'visibility' | 'sourceGroupId' | 'sourceEventId' | 'sourceConventionId'
>
type ScopedMediaAsset = Pick<MediaAsset, 'ownerType' | 'ownerId'>

export async function resolveMediaItemOrganizationId(
  item: Pick<MediaItem, 'sourceGroupId' | 'sourceEventId' | 'sourceConventionId'>,
  asset: ScopedMediaAsset,
): Promise<string | null> {
  if (asset.ownerType === 'organization') return asset.ownerId

  if (item.sourceConventionId) {
    const [conv] = await db
      .select({ organizationId: schema.conventions.organizationId })
      .from(schema.conventions)
      .where(eq(schema.conventions.id, item.sourceConventionId))
      .limit(1)
    if (conv?.organizationId) return conv.organizationId
  }

  if (item.sourceEventId) {
    const [event] = await db
      .select({ organizationId: schema.events.organizationId })
      .from(schema.events)
      .where(eq(schema.events.id, item.sourceEventId))
      .limit(1)
    if (event?.organizationId) return event.organizationId
  }

  if (item.sourceGroupId) {
    const [group] = await db
      .select({ organizationId: schema.groups.organizationId })
      .from(schema.groups)
      .where(eq(schema.groups.id, item.sourceGroupId))
      .limit(1)
    if (group?.organizationId) return group.organizationId
  }

  return null
}

export async function viewerCanAccessGroupScopedMedia(
  item: Pick<MediaItem, 'sourceGroupId'>,
  viewerUserId: string | null,
): Promise<boolean> {
  if (!viewerUserId || !item.sourceGroupId) return false

  const [group] = await db
    .select({ ownerId: schema.groups.ownerId })
    .from(schema.groups)
    .where(eq(schema.groups.id, item.sourceGroupId))
    .limit(1)
  if (!group) return false
  if (group.ownerId === viewerUserId) return true

  const membership = await getGroupMembership(item.sourceGroupId, viewerUserId)
  return Boolean(membership)
}

export async function viewerCanAccessOrgScopedMedia(
  item: Pick<MediaItem, 'sourceGroupId' | 'sourceEventId' | 'sourceConventionId'>,
  asset: ScopedMediaAsset,
  viewerUserId: string | null,
): Promise<boolean> {
  if (!viewerUserId) return false

  const organizationId = await resolveMediaItemOrganizationId(item, asset)
  if (!organizationId) return false

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1)
  if (!org) return false

  return isOrgMember(org, viewerUserId)
}

/** Matches event discussion access: host, org mod+, committed going (not waitlist/maybe). */
export async function viewerCanAccessEventScopedMedia(
  item: Pick<MediaItem, 'sourceEventId'>,
  viewerUserId: string,
): Promise<boolean> {
  if (!item.sourceEventId) return false

  const [event] = await db
    .select({
      id: schema.events.id,
      hostId: schema.events.hostId,
      organizationId: schema.events.organizationId,
    })
    .from(schema.events)
    .where(eq(schema.events.id, item.sourceEventId))
    .limit(1)
  if (!event) return false
  if (event.hostId === viewerUserId) return true
  if (await viewerCanPatchEvent(viewerUserId, event)) return true

  const [rsvp] = await db
    .select({
      status: schema.eventRsvps.status,
      rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
    })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.eventId, item.sourceEventId),
        eq(schema.eventRsvps.userId, viewerUserId),
      ),
    )
    .limit(1)
  if (!rsvp || rsvp.status !== 'going') return false
  return rsvp.rsvpApprovalStatus === 'not_required' || rsvp.rsvpApprovalStatus === 'approved'
}

/** Aligns with convention channel / schedule access (org mod+, grant, staff, registrant). */
export async function viewerCanAccessConventionScopedMedia(
  item: Pick<MediaItem, 'sourceConventionId'>,
  viewerUserId: string,
): Promise<boolean> {
  if (!item.sourceConventionId) return false

  const [conv] = await db
    .select({
      id: schema.conventions.id,
      organizationId: schema.conventions.organizationId,
    })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, item.sourceConventionId))
    .limit(1)
  if (!conv?.organizationId) return false

  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, conv.organizationId),
        eq(schema.organizationMembers.userId, viewerUserId),
      ),
    )
    .limit(1)
  if (member && (ORG_ROLE_RANK[member.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR) return true

  const [grant] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conv.id),
        eq(schema.conventionAccessGrants.userId, viewerUserId),
      ),
    )
    .limit(1)
  if (grant) {
    const hasPaidAccess = Boolean(grant.paidConfirmed && grant.attendingConfirmed)
    const isStaff = Boolean(
      grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess,
    )
    if (hasPaidAccess || isStaff) return true
  }

  const [registrant] = await db
    .select({ id: schema.conventionRegistrants.id })
    .from(schema.conventionRegistrants)
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, conv.id),
        eq(schema.conventionRegistrants.userId, viewerUserId),
      ),
    )
    .limit(1)
  return Boolean(registrant)
}

export async function viewerCanAccessScopedMediaItem(
  item: ScopedMediaItem,
  asset: ScopedMediaAsset,
  viewerUserId: string | null,
): Promise<boolean> {
  if (item.visibility === MEDIA_VISIBILITIES.groupOnly) {
    return viewerCanAccessGroupScopedMedia(item, viewerUserId)
  }
  if (item.visibility === MEDIA_VISIBILITIES.orgOnly) {
    return viewerCanAccessOrgScopedMedia(item, asset, viewerUserId)
  }
  if (item.visibility === MEDIA_VISIBILITIES.eventAttendees) {
    if (!viewerUserId) return false
    return viewerCanAccessEventScopedMedia(item, viewerUserId)
  }
  if (item.visibility === MEDIA_VISIBILITIES.conventionAttendees) {
    if (!viewerUserId) return false
    return viewerCanAccessConventionScopedMedia(item, viewerUserId)
  }
  return true
}
