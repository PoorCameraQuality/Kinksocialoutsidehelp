import type { OrgVenueCategory } from './org-features.js'

/** Shape of one entry in EastCoast `src/data/dungeons.js`. */
export type EckeImportSourceDungeon = {
  name: string
  slug: string
  location?: {
    city?: string
    state?: string
    address?: string
    region?: string
  }
  category?: string
  excerpt?: string
  description?: string | { long?: string }
  website?: string
  logo?: string
  contact?: { email?: string }
}

export type EckeDungeonImportPlan = {
  org: {
    slug: string
    displayName: string
    bio: string | null
    externalSiteUrl: string | null
    logoWebPath: string | null
  }
  place: {
    slug: string
    name: string
    category: OrgVenueCategory
    city: string | null
    region: string | null
    country: string
    description: string | null
  }
  featureFlags: {
    listingKind: 'venue'
    eckeDungeonListing: true
    venueCategory: OrgVenueCategory
    city: string | null
    region: string | null
    country: string
    addressVisibility: 'city_only' | 'full'
  }
  eckeDungeonSlug: string
}

function resolveBio(source: EckeImportSourceDungeon): string | null {
  if (typeof source.description === 'string' && source.description.trim()) {
    return source.description.trim().slice(0, 120_000)
  }
  if (source.description && typeof source.description === 'object' && source.description.long?.trim()) {
    return source.description.long.trim().slice(0, 120_000)
  }
  if (source.excerpt?.trim()) return source.excerpt.trim().slice(0, 120_000)
  return null
}

function resolveVenueCategory(raw?: string): OrgVenueCategory {
  const c = raw?.toLowerCase() ?? ''
  if (c.includes('hotel')) return 'kink_friendly_hotel'
  if (c.includes('beach')) return 'nude_beach'
  if (c.includes('web') || c.includes('resource')) return 'web_resource'
  if (c.includes('dungeon') || c.includes('club') || c.includes('collective') || c.includes('playspace')) {
    return 'dungeon_club'
  }
  return 'dungeon_club'
}

function resolveExternalSiteUrl(website?: string): string | null {
  if (!website?.trim()) return null
  try {
    return new URL(website.trim()).toString()
  } catch {
    return null
  }
}

export function mapEckeDungeonToImport(source: EckeImportSourceDungeon): EckeDungeonImportPlan {
  const city = source.location?.city?.trim() || null
  const region = source.location?.state?.trim() || source.location?.region?.trim() || null
  const venueCategory = resolveVenueCategory(source.category)
  const bio = resolveBio(source)

  return {
    org: {
      slug: source.slug.toLowerCase(),
      displayName: source.name.trim(),
      bio,
      externalSiteUrl: resolveExternalSiteUrl(source.website),
      logoWebPath: source.logo?.trim() || null,
    },
    place: {
      slug: source.slug.toLowerCase(),
      name: source.name.trim(),
      category: venueCategory,
      city,
      region,
      country: 'US',
      description: bio,
    },
    featureFlags: {
      listingKind: 'venue',
      eckeDungeonListing: true,
      venueCategory,
      city,
      region,
      country: 'US',
      addressVisibility: source.location?.address?.trim() ? 'full' : 'city_only',
    },
    eckeDungeonSlug: source.slug.toLowerCase(),
  }
}
