/**
 * Discovery and ranking utilities for mock data.
 * Pure functions - easy to replace with API calls later.
 */

import type { MockGroup, MockEvent, MockPerson, MockVendor } from '@/data/mock-data'

export const MOCK_USER_LOCATION = 'Chambersburg, PA'

/** Max distance (mi) when no filter applied; beyond this we don't filter by location */
export const MAX_DISTANCE_MI = 200

/** Distance per "step" when filtering (mi) */
export const DISTANCE_STEP_MI = 25

/** Group size buckets for diversity ranking */
export const GROUP_SIZE_SMALL = 50
export const GROUP_SIZE_MEDIUM = 120

/** Event RSVP buckets for diversity ranking */
export const EVENT_RSVP_SMALL = 50
export const EVENT_RSVP_MEDIUM = 150

/** Trust score threshold for "event active" filter */
export const EVENT_ACTIVE_TRUST_MIN = 40

/** Vendor rating buckets for diversity ranking */
export const RATING_LOW = 4.2
export const RATING_MID = 4.6

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

const LOCATIONS = [
  'Chambersburg, PA', 'Frederick, MD', 'Philadelphia, PA', 'Baltimore, MD', 'Harrisburg, PA',
  'York, PA', 'Pittsburgh, PA', 'Washington, DC', 'New York, NY', 'Boston, MA',
  'Chicago, IL', 'Atlanta, GA', 'Austin, TX', 'Denver, CO', 'Seattle, WA',
  'San Francisco, CA', 'Los Angeles, CA', 'Miami, FL', 'Portland, OR', 'Minneapolis, MN',
]

function getLocationIndex(location: string | undefined): number {
  if (!location) return LOCATIONS.length
  const idx = LOCATIONS.findIndex((loc) => loc.toLowerCase().includes(location.toLowerCase().split(',')[0]))
  return idx >= 0 ? idx : LOCATIONS.length
}

function getDistanceFromUser(location: string | undefined): number {
  const userIdx = getLocationIndex(MOCK_USER_LOCATION)
  const itemIdx = getLocationIndex(location)
  return Math.abs(itemIdx - userIdx)
}

/** Generic text search - filter items where any field contains query (case-insensitive) */
export function applyTextSearch<T>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  const queryLower = query.trim().toLowerCase()
  if (!queryLower) return items
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field]
      if (value == null) return false
      const str = Array.isArray(value) ? value.join(' ') : String(value)
      return str.toLowerCase().includes(queryLower)
    })
  )
}

/**
 * Reorder items so no more than maxConsecutive share the same bucket.
 * Used for "diverse" sort to avoid long runs of similar-sized groups/events.
 */
export function injectDiversity<T>(
  items: T[],
  keyFn: (item: T) => string,
  maxConsecutive = 2
): T[] {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
  }
  const result: T[] = []
  const keys = Array.from(buckets.keys())
  let round = 0
  while (result.length < items.length) {
    let added = 0
    for (let i = 0; i < maxConsecutive; i++) {
      for (const key of keys) {
        const arr = buckets.get(key)!
        const idx = round * maxConsecutive + i
        if (idx < arr.length) {
          result.push(arr[idx])
          added++
        }
      }
    }
    round++
    if (added === 0) break
  }
  return result
}

export type RankGroupsOptions = {
  searchQuery?: string
  distanceMi?: number
  sortBy?: 'relevance' | 'new' | 'nearby' | 'diverse'
  visibility?: 'public' | 'private' | 'invite-only'
  category?: string
  cityFilter?: string
  countryFilter?: string
}

function locationMatchesFilter(location: string | undefined, filter: string | undefined): boolean {
  const q = filter?.trim().toLowerCase()
  if (!q) return true
  return (location ?? '').toLowerCase().includes(q)
}

export function rankGroups(items: MockGroup[], options: RankGroupsOptions = {}): MockGroup[] {
  let result = [...items]
  const {
    searchQuery,
    distanceMi = MAX_DISTANCE_MI,
    sortBy = 'diverse',
    visibility,
    category,
    cityFilter,
    countryFilter,
  } = options

  if (searchQuery) {
    result = applyTextSearch(result, searchQuery, ['name', 'description', 'location', 'tags'])
  }
  if (visibility) {
    result = result.filter((g) => g.visibility === visibility)
  }
  if (category) {
    result = result.filter((g) => g.category === category)
  }
  if (cityFilter?.trim()) {
    result = result.filter((g) => locationMatchesFilter(g.placeLabel ?? g.location, cityFilter))
  }
  if (countryFilter?.trim()) {
    result = result.filter((g) => locationMatchesFilter(g.placeLabel ?? g.location, countryFilter))
  }
  if (distanceMi < MAX_DISTANCE_MI) {
    const maxDist = Math.ceil(distanceMi / DISTANCE_STEP_MI)
    result = result.filter((g) => {
      if (g.distanceMi != null) return g.distanceMi <= distanceMi
      return getDistanceFromUser(g.placeLabel ?? g.location) <= maxDist
    })
  }

  switch (sortBy) {
    case 'relevance':
      result.sort((a, b) => (b.members ?? 0) - (a.members ?? 0))
      break
    case 'new':
      result.sort((a, b) => {
        const aDate = (a as MockGroup & { createdAt?: string }).createdAt ?? ''
        const bDate = (b as MockGroup & { createdAt?: string }).createdAt ?? ''
        return (bDate || 'zzz').localeCompare(aDate || 'zzz')
      })
      break
    case 'nearby':
      result.sort((a, b) => {
        const da = a.distanceMi ?? getDistanceFromUser(a.placeLabel ?? a.location)
        const db = b.distanceMi ?? getDistanceFromUser(b.placeLabel ?? b.location)
        return da - db
      })
      break
    case 'diverse':
    default:
      result = injectDiversity(result, (g) => {
        const m = g.members ?? 0
        return m < GROUP_SIZE_SMALL ? 'small' : m < GROUP_SIZE_MEDIUM ? 'medium' : 'large'
      })
  }
  return result
}

