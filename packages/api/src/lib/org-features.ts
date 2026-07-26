export type OrgListingKind = 'community' | 'venue'

export type OrgVenueCategory =
  | 'dungeon_club'
  | 'nude_beach'
  | 'kink_friendly_hotel'
  | 'web_resource'
  | 'other'

export type OrgAddressVisibility = 'city_only' | 'full'

export type OrgFeatureFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  subgroupsEnabled: boolean
  chatEnabled: boolean
  externalEmbedEnabled: boolean
  listingKind: OrgListingKind
  eckeDungeonListing: boolean
  venueCategory: OrgVenueCategory | null
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  addressVisibility: OrgAddressVisibility
}

export const DEFAULT_ORG_FEATURE_FLAGS: OrgFeatureFlags = {
  calendarEnabled: true,
  forumsEnabled: true,
  subgroupsEnabled: false,
  chatEnabled: true,
  externalEmbedEnabled: false,
  listingKind: 'community',
  eckeDungeonListing: false,
  venueCategory: null,
  city: null,
  region: null,
  country: null,
  lat: null,
  lng: null,
  addressVisibility: 'city_only',
}

const VENUE_CATEGORIES: readonly OrgVenueCategory[] = [
  'dungeon_club',
  'nude_beach',
  'kink_friendly_hotel',
  'web_resource',
  'other',
]

function normalizeListingKind(raw: unknown): OrgListingKind {
  if (raw === 'venue' || raw === 'dungeon') return 'venue'
  return 'community'
}

function parseVenueCategory(raw: unknown): OrgVenueCategory | null {
  if (typeof raw === 'string' && (VENUE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as OrgVenueCategory
  }
  return null
}

function parseOptionalString(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function parseOptionalNumber(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return raw
}

export function isOrgVenueListing(flags: OrgFeatureFlags | unknown): boolean {
  const parsed = typeof flags === 'object' && flags !== null && 'listingKind' in flags
    ? (flags as OrgFeatureFlags)
    : parseOrgFeatureFlags(flags)
  return parsed.listingKind === 'venue' || parsed.eckeDungeonListing
}

export function parseOrgFeatureFlags(raw: unknown): OrgFeatureFlags {
  const base = { ...DEFAULT_ORG_FEATURE_FLAGS }
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_ORG_FEATURE_FLAGS) as (keyof OrgFeatureFlags)[]) {
    if (key === 'listingKind') {
      base.listingKind = normalizeListingKind(r.listingKind)
      continue
    }
    if (key === 'eckeDungeonListing') {
      base.eckeDungeonListing =
        r.eckeDungeonListing === true || normalizeListingKind(r.listingKind) === 'venue'
      continue
    }
    if (key === 'venueCategory') {
      base.venueCategory = parseVenueCategory(r.venueCategory)
      continue
    }
    if (key === 'city') {
      base.city = parseOptionalString(r.city, 128)
      continue
    }
    if (key === 'region') {
      base.region = parseOptionalString(r.region, 128)
      continue
    }
    if (key === 'country') {
      base.country = parseOptionalString(r.country, 128)
      continue
    }
    if (key === 'lat') {
      base.lat = parseOptionalNumber(r.lat)
      continue
    }
    if (key === 'lng') {
      base.lng = parseOptionalNumber(r.lng)
      continue
    }
    if (key === 'addressVisibility') {
      base.addressVisibility = r.addressVisibility === 'full' ? 'full' : 'city_only'
      continue
    }
    const v = r[key]
    if (typeof v === 'boolean') base[key] = v
  }
  if (base.listingKind === 'venue') base.eckeDungeonListing = true
  return base
}

export function serializeOrgFeatureFlags(f: Partial<OrgFeatureFlags>): OrgFeatureFlags {
  const merged = { ...DEFAULT_ORG_FEATURE_FLAGS, ...f }
  merged.listingKind = normalizeListingKind(merged.listingKind)
  if (merged.listingKind === 'venue') {
    merged.eckeDungeonListing = true
    if (!merged.venueCategory) merged.venueCategory = 'dungeon_club'
  } else {
    merged.eckeDungeonListing = false
  }
  return merged
}

/** Legacy JSONB may use listingKind: 'dungeon'. */
export function venueOrgFeatureFlags(
  overrides: Partial<OrgFeatureFlags> = {},
): Record<string, unknown> {
  const flags = serializeOrgFeatureFlags({
    ...overrides,
    listingKind: 'venue',
    eckeDungeonListing: true,
  })
  return {
    ...flags,
    listingKind: 'dungeon',
  }
}
