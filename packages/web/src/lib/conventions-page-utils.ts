import { demoMockImageUrl, mockPeople } from '@/data/mock-data'
import {
  formatConventionDateRange,
  isMultiDayConventionSpan,
  type ConventionKind,
} from '@/lib/convention-utils'
import type { HomeConventionRow } from '@/hooks/useHomeSurface'

export type ConventionEventType = 'multi_day' | 'one_day' | 'hotel_takeover' | 'online'

export const CONVENTION_EVENT_TYPE_LABELS: Record<ConventionEventType, string> = {
  multi_day: 'Multi-day',
  one_day: 'One-day',
  hotel_takeover: 'Hotel Takeover',
  online: 'Online',
}

export const CONVENTION_LOCATION_OPTIONS = [
  { value: '', label: 'Any location' },
  { value: 'us-northeast', label: 'US Northeast' },
  { value: 'us-southeast', label: 'US Southeast' },
  { value: 'us-midwest', label: 'US Midwest' },
  { value: 'us-west', label: 'US West' },
  { value: 'online', label: 'Online only' },
] as const

export type ConventionDiscoverView = {
  row: HomeConventionRow
  description: string
  location: string
  locationRegion: string
  badges: string[]
  featured: boolean
  eventType: ConventionEventType
  durationLabel: string
  eventCount: number
  venueType: string
  goingCount: number
  heroUrl: string
  goingPreview: Array<{ username: string; avatarUrl?: string | null }>
}

const DISCOVER_EXTRAS: Record<
  string,
  Partial<{
    description: string
    location: string
    locationRegion: string
    badges: string[]
    featured: boolean
    eventCount: number
    venueType: string
    goingCount: number
    online: boolean
  }>
> = {
  'mid-atlantic-rigger-con-2025': {
    description:
      'Four days of rope education, contests, and community socials across multiple hotel ballrooms.',
    location: 'Baltimore, MD',
    locationRegion: 'us-northeast',
    badges: ['Featured', 'Registration Open'],
    featured: true,
    eventCount: 48,
    venueType: 'Convention center',
    goingCount: 412,
  },
  'dark-spring-weekend': {
    description: 'Hotel takeover weekend with parties, demos, and vendor market on every floor.',
    location: 'Philadelphia, PA',
    locationRegion: 'us-northeast',
    badges: ['Featured', 'Early Bird'],
    featured: true,
    eventCount: 22,
    venueType: 'Hotel takeover',
    goingCount: 286,
  },
  'coastal-education-summit': {
    description: 'Classes, panels, and certification tracks for educators and community leaders.',
    location: 'Norfolk, VA',
    locationRegion: 'us-southeast',
    badges: ['Registration Open'],
    featured: false,
    eventCount: 36,
    venueType: 'Resort campus',
    goingCount: 198,
  },
  'pride-rope-festival': {
    description: 'Celebration weekend with performances, outdoor rigging, and late-night socials.',
    location: 'Asheville, NC',
    locationRegion: 'us-southeast',
    badges: ['Early Bird'],
    featured: false,
    eventCount: 31,
    venueType: 'Downtown venues',
    goingCount: 524,
  },
}

export function classifyConventionEventType(row: HomeConventionRow): ConventionEventType {
  const extras = DISCOVER_EXTRAS[row.slug]
  if (extras?.online) return 'online'
  if (row.kind === 'hotel_takeover') return 'hotel_takeover'
  if (row.startsAt && row.endsAt && isMultiDayConventionSpan(row.startsAt, row.endsAt)) return 'multi_day'
  if (row.startsAt && row.endsAt) return 'one_day'
  return 'multi_day'
}

export function countConventionsByEventType(rows: HomeConventionRow[]): Map<ConventionEventType, number> {
  const counts = new Map<ConventionEventType, number>()
  for (const t of Object.keys(CONVENTION_EVENT_TYPE_LABELS) as ConventionEventType[]) {
    counts.set(t, 0)
  }
  for (const row of rows) {
    const t = classifyConventionEventType(row)
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

function durationDays(row: HomeConventionRow): number {
  if (!row.startsAt || !row.endsAt) return 3
  const a = new Date(row.startsAt)
  const b = new Date(row.endsAt)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 3
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)))
}

