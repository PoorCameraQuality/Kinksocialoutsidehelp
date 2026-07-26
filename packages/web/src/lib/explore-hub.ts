import type { TrendingItemCardModel } from '@/components/home/TrendingItemCard'
import type { MockCoSuggestHome } from '@/data/mock-home-surface'
import { getTrustTierFromScore, type MockEvent, type MockGroup, type MockPerson, type MockVendor } from '@/data/mock-data'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import { isUpcomingEvent } from '@/lib/events-page-utils'
import { isVerifiedOrganizer, type OrgDirectoryModel } from '@/lib/org-directory-utils'

export const EXPLORE_CATEGORY_TABS = [
  'All',
  'Events',
  'Groups',
  'People',
  'Organizations',
  'Education',
  'Vendors',
  'Media',
] as const

export type ExploreCategoryTab = (typeof EXPLORE_CATEGORY_TABS)[number]

export const DEFAULT_EXPLORE_TAB: ExploreCategoryTab = 'All'

export type ExplorePopularCategory = {
  id: string
  label: string
  countLabel: string
  href: string
  icon: 'bdsm' | 'rope' | 'impact' | 'leather' | 'education' | 'community'
}

/** Popular category links - counts omitted until API aggregates exist. */
export const EXPLORE_POPULAR_CATEGORIES: ExplorePopularCategory[] = [
  { id: 'bdsm', label: 'BDSM', countLabel: '', href: '/events?tab=discover', icon: 'bdsm' },
  { id: 'rope', label: 'Rope', countLabel: '', href: '/explore?topics=Rope', icon: 'rope' },
  { id: 'impact', label: 'Impact Play', countLabel: '', href: '/events?tab=discover', icon: 'impact' },
  { id: 'leather', label: 'Leather', countLabel: '', href: '/groups', icon: 'leather' },
  { id: 'kink101', label: 'Kink 101', countLabel: '', href: '/education', icon: 'education' },
  { id: 'community', label: 'Community', countLabel: '', href: '/groups', icon: 'community' },
  { id: 'places', label: 'Kinky Map', countLabel: '', href: '/places', icon: 'community' },
]

export type ExploreSuggestedItem = {
  id: string
  name: string
  type: 'Person' | 'Group' | 'Organization' | 'Event'
  reason: string
  href: string
  imageUrl?: string | null
}

export function normalizeExploreTab(raw: string | null): ExploreCategoryTab {
  if (!raw) return DEFAULT_EXPLORE_TAB
  const decoded = decodeURIComponent(raw)
  const match = EXPLORE_CATEGORY_TABS.find((t) => t.toLowerCase() === decoded.toLowerCase())
  return match ?? DEFAULT_EXPLORE_TAB
}

