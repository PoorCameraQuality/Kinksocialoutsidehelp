import type { ConventionPublicSettings } from '../db/schema.js'

/** Shape of one entry in EastCoast `src/data/events.js`. */
export type EckeImportSourceEvent = {
  name: string
  slug: string
  date: { start: string; end: string; display?: string }
  location: { city?: string; state?: string; region?: string }
  category: string
  excerpt?: string
  longDescription?: string
  website?: string
  organizer?: string
  venue?: string
  hotel?: string
  features?: string[]
  logo?: string
}

export type EckeImportPlan = {
  org: {
    slug: string
    displayName: string
    bio: string | null
    externalSiteUrl: string | null
    logoWebPath: string | null
  }
  convention: {
    slug: string
    name: string
    description: string | null
    startsAt: Date
    endsAt: Date
    timezone: string
    settings: ConventionPublicSettings
  }
  anchorEvent: {
    title: string
    description: string | null
    startsAt: Date
    endsAt: Date
    location: string | null
    publicLocationSummary: string | null
    category: string | null
    imageWebPath: string | null
  }
  eckeEventSlug: string
}

export function slugifyEckeOrganizer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function parseEckeDayStart(isoDay: string): Date {
  return new Date(`${isoDay.slice(0, 10)}T12:00:00.000Z`)
}

function parseEckeDayEnd(isoDay: string): Date {
  return new Date(`${isoDay.slice(0, 10)}T23:59:59.000Z`)
}

function resolveOrganizerSlug(event: EckeImportSourceEvent): { slug: string; displayName: string } {
  const organizer = event.organizer?.trim()
  if (organizer) {
    const slug = slugifyEckeOrganizer(organizer)
    if (slug.length >= 2) return { slug, displayName: organizer }
  }
  const fromName = slugifyEckeOrganizer(event.name)
  return {
    slug: fromName.length >= 2 ? fromName : event.slug,
    displayName: event.organizer?.trim() || event.name,
  }
}

function resolveExternalSiteUrl(website?: string): string | null {
  const raw = website?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function resolveLocationSummary(event: EckeImportSourceEvent): string {
  const cityState = [event.location?.city, event.location?.state].filter(Boolean).join(', ')
  const venue = event.venue?.trim()
  if (cityState && venue) return `${venue}, ${cityState}`
  return venue || cityState || event.location?.region?.trim() || ''
}

/** Map one ECKE static listing into a 1:1 C2K org + convention + anchor event plan. */
export function mapEckeEventToImport(event: EckeImportSourceEvent): EckeImportPlan {
  const { slug: orgSlug, displayName: orgDisplayName } = resolveOrganizerSlug(event)
  const startsAt = parseEckeDayStart(event.date.start)
  const endsAt = parseEckeDayEnd(event.date.end)
  const locationSummary = resolveLocationSummary(event)
  const description = event.longDescription?.trim() || event.excerpt?.trim() || null
  const highlights = (event.features ?? []).map((f) => f.trim()).filter(Boolean).slice(0, 12)
  const externalSite = resolveExternalSiteUrl(event.website)
  const orgWebsite =
    externalSite ?
      (() => {
        try {
          const u = new URL(externalSite)
          return `${u.protocol}//${u.host}/`
        } catch {
          return externalSite
        }
      })()
    : null

  const settings: ConventionPublicSettings = {
    eckeListingSlug: event.slug.toLowerCase(),
    dancecardSlug: event.slug.toLowerCase(),
    eckeListing: {
      highlights,
      venueName: event.venue?.trim() || null,
      websiteUrl: externalSite,
    },
    publicProgramListing: true,
    dancecardEnabled: true,
    dancecardPublishStatus: 'draft',
  }

  return {
    org: {
      slug: orgSlug,
      displayName: orgDisplayName,
      bio: description ? description.slice(0, 200_000) : null,
      externalSiteUrl: orgWebsite,
      logoWebPath: event.logo?.trim() || null,
    },
    convention: {
      slug: event.slug.toLowerCase(),
      name: event.name.trim(),
      description,
      startsAt,
      endsAt,
      timezone: 'America/New_York',
      settings,
    },
    anchorEvent: {
      title: event.name.trim(),
      description,
      startsAt,
      endsAt,
      location: locationSummary || null,
      publicLocationSummary: locationSummary || null,
      category: event.category?.trim() || null,
      imageWebPath: event.logo?.trim() || null,
    },
    eckeEventSlug: event.slug.toLowerCase(),
  }
}
