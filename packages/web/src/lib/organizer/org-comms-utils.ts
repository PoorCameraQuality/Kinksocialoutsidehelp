import type { ForumCategory } from '@/components/organizer/admin/OrgForumModerationPanel'
import type { ChannelCategory, OrgChannel } from '@/components/organizer/admin/OrgChatModerationPanel'

const MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MODERATOR'])

export function canManageOrgCommunications(orgRole: string | null): boolean {
  if (!orgRole) return false
  return MANAGE_ROLES.has(orgRole)
}

const GROUP_MANAGE_ROLES = new Set(['owner', 'admin', 'moderator'])

export function canManageGroupCommunications(groupRole: string | null): boolean {
  if (!groupRole) return false
  return GROUP_MANAGE_ROLES.has(groupRole.toLowerCase())
}

export const FORUM_CATEGORY_SUGGESTIONS = [
  'Announcements',
  'Introductions',
  'Event planning',
  'Resources',
  'Questions',
] as const

export const SUGGESTED_SETUP_ITEMS = [
  { name: 'Announcements', detail: 'Official updates from organizers' },
  { name: 'General', detail: 'Casual member conversation' },
  { name: 'Event planning', detail: 'Questions and coordination for upcoming events' },
  { name: 'Volunteers', detail: 'Staff and helper coordination' },
  { name: 'Resources', detail: 'Links, documents, and recurring information' },
] as const

export function formatSlowMode(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return 'Off'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function channelVisibilityLabel(ch: OrgChannel & { requiresConventionId?: string | null }): string {
  if (ch.requiresConventionId) return 'Convention attendees'
  if (ch.kind === 'ANNOUNCEMENTS') return 'Announcements'
  if (ch.kind === 'DISCORD') return 'Discord embed'
  return 'Members'
}

export function channelCategoryName(
  ch: OrgChannel,
  categories: ChannelCategory[],
): string {
  if (!ch.categoryId) return 'Uncategorized'
  return categories.find((c) => c.id === ch.categoryId)?.name ?? 'Uncategorized'
}

export function countChannelsInCategory(categoryId: string, channels: OrgChannel[]): number {
  return channels.filter((ch) => ch.categoryId === categoryId).length
}

export type CommsStats = {
  forumCategoryCount: number
  channelCount: number
  channelCategoryCount: number
}

export function computeCommsStats(
  forumCategories: ForumCategory[] | null,
  channelCategories: ChannelCategory[] | null,
  channels: OrgChannel[] | null,
): CommsStats {
  return {
    forumCategoryCount: forumCategories?.length ?? 0,
    channelCategoryCount: channelCategories?.length ?? 0,
    channelCount: channels?.length ?? 0,
  }
}