function defaultVenueType(kind?: ConventionKind): string {
  return kind === 'hotel_takeover' ? 'Hotel takeover' : 'Convention hotel'
}

export function enrichConventionForDiscover(row: HomeConventionRow): ConventionDiscoverView {
  const extras = DISCOVER_EXTRAS[row.slug]
  const eventType = classifyConventionEventType(row)
  const days = durationDays(row)
  const goingCount = extras?.goingCount ?? 120 + (row.slug.length % 80) * 3
  const preview = mockPeople
    .filter((p) => p.avatarUrl)
    .slice(0, 3)
    .map((p) => ({ username: p.username, avatarUrl: p.avatarUrl ?? null }))

  return {
    row,
    description:
      extras?.description ??
      'Multi-day gathering with full program, registration, and attendee hub on Kink Social.',
    location: extras?.location ?? 'Venue announced on hub',
    locationRegion: extras?.locationRegion ?? 'us-northeast',
    badges: extras?.badges ?? (eventType === 'hotel_takeover' ? ['Hotel Takeover'] : []),
    featured: extras?.featured ?? false,
    eventType,
    durationLabel: `${days} day${days === 1 ? '' : 's'}`,
    eventCount: extras?.eventCount ?? 24,
    venueType: extras?.venueType ?? defaultVenueType(row.kind),
    goingCount,
    heroUrl: demoMockImageUrl(`convention-discover-${row.slug}`, 960, 540),
    goingPreview: preview,
  }
}

export function formatConventionListDateBlock(row: HomeConventionRow): {
  month: string
  day: string
  year: string
} {
  const raw = row.startsAt
  const d = raw ? new Date(raw) : null
  if (!d || Number.isNaN(d.getTime())) {
    return { month: 'TBD', day: '-', year: '' }
  }
  return {
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    year: String(d.getFullYear()),
  }
}

export function conventionDateRangeLabel(row: HomeConventionRow): string {
  return formatConventionDateRange(row.startsAt, row.endsAt) || 'Dates TBA'
}

export type ConventionFilterInput = {
  searchQuery: string
  dateRange: { start: string; end: string }
  locationRegion: string
  selectedEventTypes: ConventionEventType[]
  pastView: boolean
}

export function filterConventions(rows: HomeConventionRow[], filters: ConventionFilterInput): HomeConventionRow[] {
  const now = Date.now()
  const q = filters.searchQuery.trim().toLowerCase()

  return rows.filter((row) => {
    const view = enrichConventionForDiscover(row)
    const start = row.startsAt ? new Date(row.startsAt).getTime() : NaN
    const end = row.endsAt ? new Date(row.endsAt).getTime() : start

    if (filters.pastView) {
      if (!Number.isNaN(end) && end >= now) return false
    } else if (!Number.isNaN(start) && start < now && !Number.isNaN(end) && end < now) {
      return false
    }

    if (q) {
      const hay = `${row.name} ${view.location} ${view.description}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    if (filters.dateRange.start) {
      const filterStart = new Date(filters.dateRange.start).getTime()
      if (!Number.isNaN(filterStart) && !Number.isNaN(end) && end < filterStart) return false
    }
    if (filters.dateRange.end) {
      const filterEnd = new Date(filters.dateRange.end).getTime()
      if (!Number.isNaN(filterEnd) && !Number.isNaN(start) && start > filterEnd) return false
    }

    if (filters.locationRegion) {
      if (filters.locationRegion === 'online' && view.eventType !== 'online') return false
      if (filters.locationRegion !== 'online' && view.locationRegion !== filters.locationRegion) return false
    }

    if (filters.selectedEventTypes.length > 0) {
      if (!filters.selectedEventTypes.includes(view.eventType)) return false
    }

    return true
  })
}

export function pickFeaturedConventions(rows: HomeConventionRow[], limit = 2): ConventionDiscoverView[] {
  const enriched = rows.map(enrichConventionForDiscover)
  const featured = enriched.filter((v) => v.featured)
  const pool = featured.length >= limit ? featured : enriched
  return pool.slice(0, limit)
}

export function listConventionsExcludingFeatured(
  rows: HomeConventionRow[],
  featured: ConventionDiscoverView[],
): HomeConventionRow[] {
  const featuredIds = new Set(featured.map((f) => f.row.id))
  return rows.filter((r) => !featuredIds.has(r.id))
}