/** Parses "Wed, Feb 18 at 6:00 PM" format. Uses 2026 as default year. */
function parseShortDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\w{3}), (\w{3}) (\d{1,2}) at (\d{1,2}):(\d{2}) (AM|PM)/)
  if (!match) return null
  const [, month, day] = match
  return new Date(2026, MONTH_MAP[month] ?? 0, parseInt(day, 10))
}

/** Parses "Sep 4–7, 2026" range format. Returns start date. */
function parseLongDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\w{3}) (\d{1,2})–(\d{1,2}), (\d{4})/)
  if (!match) return null
  const [, month, startDay, year] = match
  return new Date(parseInt(year, 10), MONTH_MAP[month] ?? 0, parseInt(startDay, 10))
}

/** Parses mock event date strings, ISO timestamps from the API, or range format. */
function parseEventDate(dateStr: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr) || dateStr.includes('T')) {
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) return d
  }
  return parseShortDate(dateStr) ?? parseLongDate(dateStr)
}

export type RankEventsOptions = {
  searchQuery?: string
  dateRange?: { start: string; end: string }
  /** Single category (legacy); prefer `categories` for multi-select. */
  category?: string
  /** Match any of these canonical categories (OR). */
  categories?: readonly string[]
  /** When set, only in-person or only virtual events. */
  eventFormat?: 'in-person' | 'virtual'
  distanceMi?: number
  /** Substring match on event location (city/region). */
  cityFilter?: string
  /** Substring match on event location (country). */
  countryFilter?: string
  sortBy?: 'soon' | 'relevance' | 'diverse' | 'new'
}

export function rankEvents(items: MockEvent[], options: RankEventsOptions = {}): MockEvent[] {
  let result = [...items]
  const {
    searchQuery,
    dateRange,
    category,
    categories,
    eventFormat,
    distanceMi = MAX_DISTANCE_MI,
    cityFilter,
    countryFilter,
    sortBy = 'soon',
  } = options

  const categorySet =
    categories?.length ? new Set(categories)
    : category ? new Set([category])
    : null

  if (searchQuery) {
    result = applyTextSearch(result, searchQuery, ['title', 'location', 'description'] as (keyof MockEvent)[])
  }
  if (cityFilter?.trim()) {
    result = result.filter((e) => locationMatchesFilter(e.location, cityFilter))
  }
  if (countryFilter?.trim()) {
    result = result.filter((e) => locationMatchesFilter(e.location, countryFilter))
  }
  if (categorySet && categorySet.size > 0) {
    result = result.filter((e) => e.category != null && categorySet.has(e.category))
  }
  if (eventFormat) {
    result = result.filter((e) => (e.eventFormat ?? 'in-person') === eventFormat)
  }
  if (distanceMi < MAX_DISTANCE_MI) {
    const maxDist = Math.ceil(distanceMi / DISTANCE_STEP_MI)
    result = result.filter((e) => {
      if (e.eventFormat === 'virtual') return true
      return getDistanceFromUser(e.location) <= maxDist
    })
  }
  if (dateRange?.start || dateRange?.end) {
    const startDate = dateRange.start ? new Date(dateRange.start) : null
    const endDate = dateRange.end ? new Date(dateRange.end) : null
    const hasValidRange = (startDate && !isNaN(startDate.getTime())) || (endDate && !isNaN(endDate.getTime()))
    if (hasValidRange) {
      result = result.filter((e) => {
        const d = parseEventDate(e.startsAt ?? e.date)
        if (!d) return true
        if (startDate && !isNaN(startDate.getTime()) && d < startDate) return false
        if (endDate && !isNaN(endDate.getTime()) && d > endDate) return false
        return true
      })
    }
  }

  switch (sortBy) {
    case 'relevance':
      result.sort((a, b) => (b.rsvpCount ?? 0) - (a.rsvpCount ?? 0))
      break
    case 'diverse':
      result = injectDiversity(result, (e) => {
        const r = e.rsvpCount ?? 0
        return r < EVENT_RSVP_SMALL ? 'small' : r < EVENT_RSVP_MEDIUM ? 'medium' : 'large'
      })
      break
    case 'new': {
      result.sort((a, b) => {
        const ta = parseEventDate(a.startsAt ?? a.date)?.getTime() ?? 0
        const tb = parseEventDate(b.startsAt ?? b.date)?.getTime() ?? 0
        if (tb !== ta) return tb - ta
        return String(a.id).localeCompare(String(b.id))
      })
      break
    }
    case 'soon':
    default:
      result.sort((a, b) => {
        const da = parseEventDate(a.startsAt ?? a.date)?.getTime() ?? Infinity
        const db = parseEventDate(b.startsAt ?? b.date)?.getTime() ?? Infinity
        return da - db
      })
  }
  return result
}

