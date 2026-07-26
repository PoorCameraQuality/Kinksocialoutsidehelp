import type { ApiOrgListItem } from '@/hooks/useApiOrganizations'
import { ORG_TRUSTED_MIN_RATING, ORG_TRUSTED_MIN_REVIEWS } from '@/lib/org-reputation-display'

export type OrgDirectoryBadge = {
  id: string
  label: string
  tone: 'gold' | 'muted' | 'green' | 'purple' | 'blue'
}

export type OrgDirectoryModel = ApiOrgListItem & {
  roleLabel: string
  regionLabel: string | null
  upcomingEventsCount?: number
  groupCount?: number
  badges: OrgDirectoryBadge[]
}

export type OrgFilterChip = 'all' | 'hostingSoon' | 'nearby' | 'recentlyActive' | 'new'

export type OrgDirectorySort = 'popular' | 'name' | 'recent' | 'events'

const ROLE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /convention|hotel takeover/i, label: 'Convention organizer' },
  { pattern: /education|educator|collective/i, label: 'Education collective' },
  { pattern: /vendor/i, label: 'Vendor collective' },
  { pattern: /dungeon|venue|play space/i, label: 'Dungeon / venue' },
  { pattern: /regional|network|collective|community/i, label: 'Regional community organizer' },
]

function inferRoleLabel(org: ApiOrgListItem): string {
  const hay = `${org.displayName} ${org.bio ?? ''} ${org.slug}`.toLowerCase()
  for (const { pattern, label } of ROLE_PATTERNS) {
    if (pattern.test(hay)) return label
  }
  return 'Community organizer'
}

function inferRegion(org: ApiOrgListItem): string | null {
  const bio = org.bio ?? ''
  const midAtlantic = /mid-?atlantic|philadelphia|baltimore|dc\b|pennsylvania/i.test(bio)
  if (midAtlantic || org.slug === 'demo-east-collective') return 'Mid-Atlantic'
  const northeast = /northeast|new york|boston/i.test(bio)
  if (northeast) return 'Northeast'
  if (/national|coast to coast/i.test(bio)) return 'Multi-region'
  return null
}

function inferBadges(org: ApiOrgListItem): OrgDirectoryBadge[] {
  const badges: OrgDirectoryBadge[] = []
  const flags = org.featureFlags ?? {}
  if (org.reviewCount >= ORG_TRUSTED_MIN_REVIEWS && org.rating >= ORG_TRUSTED_MIN_RATING) {
    badges.push({ id: 'verified', label: 'Verified organizer', tone: 'green' })
  }
  if (flags.conventions === true || /convention/i.test(org.bio ?? '')) {
    badges.push({ id: 'conventions', label: 'Runs conventions', tone: 'purple' })
  }
  if (flags.education === true || /education|educator/i.test(org.bio ?? '')) {
    badges.push({ id: 'education', label: 'Education contributor', tone: 'muted' })
  }
  return badges
}

/** Demo-friendly counts until list API exposes aggregates (local dev only). */
function inferCounts(org: ApiOrgListItem): { upcomingEventsCount?: number; groupCount?: number } {
  if (import.meta.env.DEV && org.slug === 'demo-east-collective') {
    return { upcomingEventsCount: 2, groupCount: 1 }
  }
  return {}
}

export function isVerifiedOrganizer(org: Pick<OrgDirectoryModel, 'reviewCount' | 'rating'>): boolean {
  return org.reviewCount >= ORG_TRUSTED_MIN_REVIEWS && org.rating >= ORG_TRUSTED_MIN_RATING
}

export function toOrgDirectoryModel(org: ApiOrgListItem): OrgDirectoryModel {
  const counts = inferCounts(org)
  const hostingSoon = (counts.upcomingEventsCount ?? 0) > 0
  const badges = inferBadges(org)
  if (hostingSoon && !badges.some((b) => b.id === 'hosting')) {
    badges.unshift({ id: 'hosting', label: 'Hosting soon', tone: 'blue' })
  }
  return {
    ...org,
    roleLabel: inferRoleLabel(org),
    regionLabel: inferRegion(org),
    ...counts,
    badges,
  }
}

export function filterOrgsByChip(orgs: OrgDirectoryModel[], chip: OrgFilterChip): OrgDirectoryModel[] {
  if (chip === 'all') return orgs
  if (chip === 'hostingSoon') {
    return orgs.filter((o) => o.badges.some((b) => b.id === 'hosting') || (o.upcomingEventsCount ?? 0) > 0)
  }
  if (chip === 'new') {
    return [...orgs].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })
  }
  if (chip === 'recentlyActive') {
    return [...orgs].sort(
      (a, b) => b.reviewCount - a.reviewCount || (b.memberCount ?? 0) - (a.memberCount ?? 0),
    )
  }
  if (chip === 'nearby') {
    return orgs.filter((o) => Boolean(o.regionLabel))
  }
  return orgs
}

export function sortOrgDirectory(orgs: OrgDirectoryModel[], sort: OrgDirectorySort): OrgDirectoryModel[] {
  const copy = [...orgs]
  if (sort === 'name') {
    return copy.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  if (sort === 'recent') {
    return copy.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })
  }
  if (sort === 'events') {
    return copy.sort(
      (a, b) => (b.upcomingEventsCount ?? 0) - (a.upcomingEventsCount ?? 0) || b.rating - a.rating,
    )
  }
  return copy.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
    return a.displayName.localeCompare(b.displayName)
  })
}
