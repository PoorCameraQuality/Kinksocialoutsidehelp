import { z } from 'zod'

export const GROUP_MEMBER_LIST_VISIBILITY_LEVELS = ['visible', 'hidden'] as const
export type GroupMemberListVisibility = (typeof GROUP_MEMBER_LIST_VISIBILITY_LEVELS)[number]

export const groupMemberListVisibilitySchema = z.enum(GROUP_MEMBER_LIST_VISIBILITY_LEVELS)

export const GROUP_STAFF_ROLES = ['owner', 'admin', 'moderator'] as const
export type GroupStaffRole = (typeof GROUP_STAFF_ROLES)[number]

export function isGroupStaffRole(role: string | null | undefined): boolean {
  if (!role) return false
  return GROUP_STAFF_ROLES.includes(role.toLowerCase() as GroupStaffRole)
}

/** Staff roles are always visible in member lists for accountability. */
export function effectiveGroupMemberListVisibility(
  role: string,
  memberListVisibility: GroupMemberListVisibility,
): GroupMemberListVisibility {
  if (isGroupStaffRole(role)) return 'visible'
  return memberListVisibility
}

export type GroupMemberListViewerContext = {
  isOwner: boolean
  isGroupStaff: boolean
  isSiteStaff: boolean
  isSelf: boolean
}

/** Whether a member row may appear on the public Members tab. */
export function canViewerSeeGroupMemberInPublicList(
  memberListVisibility: GroupMemberListVisibility,
  role: string,
  ctx: GroupMemberListViewerContext,
): boolean {
  const effective = effectiveGroupMemberListVisibility(role, memberListVisibility)
  if (effective === 'visible') return true
  if (ctx.isSelf) return true
  if (ctx.isOwner || ctx.isGroupStaff || ctx.isSiteStaff) return true
  return false
}

export type GroupMembershipPrivacyFields = {
  memberListVisibility: GroupMemberListVisibility
  showGroupOnProfile: boolean
  announceGroupJoinInFeed: boolean
}

export const defaultGroupMembershipPrivacy: GroupMembershipPrivacyFields = {
  memberListVisibility: 'visible',
  showGroupOnProfile: true,
  announceGroupJoinInFeed: true,
}

export function shouldEmitGroupJoinFeedActivity(
  membership: Pick<GroupMembershipPrivacyFields, 'announceGroupJoinInFeed' | 'memberListVisibility'>,
  role: string,
): boolean {
  if (effectiveGroupMemberListVisibility(role, membership.memberListVisibility) === 'hidden') {
    return false
  }
  return membership.announceGroupJoinInFeed
}

/**
 * Forum thread feed items can reveal group affiliation. Hidden members do not emit.
 * announceGroupJoinInFeed does not apply here. Actor showComments is checked at read time.
 */
export function shouldEmitGroupForumThreadFeedActivity(
  membership: Pick<GroupMembershipPrivacyFields, 'memberListVisibility'>,
  role: string,
): boolean {
  return effectiveGroupMemberListVisibility(role, membership.memberListVisibility) !== 'hidden'
}