export type RankPeopleOptions = {
  searchQuery?: string
  roles?: string[]
  /** Substring match on `person.gender` (mock / client-side parity with API `gender` query). */
  genderFilter?: string
  verifiedOnly?: boolean
  eventActiveOnly?: boolean
  distanceMi?: number
  /** Substring match on profile location (client-side). */
  cityFilter?: string
  countryFilter?: string
  sortBy?: 'relevance' | 'trust' | 'diverse' | 'nearby' | 'new' | 'active'
}

export function rankPeople(items: MockPerson[], options: RankPeopleOptions = {}): MockPerson[] {
  let result = [...items]
  const {
    searchQuery,
    roles,
    genderFilter,
    verifiedOnly,
    eventActiveOnly,
    distanceMi = MAX_DISTANCE_MI,
    cityFilter,
    countryFilter,
    sortBy = 'diverse',
  } = options

  if (searchQuery) {
    result = applyTextSearch(result, searchQuery, ['username', 'sceneName', 'roles', 'location'] as (keyof MockPerson)[])
  }
  const gq = genderFilter?.trim().toLowerCase()
  if (gq) {
    result = result.filter((p) => (p.gender ?? '').toLowerCase().includes(gq))
  }
  if (cityFilter?.trim()) {
    result = result.filter((p) => locationMatchesFilter(p.location, cityFilter))
  }
  if (countryFilter?.trim()) {
    result = result.filter((p) => locationMatchesFilter(p.location, countryFilter))
  }
  if (roles?.length) {
    result = result.filter((p) => roles.some((r) => p.roles?.includes(r)))
  }
  if (verifiedOnly) {
    result = result.filter((p) => p.verified)
  }
  if (eventActiveOnly) {
    result = result.filter(
      (p) => p.badges?.includes('event_verified') || p.verified || (p.roles ?? []).some((r) => /event/i.test(r))
    )
  }
  if (distanceMi < MAX_DISTANCE_MI) {
    const maxDist = Math.ceil(distanceMi / DISTANCE_STEP_MI)
    result = result.filter((p) => getDistanceFromUser(p.location) <= maxDist)
  }

  switch (sortBy) {
    case 'relevance':
    case 'trust':
      result.sort((a, b) => {
        const ta = Date.parse(a.lastActiveAt ?? '') || 0
        const tb = Date.parse(b.lastActiveAt ?? '') || 0
        return tb - ta
      })
      break
    case 'nearby':
      result.sort((a, b) => getDistanceFromUser(a.location) - getDistanceFromUser(b.location))
      break
    case 'new':
      result.sort((a, b) => a.username.localeCompare(b.username))
      break
    case 'active':
      result.sort((a, b) => {
        const ta = Date.parse(a.lastActiveAt ?? '') || 0
        const tb = Date.parse(b.lastActiveAt ?? '') || 0
        return tb - ta
      })
      break
    case 'diverse':
    default:
      result = injectDiversity(result, (p) => p.trustTier ?? 'bronze')
  }
  return result
}

export type RankVendorsOptions = {
  searchQuery?: string
  sortBy?: 'relevance' | 'rating' | 'diverse' | 'new' | 'nearby'
}

export function rankVendors(items: MockVendor[], options: RankVendorsOptions = {}): MockVendor[] {
  let result = [...items]
  const { searchQuery, sortBy = 'diverse' } = options

  if (searchQuery) {
    result = applyTextSearch(result, searchQuery, ['name', 'categories', 'description'] as (keyof MockVendor)[])
  }

  switch (sortBy) {
    case 'relevance':
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      break
    case 'rating':
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      break
    case 'new': {
      result.sort((a, b) => String(a.id).localeCompare(String(b.id)))
      break
    }
    case 'nearby':
      result = injectDiversity(result, (v) => {
        const r = v.rating ?? 0
        return r < RATING_LOW ? 'low' : r < RATING_MID ? 'mid' : 'high'
      })
      break
    case 'diverse':
    default:
      result = injectDiversity(result, (v) => {
        const r = v.rating ?? 0
        return r < RATING_LOW ? 'low' : r < RATING_MID ? 'mid' : 'high'
      })
  }
  return result
}