export function trendingKindLabel(kind: string): string {
  if (kind === 'event') return 'Event'
  if (kind === 'group' || kind === 'group_discussion') return 'Group'
  if (kind.startsWith('education')) return 'Education'
  if (kind === 'vendor') return 'Vendor'
  if (kind === 'feed' || kind === 'post') return 'Discussion'
  if (kind === 'organization' || kind === 'org') return 'Organization'
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function eventDateBlock(dateLabel: string): { month: string; day: string } {
  const parts = dateLabel.replace(/,/g, '').trim().split(/\s+/)
  const month = parts.find((p) => /^[A-Za-z]{3,}$/.test(p) && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(p))
  const day = parts.find((p) => /^\d{1,2}$/.test(p))
  return {
    month: month ? month.slice(0, 3).toUpperCase() : '-',
    day: day ?? '-',
  }
}

function matchesQuery(text: string, q: string): boolean {
  if (!q) return true
  return text.toLowerCase().includes(q.toLowerCase())
}

export function filterEvents(events: MockEvent[], q: string): MockEvent[] {
  if (!q) return events
  return events.filter(
    (e) =>
      matchesQuery(e.title, q) ||
      matchesQuery(e.location, q) ||
      (e.tags?.some((t) => matchesQuery(t, q)) ?? false) ||
      (e.category ? matchesQuery(e.category, q) : false),
  )
}

export function filterGroups(groups: MockGroup[], q: string): MockGroup[] {
  if (!q) return groups
  return groups.filter(
    (g) =>
      matchesQuery(g.name, q) ||
      matchesQuery(g.description ?? '', q) ||
      (g.tags?.some((t) => matchesQuery(t, q)) ?? false),
  )
}

export function coSuggestToMockPerson(s: MockCoSuggestHome): MockPerson {
  return {
    id: s.userId,
    username: s.username,
    roles: [],
    trustScore: s.trustScore,
    trustTier: getTrustTierFromScore(s.trustScore),
    verified: s.verified,
    mutualCount: s.sharedCount ?? 0,
    distance: '',
    location: s.location ?? undefined,
    avatarUrl: s.avatarUrl ?? undefined,
    sharedEventsCount: s.sharedCount,
  }
}

/** API-backed home leaves `rankedPeople` empty; use connection suggestions for Explore. */
export function buildExplorePeoplePool(
  useDemoFallback: boolean,
  mockCatalog: MockPerson[],
  rankedPeople: MockPerson[],
  coSuggestions: MockCoSuggestHome[] | null,
  nearbyPeople: MockCoSuggestHome[] | null,
): MockPerson[] {
  if (useDemoFallback) return mockCatalog
  if (rankedPeople.length > 0) return rankedPeople
  const byId = new Map<string, MockPerson>()
  for (const s of [...(coSuggestions ?? []), ...(nearbyPeople ?? [])]) {
    if (!byId.has(s.userId)) byId.set(s.userId, coSuggestToMockPerson(s))
  }
  return [...byId.values()]
}

export function filterPeople(people: MockPerson[], q: string): MockPerson[] {
  if (!q) return people
  return people.filter(
    (p) =>
      matchesQuery(p.username, q) ||
      matchesQuery(p.location ?? '', q) ||
      p.roles.some((r) => matchesQuery(r, q)),
  )
}

export function filterVendors(vendors: MockVendor[], q: string): MockVendor[] {
  if (!q) return vendors
  return vendors.filter(
    (v) =>
      matchesQuery(v.name, q) ||
      matchesQuery(v.featuredListingTitle ?? '', q) ||
      (v.tags?.some((t) => matchesQuery(t, q)) ?? false),
  )
}

export function filterTrending(items: TrendingItemCardModel[], q: string): TrendingItemCardModel[] {
  if (!q) return items
  return items.filter(
    (i) => matchesQuery(i.title, q) || matchesQuery(i.subtitle ?? '', q) || matchesQuery(i.kind, q),
  )
}

export function filterArticles(articles: ApiEducationArticle[], q: string): ApiEducationArticle[] {
  if (!q) return articles
  return articles.filter(
    (a) => matchesQuery(a.title, q) || matchesQuery(a.excerpt ?? '', q),
  )
}

export function filterOrgs(orgs: OrgDirectoryModel[], q: string): OrgDirectoryModel[] {
  if (!q) return orgs
  return orgs.filter(
    (o) =>
      matchesQuery(o.displayName, q) ||
      matchesQuery(o.bio ?? '', q) ||
      matchesQuery(o.roleLabel, q),
  )
}

export function buildSuggestedItems(input: {
  people: MockPerson[]
  groups: MockGroup[]
  events: MockEvent[]
  orgs: OrgDirectoryModel[]
}): ExploreSuggestedItem[] {
  const items: ExploreSuggestedItem[] = []

  for (const p of input.people.slice(0, 2)) {
    items.push({
      id: `person-${p.id}`,
      name: p.username,
      type: 'Person',
      reason: p.mutualCount > 0 ? `${p.mutualCount} mutual connections` : 'Active in your region',
      href: `/profile/${encodeURIComponent(p.username)}`,
      imageUrl: p.avatarUrl ?? null,
    })
  }
  for (const g of input.groups.slice(0, 2)) {
    items.push({
      id: `group-${g.id}`,
      name: g.name,
      type: 'Group',
      reason: `${g.members.toLocaleString()} members`,
      href: `/groups/${encodeURIComponent(String(g.id))}`,
      imageUrl: g.coverImageUrl ?? null,
    })
  }
  for (const o of input.orgs.slice(0, 1)) {
    items.push({
      id: `org-${o.id}`,
      name: o.displayName,
      type: 'Organization',
      reason: o.roleLabel,
      href: `/orgs/${encodeURIComponent(o.slug)}`,
      imageUrl: o.logoUrl ?? o.bannerUrl ?? o.shareImageUrl ?? null,
    })
  }
  for (const e of input.events.slice(0, 1)) {
    items.push({
      id: `event-${e.id}`,
      name: e.title,
      type: 'Event',
      reason: e.location || 'Upcoming event',
      href: `/events/${encodeURIComponent(String(e.id))}`,
      imageUrl: e.imageUrl ?? e.bannerUrl ?? null,
    })
  }

  return items.slice(0, 6)
}

// --- Discovery filters (Explore hub; content type lives in drawer, not tab row) ---

export const EXPLORE_CONTENT_TYPES = [
  'Events',
  'Groups',
  'People',
  'Organizations',
  'Education',
  'Vendors',
  'Media',
] as const

export type ExploreContentType = (typeof EXPLORE_CONTENT_TYPES)[number]

export type ExploreDateFilter = 'today' | 'this-week' | 'this-month'

export type ExploreDiscoveryChipId =
  | 'near-me'
  | 'this-week'
  | 'online'
  | 'beginner-friendly'
  | 'new-here'
  | 'active-groups'
  | 'upcoming-events'
  | 'verified-organizers'
  | 'vendors-shipping'

export const EXPLORE_DISCOVERY_CHIPS: { id: ExploreDiscoveryChipId; label: string }[] = [
  { id: 'near-me', label: 'Near me' },
  { id: 'this-week', label: 'This week' },
  { id: 'online', label: 'Online' },
  { id: 'beginner-friendly', label: 'Beginner friendly' },
  { id: 'new-here', label: 'New here' },
  { id: 'active-groups', label: 'Active groups' },
  { id: 'upcoming-events', label: 'Upcoming events' },
  { id: 'verified-organizers', label: 'Verified organizers' },
  { id: 'vendors-shipping', label: 'Vendors shipping to me' },
]

export const EXPLORE_TOPIC_CHIPS = [
  'BDSM',
  'Rope',
  'Impact play',
  'Leather',
  'Kink 101',
  'Community',
  'Aftercare',
  'Safety',
  'Consent',
  'Conventions',
] as const

export type ExploreTopicChip = (typeof EXPLORE_TOPIC_CHIPS)[number]

export type ExploreFilters = {
  contentTypes: ExploreContentType[]
  nearMe: boolean
  onlineOnly: boolean
  thisWeek: boolean
  beginnerFriendly: boolean
  newHere: boolean
  activeGroups: boolean
  upcomingEvents: boolean
  verifiedOnly: boolean
  shipsToMe: boolean
  soldExternally: boolean
  publicSpacesOnly: boolean
  topics: string[]
  dateFilter: ExploreDateFilter | null
  location: string
}

export const EMPTY_EXPLORE_FILTERS: ExploreFilters = {
  contentTypes: [],
  nearMe: false,
  onlineOnly: false,
  thisWeek: false,
  beginnerFriendly: false,
  newHere: false,
  activeGroups: false,
  upcomingEvents: false,
  verifiedOnly: false,
  shipsToMe: false,
  soldExternally: false,
  publicSpacesOnly: false,
  topics: [],
  dateFilter: null,
  location: '',
}

const LEGACY_TAB_TO_CONTENT_TYPE: Record<string, ExploreContentType> = {
  Events: 'Events',
  Groups: 'Groups',
  People: 'People',
  Organizations: 'Organizations',
  Education: 'Education',
  Vendors: 'Vendors',
  Media: 'Media',
}

function parseListParam(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function flagParam(params: URLSearchParams, key: string): boolean {
  const v = params.get(key)
  return v === '1' || v === 'true'
}

export function parseExploreFilters(params: URLSearchParams): ExploreFilters {
  const filters: ExploreFilters = { ...EMPTY_EXPLORE_FILTERS }

  const types = parseListParam(params.get('types'))
  for (const t of types) {
    const match = EXPLORE_CONTENT_TYPES.find((ct) => ct.toLowerCase() === t.toLowerCase())
    if (match && !filters.contentTypes.includes(match)) filters.contentTypes.push(match)
  }

  const legacyTab = params.get('tab')
  if (legacyTab && legacyTab !== 'All') {
    const mapped = LEGACY_TAB_TO_CONTENT_TYPE[legacyTab] ?? LEGACY_TAB_TO_CONTENT_TYPE[decodeURIComponent(legacyTab)]
    if (mapped && !filters.contentTypes.includes(mapped)) filters.contentTypes.push(mapped)
  }

  filters.nearMe = flagParam(params, 'near')
  filters.onlineOnly = flagParam(params, 'online')
  filters.thisWeek = flagParam(params, 'week') || params.get('date') === 'this-week'
  filters.beginnerFriendly = flagParam(params, 'beginner')
  filters.newHere = flagParam(params, 'new')
  filters.activeGroups = flagParam(params, 'active')
  filters.upcomingEvents = flagParam(params, 'upcoming')
  filters.verifiedOnly = flagParam(params, 'verified')
  filters.shipsToMe = flagParam(params, 'ships')
  filters.soldExternally = flagParam(params, 'external')
  filters.publicSpacesOnly = flagParam(params, 'public')

  const topics = parseListParam(params.get('topics'))
  filters.topics = topics

  const date = params.get('date')
  if (date === 'today' || date === 'this-week' || date === 'this-month') {
    filters.dateFilter = date
    if (date === 'this-week') filters.thisWeek = true
  }

  filters.location = params.get('loc') ?? ''

  return filters
}

export function writeExploreFiltersToParams(
  prev: URLSearchParams,
  filters: ExploreFilters,
): URLSearchParams {
  const next = new URLSearchParams(prev)

  next.delete('tab')

  if (filters.contentTypes.length) next.set('types', filters.contentTypes.join(','))
  else next.delete('types')

  const setFlag = (key: string, on: boolean) => {
    if (on) next.set(key, '1')
    else next.delete(key)
  }

  setFlag('near', filters.nearMe)
  setFlag('online', filters.onlineOnly)
  setFlag('week', filters.thisWeek)
  setFlag('beginner', filters.beginnerFriendly)
  setFlag('new', filters.newHere)
  setFlag('active', filters.activeGroups)
  setFlag('upcoming', filters.upcomingEvents)
  setFlag('verified', filters.verifiedOnly)
  setFlag('ships', filters.shipsToMe)
  setFlag('external', filters.soldExternally)
  setFlag('public', filters.publicSpacesOnly)

  if (filters.topics.length) next.set('topics', filters.topics.join(','))
  else next.delete('topics')

  if (filters.dateFilter) next.set('date', filters.dateFilter)
  else if (!filters.thisWeek) next.delete('date')

  if (filters.location.trim()) next.set('loc', filters.location.trim())
  else next.delete('loc')

  return next
}

export function toggleDiscoveryChip(filters: ExploreFilters, chipId: ExploreDiscoveryChipId): ExploreFilters {
  const next = { ...filters }
  switch (chipId) {
    case 'near-me':
      next.nearMe = !next.nearMe
      break
    case 'this-week':
      next.thisWeek = !next.thisWeek
      next.dateFilter = next.thisWeek ? 'this-week' : next.dateFilter === 'this-week' ? null : next.dateFilter
      break
    case 'online':
      next.onlineOnly = !next.onlineOnly
      break
    case 'beginner-friendly':
      next.beginnerFriendly = !next.beginnerFriendly
      break
    case 'new-here':
      next.newHere = !next.newHere
      break
    case 'active-groups':
      next.activeGroups = !next.activeGroups
      break
    case 'upcoming-events':
      next.upcomingEvents = !next.upcomingEvents
      break
    case 'verified-organizers':
      next.verifiedOnly = !next.verifiedOnly
      break
    case 'vendors-shipping':
      next.shipsToMe = !next.shipsToMe
      break
  }
  return next
}

export function isDiscoveryChipActive(filters: ExploreFilters, chipId: ExploreDiscoveryChipId): boolean {
  switch (chipId) {
    case 'near-me':
      return filters.nearMe
    case 'this-week':
      return filters.thisWeek || filters.dateFilter === 'this-week'
    case 'online':
      return filters.onlineOnly
    case 'beginner-friendly':
      return filters.beginnerFriendly
    case 'new-here':
      return filters.newHere
    case 'active-groups':
      return filters.activeGroups
    case 'upcoming-events':
      return filters.upcomingEvents
    case 'verified-organizers':
      return filters.verifiedOnly
    case 'vendors-shipping':
      return filters.shipsToMe
    default:
      return false
  }
}

export function toggleExploreTopic(filters: ExploreFilters, topic: string): ExploreFilters {
  const topics = [...filters.topics]
  const idx = topics.findIndex((t) => t.toLowerCase() === topic.toLowerCase())
  if (idx >= 0) topics.splice(idx, 1)
  else topics.push(topic)
  return { ...filters, topics }
}

export function exploreFiltersActive(filters: ExploreFilters): boolean {
  return (
    filters.contentTypes.length > 0 ||
    filters.nearMe ||
    filters.onlineOnly ||
    filters.thisWeek ||
    filters.beginnerFriendly ||
    filters.newHere ||
    filters.activeGroups ||
    filters.upcomingEvents ||
    filters.verifiedOnly ||
    filters.shipsToMe ||
    filters.soldExternally ||
    filters.publicSpacesOnly ||
    filters.topics.length > 0 ||
    filters.dateFilter !== null ||
    filters.location.trim().length > 0
  )
}

export type ExploreActiveFilterPill = {
  id: string
  label: string
  remove: (filters: ExploreFilters) => ExploreFilters
}

export function buildExploreActiveFilterPills(filters: ExploreFilters): ExploreActiveFilterPill[] {
  const pills: ExploreActiveFilterPill[] = []

  for (const type of filters.contentTypes) {
    pills.push({
      id: `type-${type}`,
      label: type,
      remove: (f) => ({ ...f, contentTypes: f.contentTypes.filter((t) => t !== type) }),
    })
  }

  for (const topic of filters.topics) {
    pills.push({
      id: `topic-${topic}`,
      label: topic,
      remove: (f) => ({
        ...f,
        topics: f.topics.filter((t) => t.toLowerCase() !== topic.toLowerCase()),
      }),
    })
  }

  if (filters.nearMe) {
    pills.push({
      id: 'near',
      label: 'Near me',
      remove: (f) => ({ ...f, nearMe: false }),
    })
  }
  if (filters.thisWeek || filters.dateFilter === 'this-week') {
    pills.push({
      id: 'week',
      label: 'This week',
      remove: (f) => ({ ...f, thisWeek: false, dateFilter: f.dateFilter === 'this-week' ? null : f.dateFilter }),
    })
  }
  if (filters.dateFilter === 'today') {
    pills.push({
      id: 'today',
      label: 'Today',
      remove: (f) => ({ ...f, dateFilter: null }),
    })
  }
  if (filters.dateFilter === 'this-month') {
    pills.push({
      id: 'month',
      label: 'This month',
      remove: (f) => ({ ...f, dateFilter: null }),
    })
  }
  if (filters.onlineOnly) {
    pills.push({
      id: 'online',
      label: 'Online',
      remove: (f) => ({ ...f, onlineOnly: false }),
    })
  }
  if (filters.beginnerFriendly) {
    pills.push({
      id: 'beginner',
      label: 'Beginner friendly',
      remove: (f) => ({ ...f, beginnerFriendly: false }),
    })
  }
  if (filters.newHere) {
    pills.push({
      id: 'new',
      label: 'New here',
      remove: (f) => ({ ...f, newHere: false }),
    })
  }
  if (filters.activeGroups) {
    pills.push({
      id: 'active',
      label: 'Active groups',
      remove: (f) => ({ ...f, activeGroups: false }),
    })
  }
  if (filters.upcomingEvents) {
    pills.push({
      id: 'upcoming',
      label: 'Upcoming events',
      remove: (f) => ({ ...f, upcomingEvents: false }),
    })
  }
  if (filters.verifiedOnly) {
    pills.push({
      id: 'verified',
      label: 'Verified organizers',
      remove: (f) => ({ ...f, verifiedOnly: false }),
    })
  }
  if (filters.shipsToMe) {
    pills.push({
      id: 'ships',
      label: 'Ships to me',
      remove: (f) => ({ ...f, shipsToMe: false }),
    })
  }
  if (filters.soldExternally) {
    pills.push({
      id: 'external',
      label: 'Sold externally',
      remove: (f) => ({ ...f, soldExternally: false }),
    })
  }
  if (filters.publicSpacesOnly) {
    pills.push({
      id: 'public',
      label: 'Public spaces only',
      remove: (f) => ({ ...f, publicSpacesOnly: false }),
    })
  }
  if (filters.location.trim()) {
    pills.push({
      id: 'loc',
      label: filters.location.trim(),
      remove: (f) => ({ ...f, location: '' }),
    })
  }

  return pills
}

export function shouldShowExploreSection(
  section: ExploreContentType | 'featured',
  filters: ExploreFilters,
): boolean {
  if (filters.contentTypes.length === 0) return true
  if (section === 'featured') return filters.contentTypes.includes('Events')
  return filters.contentTypes.includes(section)
}

function matchesTopics(texts: string[], topics: string[]): boolean {
  if (!topics.length) return true
  const hay = texts.join(' ').toLowerCase()
  return topics.some((t) => hay.includes(t.toLowerCase()))
}

function eventInDateWindow(event: MockEvent, filters: ExploreFilters): boolean {
  if (!filters.dateFilter && !filters.thisWeek && !filters.upcomingEvents) return true
  const now = new Date()
  const start = event.startsAt ? new Date(event.startsAt) : null
  if (!start || Number.isNaN(start.getTime())) return true

  if (filters.dateFilter === 'today') {
    return start.toDateString() === now.toDateString()
  }
  if (filters.dateFilter === 'this-week' || filters.thisWeek) {
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return start >= now && start <= weekEnd
  }
  if (filters.dateFilter === 'this-month') {
    return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear()
  }
  if (filters.upcomingEvents) {
    return start >= now
  }
  return true
}

export function applyExploreEventFilters(events: MockEvent[], filters: ExploreFilters): MockEvent[] {
  // Discovery hub is advertising upcoming experiences — never surface past events.
  let result = events.filter((e) => isUpcomingEvent(e))
  if (filters.onlineOnly) {
    result = result.filter((e) => e.eventFormat === 'virtual' || /online|virtual/i.test(e.location))
  }
  if (filters.nearMe || filters.location.trim()) {
    const loc = filters.location.trim().toLowerCase()
    result = result.filter(
      (e) =>
        e.eventFormat !== 'virtual' &&
        (!loc || e.location.toLowerCase().includes(loc) || matchesQuery(e.location, loc)),
    )
  }
  if (filters.verifiedOnly) {
    result = result.filter((e) => e.hostVerified)
  }
  if (filters.beginnerFriendly) {
    result = result.filter(
      (e) =>
        (e.tags?.some((t) => /beginner|101|intro/i.test(t)) ?? false) ||
        /beginner|101|intro/i.test(e.title) ||
        /beginner|101|intro/i.test(e.category ?? ''),
    )
  }
  if (filters.publicSpacesOnly) {
    result = result.filter((e) => !/private|home|residence/i.test(e.location))
  }
  result = result.filter((e) => eventInDateWindow(e, filters))
  if (filters.topics.length) {
    result = result.filter((e) =>
      matchesTopics([e.title, e.location, e.category ?? '', ...(e.tags ?? [])], filters.topics),
    )
  }
  return result
}

export function applyExploreGroupFilters(groups: MockGroup[], filters: ExploreFilters): MockGroup[] {
  let result = groups
  if (filters.activeGroups) {
    result = [...result].sort((a, b) => (b.members ?? 0) - (a.members ?? 0))
  }
  if (filters.onlineOnly) {
    result = result.filter((g) => /online|virtual/i.test(g.description ?? '') || (g.tags?.some((t) => /online/i.test(t)) ?? false))
  }
  if (filters.topics.length) {
    result = result.filter((g) =>
      matchesTopics([g.name, g.description ?? '', ...(g.tags ?? [])], filters.topics),
    )
  }
  return result
}

export function applyExplorePeopleFilters(people: MockPerson[], filters: ExploreFilters): MockPerson[] {
  let result = people
  if (filters.verifiedOnly) result = result.filter((p) => p.verified)
  if (filters.newHere) result = result.filter((p) => (p.mutualCount ?? 0) === 0)
  if (filters.nearMe || filters.location.trim()) {
    const loc = filters.location.trim().toLowerCase()
    if (loc) result = result.filter((p) => (p.location ?? '').toLowerCase().includes(loc))
  }
  if (filters.topics.length) {
    result = result.filter((p) => matchesTopics([p.username, ...(p.roles ?? [])], filters.topics))
  }
  return result
}

export function applyExploreVendorFilters(vendors: MockVendor[], filters: ExploreFilters): MockVendor[] {
  let result = vendors
  if (filters.shipsToMe) {
    result = result.filter((v) => !/does not ship|pickup only/i.test(v.shipsTo ?? ''))
  }
  if (filters.soldExternally) {
    result = result.filter((v) => !!v.shopUrl)
  }
  if (filters.onlineOnly) {
    result = result.filter((v) => v.onlineOnly)
  }
  if (filters.topics.length) {
    result = result.filter((v) =>
      matchesTopics([v.name, ...(v.tags ?? []), ...(v.categories ?? [])], filters.topics),
    )
  }
  return result
}

export function applyExploreOrgFilters(orgs: OrgDirectoryModel[], filters: ExploreFilters): OrgDirectoryModel[] {
  let result = orgs
  if (filters.verifiedOnly) {
    result = result.filter((o) => isVerifiedOrganizer(o))
  }
  if (filters.topics.length) {
    result = result.filter((o) => matchesTopics([o.displayName, o.bio ?? '', o.roleLabel], filters.topics))
  }
  return result
}

export function applyExploreArticleFilters(
  articles: ApiEducationArticle[],
  filters: ExploreFilters,
): ApiEducationArticle[] {
  if (!filters.topics.length) return articles
  return articles.filter((a) => matchesTopics([a.title, a.excerpt ?? ''], filters.topics))
}

export function applyExploreTrendingFilters(
  items: TrendingItemCardModel[],
  filters: ExploreFilters,
): TrendingItemCardModel[] {
  if (!filters.topics.length) return items
  return items.filter((i) => matchesTopics([i.title, i.subtitle ?? '', i.kind], filters.topics))
}

export function filterMedia<T extends { title: string; description?: string | null; tags?: string[] }>(
  items: T[],
  q: string,
): T[] {
  if (!q) return items
  return items.filter(
    (item) =>
      matchesQuery(item.title, q) ||
      matchesQuery(item.description ?? '', q) ||
      (item.tags?.some((t) => matchesQuery(t, q)) ?? false),
  )
}

export function applyExploreMediaFilters<T extends { title: string; description?: string | null; tags?: string[] }>(
  items: T[],
  filters: ExploreFilters,
): T[] {
  if (!filters.topics.length) return items
  return items.filter((item) =>
    matchesTopics([item.title, item.description ?? '', ...(item.tags ?? [])], filters.topics),
  )
}
