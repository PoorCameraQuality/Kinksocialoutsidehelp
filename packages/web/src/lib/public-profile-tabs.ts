/** Public profile extended sections (owner dashboard + /profile/:username). */

export const COMMUNITY_SECTIONS = ['relationships', 'connections', 'feedback'] as const
export type CommunitySection = (typeof COMMUNITY_SECTIONS)[number]

export const PUBLIC_PROFILE_TABS = ['Community', 'Event history', 'Media', 'ISO'] as const

export type PublicProfileTab = (typeof PUBLIC_PROFILE_TABS)[number]

/** @deprecated Use Community tab + section=relationships */
export type LegacyCommunityTab = 'Relationships' | 'Connections' | 'Reviews'

export const DEFAULT_PUBLIC_PROFILE_TAB: PublicProfileTab = 'Media'

const LEGACY_TAB_ALIASES: Record<string, PublicProfileTab> = {
  about: 'Community',
  relationships: 'Community',
  relationship: 'Community',
  connections: 'Community',
  connection: 'Community',
  references: 'Community',
  reference: 'Community',
  reviews: 'Community',
  review: 'Community',
  feedback: 'Community',
  activity: 'Media',
  events: 'Event history',
  'events attended': 'Event history',
  'event history': 'Event history',
  groups: 'Media',
  media: 'Media',
  photos: 'Media',
  writing: 'Media',
  journal: 'Media',
  articles: 'Media',
  'education contributions': 'Media',
  education: 'Media',
  iso: 'ISO',
}

const LEGACY_SECTION_FROM_TAB: Record<string, CommunitySection> = {
  relationships: 'relationships',
  relationship: 'relationships',
  about: 'relationships',
  connections: 'connections',
  connection: 'connections',
  references: 'feedback',
  reference: 'feedback',
  reviews: 'feedback',
  review: 'feedback',
  feedback: 'feedback',
}

export function resolvePublicProfileTab(
  tabParam: string | null,
  defaultTab: PublicProfileTab = DEFAULT_PUBLIC_PROFILE_TAB,
): PublicProfileTab {
  if (!tabParam) return defaultTab
  let decoded = tabParam
  try {
    decoded = decodeURIComponent(tabParam)
  } catch {
    decoded = tabParam
  }
  if ((PUBLIC_PROFILE_TABS as readonly string[]).includes(decoded)) {
    return decoded as PublicProfileTab
  }
  const alias = LEGACY_TAB_ALIASES[decoded.toLowerCase()]
  if (alias) return alias
  const fuzzy = PUBLIC_PROFILE_TABS.find((t) => t.toLowerCase() === decoded.toLowerCase())
  return fuzzy ?? defaultTab
}

export function resolveCommunitySection(
  tabParam: string | null,
  sectionParam: string | null,
): CommunitySection {
  if (sectionParam) {
    const lower = sectionParam.toLowerCase()
    if (lower in LEGACY_SECTION_FROM_TAB) {
      return LEGACY_SECTION_FROM_TAB[lower]!
    }
    if ((COMMUNITY_SECTIONS as readonly string[]).includes(lower)) {
      return lower as CommunitySection
    }
  }
  if (tabParam) {
    let decoded = tabParam
    try {
      decoded = decodeURIComponent(tabParam)
    } catch {
      decoded = tabParam
    }
    const fromTab = LEGACY_SECTION_FROM_TAB[decoded.toLowerCase()]
    if (fromTab) return fromTab
  }
  return 'connections'
}

export function communitySectionLabel(section: CommunitySection): string {
  switch (section) {
    case 'relationships':
      return 'Relationships'
    case 'connections':
      return 'Connections'
    case 'feedback':
      return 'Community feedback'
  }
}

export type ProfileTabVisibilityInput = {
  viewerIsOwner: boolean
  isAuthenticated: boolean
  hasRelationships: boolean
  hasConnections: boolean
  hasEventHistory: boolean
  hasMedia: boolean
  hasReviews: boolean
  hasIso: boolean
}

export type PublicProfileTabCounts = Partial<Record<PublicProfileTab, number>>

export function getPublicProfileTabLabel(
  tab: PublicProfileTab,
  counts?: PublicProfileTabCounts,
): string {
  if (tab === 'Community') {
    const n = counts?.Community
    if (n != null && n > 0) return `Community (${n})`
    return 'Community'
  }
  return tab
}

export function getVisiblePublicProfileTabs(input: ProfileTabVisibilityInput): PublicProfileTab[] {
  const hasCommunity =
    input.viewerIsOwner || input.hasRelationships || input.hasConnections || input.hasReviews

  if (input.viewerIsOwner) {
    return PUBLIC_PROFILE_TABS.filter((tab) => {
      if (tab === 'ISO' && !input.isAuthenticated) return false
      return true
    })
  }

  const visible: PublicProfileTab[] = []
  if (hasCommunity) visible.push('Community')
  if (input.hasEventHistory) visible.push('Event history')
  if (input.hasMedia) visible.push('Media')
  if (input.hasIso) visible.push('ISO')
  return visible
}
