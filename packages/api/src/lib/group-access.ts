import {
  canViewerSeeGroupMemberInPublicList,
  isGroupStaffRole,
  type GroupMemberListVisibility,
} from '@c2k/shared'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { viewerCanPatchEvent } from './virtual-event-join-visibility.js'

/** Roles allowed to create/manage group-scoped calendar events (matches web organizer gate). */
export const GROUP_EVENT_MOD_ROLES = new Set(['owner', 'admin', 'moderator', 'event_host'])

/** Roles allowed to PATCH group profile fields (category, description, etc.). */
export const GROUP_SETTINGS_EDIT_ROLES = new Set(['owner', 'admin', 'moderator'])

export async function getGroupMembership(
  groupId: string,
  userId: string,
): Promise<{ role: string } | null> {
  const [row] = await db
    .select({ role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1)
  return row ?? null
}

export function resolveGroupManagerRole(
  group: { ownerId: string },
  membership: { role: string } | null,
  userId: string,
): string | null {
  if (group.ownerId === userId) return 'owner'
  return membership?.role?.toLowerCase() ?? null
}

export function canManageGroupEvents(role: string | null): boolean {
  return role != null && GROUP_EVENT_MOD_ROLES.has(role)
}

/** Group mod (owner/admin/moderator) or parent org owner may edit group settings. */
export async function canEditGroupSettings(
  group: { id: string; ownerId: string; organizationId: string | null },
  userId: string,
): Promise<boolean> {
  if (group.ownerId === userId) return true
  const mem = await getGroupMembership(group.id, userId)
  const role = mem?.role?.toLowerCase() ?? null
  if (role != null && GROUP_SETTINGS_EDIT_ROLES.has(role)) return true
  if (!group.organizationId) return false
  const [org] = await db
    .select({ ownerId: schema.organizations.ownerId })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, group.organizationId))
    .limit(1)
  return org?.ownerId === userId
}

export async function canViewGroup(
  g: typeof schema.groups.$inferSelect,
  viewerUserId: string | null,
): Promise<boolean> {
  if (g.disbandedAt) return false
  if (g.visibility === 'owner_absent' && !viewerUserId) return false
  if (g.visibility === 'public') return true
  if (!viewerUserId) return false
  const m = await getGroupMembership(g.id, viewerUserId)
  return Boolean(m)
}

export function viewerIsGroupStaff(
  group: { ownerId: string },
  membership: { role: string } | null,
  viewerUserId: string | null,
): boolean {
  if (!viewerUserId) return false
  if (group.ownerId === viewerUserId) return true
  return isGroupStaffRole(membership?.role ?? null)
}

export function filterGroupMembersForViewer<
  T extends {
    userId: string
    role: string
    memberListVisibility: GroupMemberListVisibility
  },
>(
  members: T[],
  ctx: {
    viewerUserId: string | null
    groupOwnerId: string
    viewerMembership: { role: string } | null
    isSiteStaff: boolean
  },
): T[] {
  const isGroupStaff = viewerIsGroupStaff(
    { ownerId: ctx.groupOwnerId },
    ctx.viewerMembership,
    ctx.viewerUserId,
  )
  return members.filter((m) =>
    canViewerSeeGroupMemberInPublicList(m.memberListVisibility, m.role, {
      isOwner: ctx.viewerUserId === ctx.groupOwnerId,
      isGroupStaff,
      isSiteStaff: ctx.isSiteStaff,
      isSelf: ctx.viewerUserId === m.userId,
    }),
  )
}

/** Whether an event row should appear on a group calendar/list for this viewer. */
export async function canViewerSeeGroupEvent(
  viewerId: string | null,
  event: {
    visibility: string
    hostId: string
    organizationId: string | null
  },
  isGroupMember: boolean,
): Promise<boolean> {
  if (event.visibility === 'public') return true
  if (!viewerId) return false
  if (event.hostId === viewerId) return true
  if (isGroupMember) return true
  if (await viewerCanPatchEvent(viewerId, event)) return true
  return false
}
