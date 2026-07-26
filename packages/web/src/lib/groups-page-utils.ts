import type { MockGroup } from '@/data/types'
import { GROUP_CATEGORIES } from '@c2k/shared'

export type GroupsScopeTab = 'all' | 'near-you' | 'new' | 'popular' | 'suggested'

export type GroupDiscoverBadge = 'Featured' | 'Popular' | 'New' | 'Near you'

/** Purpose filters shown in discover left rail (mockup-aligned). */
export const GROUP_PURPOSE_FILTERS = [
  GROUP_CATEGORIES.social,
  GROUP_CATEGORIES.education,
  GROUP_CATEGORIES.playScene,
  GROUP_CATEGORIES.affinity,
  GROUP_CATEGORIES.discussion,
  GROUP_CATEGORIES.marketplace,
  'Support',
] as const

export type GroupPurposeFilter = (typeof GROUP_PURPOSE_FILTERS)[number]

export function countGroupsByPurpose(groups: MockGroup[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const label of GROUP_PURPOSE_FILTERS) {
    counts.set(label, 0)
  }
  for (const g of groups) {
    const cat = g.category ?? ''
    for (const label of GROUP_PURPOSE_FILTERS) {
      if (label === 'Support') {
        const tagHit = g.tags?.some((t) => t.toLowerCase().includes('support'))
        if (tagHit || cat === GROUP_CATEGORIES.discussion) {
          counts.set(label, (counts.get(label) ?? 0) + 1)
        }
      } else if (cat === label) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
  }
  return counts
}

export function groupMatchesPurposeFilter(group: MockGroup, label: GroupPurposeFilter): boolean {
  if (label === 'Support') {
    const tagHit = group.tags?.some((t) => t.toLowerCase().includes('support'))
    return tagHit || group.category === GROUP_CATEGORIES.discussion
  }
  return group.category === label
}

export function filterGroupsByPurpose(
  groups: MockGroup[],
  selected: GroupPurposeFilter[],
): MockGroup[] {
  if (selected.length === 0) return groups
  return groups.filter((g) => selected.some((label) => groupMatchesPurposeFilter(g, label)))
}

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000

function isRecentGroup(g: MockGroup): boolean {
  if (!g.createdAt) return false
  const t = new Date(g.createdAt).getTime()
  return !Number.isNaN(t) && Date.now() - t < MS_30_DAYS
}

export function deriveGroupDiscoverBadge(
  group: MockGroup,
  index: number,
  scopeTab: GroupsScopeTab,
): GroupDiscoverBadge | null {
  if (scopeTab === 'near-you') return 'Near you'
  if (scopeTab === 'new') return 'New'
  if (scopeTab === 'popular') return 'Popular'
  if (scopeTab === 'suggested') {
    if (index < 2) return 'Featured'
    if (index < 6) return 'Popular'
    return null
  }
  if ((group.members ?? 0) >= 120) return 'Popular'
  if (isRecentGroup(group)) return 'New'
  if (index % 9 === 0) return 'Featured'
  return null
}

/** Demo-only mutual friends count on browse cards. */
export function mockFriendsHereCount(groupId: string): number {
  let h = 0
  for (let i = 0; i < groupId.length; i++) h = (h + groupId.charCodeAt(i) * (i + 1)) % 97
  return h % 6
}

export type GroupsSortMode = 'recommended' | 'new' | 'name' | 'members' | 'active'

/**
 * Access / privacy badge shown on discover cards. Derived only from data the
 * directory already exposes (visibility + joinMode); never leaks membership or
 * hidden-member state. Hidden groups are not listed by the API, so we never
 * surface them here.
 */
export type GroupAccess = 'Public' | 'Approval required' | 'Private' | 'Invite only'

export function deriveGroupAccess(group: MockGroup): GroupAccess {
  if (group.visibility === 'invite-only') return 'Invite only'
  if (group.visibility === 'private') return 'Private'
  if (group.joinMode === 'apply') return 'Approval required'
  return 'Public'
}

/**
 * Honest activity signal. We only have createdAt in the directory payload, so we
 * only claim "New" when the group is genuinely recent. No fabricated
 * "recently active" / post-count claims without real data.
 */
export function groupActivityLabel(
  group: MockGroup,
  badge?: GroupDiscoverBadge | null,
): string | null {
  if (badge === 'New' || isRecentGroup(group)) return 'New this month'
  return null
}

/**
 * Privacy-safe recommendation context. Driven purely by the active scope plus
 * region/category signals the directory already exposes — never RSVP- or
 * membership-derived.
 */
export function deriveGroupRecommendation(
  group: MockGroup,
  scopeTab: GroupsScopeTab,
): string | null {
  if (scopeTab === 'near-you' && group.distanceMi != null) {
    if (group.category === GROUP_CATEGORIES.education) return 'Education group near you'
    return 'Suggested from your region'
  }
  if (scopeTab === 'suggested') return 'Suggested for you'
  return null
}

export const GROUP_SCOPE_CHIP_PURPOSES = [
  { id: 'education' as const, label: 'Education', purpose: GROUP_CATEGORIES.education },
  { id: 'social' as const, label: 'Social', purpose: GROUP_CATEGORIES.social },
  { id: 'support' as const, label: 'Support', purpose: 'Support' as GroupPurposeFilter },
] as const

export function sortGroupsForDiscover(groups: MockGroup[], sort: GroupsSortMode): MockGroup[] {
  const copy = [...groups]
  switch (sort) {
    case 'new':
      copy.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      break
    case 'name':
      copy.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'members':
      copy.sort((a, b) => (b.members ?? 0) - (a.members ?? 0))
      break
    case 'active':
      copy.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      break
    case 'recommended':
    default:
      // Preserve the upstream relevance/diverse ranking from rankGroups.
      return copy
  }
  return copy
}
