import { sanitizeEckeExternalUrl, sanitizeEckeHeroImageUrl, sanitizeEckePublicText } from '@c2k/shared'
import type { EckeListingPayload } from './ecke-publish-payload.js'

export type EckeEventRow = {
  title: string
  slug: string
  start_date: string
  end_date: string
  display_date: string
  city: string
  state: string
  short_description: string
  long_description: string
  category: string
  logo: string
  website: string
  venue?: string | null
  /** Stored as JSON-encoded string[] in the events.features text column; ECKE parses it back to a list. */
  features?: string | null
  organizer_name: string | null
  status: 'published' | 'draft'
  c2k_source_type: string
  c2k_source_id: string
  source_attribution?: string | null
  last_synced_at?: string | null
  tags?: string[]
  seo_title?: string | null
  meta_title?: string | null
  meta_description?: string | null
}

export type EckeVendorRow = {
  slug: string
  name: string
  description: string | null
  website_url: string | null
  city: string | null
  state: string | null
  online_only: boolean
  c2k_source_type: string
  c2k_source_id: string
}

export type EckeArticleRow = {
  title: string
  slug: string
  excerpt: string
  content: string
  author_name: string
  category: string
  status: 'published' | 'draft'
  publish_date: string
  read_time: string | null
  seo_title: string | null
  meta_description: string | null
  og_image: string | null
  c2k_source_type: string
  c2k_source_id: string
}

export type EckeDungeonRow = {
  slug: string
  name: string
  description: string | null
  city: string | null
  state: string | null
  website_url: string | null
  private_address: boolean
  meta_title: string | null
  meta_description: string | null
  c2k_source_type: string
  c2k_source_id: string
}

export function isOrgDungeonListing(featureFlags: unknown): boolean {
  if (!featureFlags || typeof featureFlags !== 'object') return false
  const ff = featureFlags as Record<string, unknown>
  return (
    ff.listingKind === 'dungeon' ||
    ff.listingKind === 'venue' ||
    ff.eckeDungeonListing === true
  )
}

function parseLocationParts(location: string | null | undefined): { city: string | null; state: string | null } {
  if (!location?.trim()) return { city: null, state: null }
  const m = location.match(/,\s*([A-Z]{2})\b/i)
  const state = m ? m[1].toUpperCase() : null
  const city = location.includes(',') ? location.split(',')[0].trim() : location.trim()
  return { city: city || null, state }
}

function buildEckeEventRowCore(input: {
  listing: EckeListingPayload
  sourceId: string
  sourceType: string
  category: string
  tags: string[]
  syncedAt?: Date | null
}): EckeEventRow {
  const { listing, sourceId, sourceType, category, tags, syncedAt } = input
  const start = listing.startsAt ? listing.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const end = listing.endsAt ? listing.endsAt.slice(0, 10) : start
  const { city, state } = parseLocationParts(listing.location)
  const hidden = listing.visibility === 'hidden'
  const logo = sanitizeEckeHeroImageUrl(listing.imageUrl) ?? ''

  return {
    title: listing.title,
    slug: listing.slug,
    start_date: start,
    end_date: end,
    display_date: start,
    city: city || '',
    state: state || '',
    short_description:
      sanitizeEckePublicText((listing.description || listing.title).slice(0, 500)) ?? listing.title.slice(0, 500),
    long_description: sanitizeEckePublicText(listing.description) ?? '',
    category,
    logo,
    website: listing.website ?? '',
    venue: listing.venue ?? null,
    features: listing.features?.length ? JSON.stringify(listing.features) : null,
    organizer_name: listing.orgDisplayName || null,
    status: hidden ? 'draft' : 'published',
    c2k_source_type: sourceType,
    c2k_source_id: sourceId,
    source_attribution: 'Coast to Coast Kink organizer',
    last_synced_at: (syncedAt ?? new Date()).toISOString(),
    tags,
    seo_title: listing.title,
    meta_title: listing.title,
    meta_description: sanitizeEckePublicText(listing.description?.slice(0, 320)) ?? null,
  }
}

export function buildEckeEventRowFromListing(
  listing: EckeListingPayload,
  sourceId: string,
  sourceType = 'convention',
): EckeEventRow {
  return buildEckeEventRowCore({
    listing,
    sourceId,
    sourceType,
    category: 'Convention',
    tags: ['convention'],
  })
}

export function buildEckeEventRowFromStandaloneEvent(
  listing: EckeListingPayload,
  eventId: string,
  input?: { category?: string | null; tags?: string[] | null },
): EckeEventRow {
  const category = input?.category?.trim() || 'Event'
  const tags = input?.tags?.length ? input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : ['event']
  return buildEckeEventRowCore({
    listing,
    sourceId: eventId,
    sourceType: 'event',
    category,
    tags,
  })
}

export function buildEckeVendorRow(input: {
  id: string
  slug: string
  displayName: string
  bio?: string | null
  makerStory?: string | null
  website?: string | null
  categories?: string[] | null
  visibility: string
}): EckeVendorRow {
  const desc = sanitizeEckePublicText((input.makerStory || input.bio || '').slice(0, 12000))
  const onlineOnly = !input.website && !(input.bio || '').match(/,\s*[A-Z]{2}\b/)
  return {
    slug: input.slug.toLowerCase(),
    name: input.displayName,
    description: desc,
    website_url: sanitizeEckeExternalUrl(input.website) ?? null,
    city: null,
    state: null,
    online_only: onlineOnly,
    c2k_source_type: 'vendor_profile',
    c2k_source_id: input.id,
  }
}

export function buildEckeArticleRow(input: {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  bodyHtml: string
  authorDisplayName: string
  categories?: string[] | null
  heroImageUrl?: string | null
  readingMinutes?: number | null
  publishedAt?: Date | null
  publicationStatus: string
}): EckeArticleRow {
  const published = input.publicationStatus === 'PUBLISHED'
  const pubDate = (input.publishedAt ?? new Date()).toISOString().slice(0, 10)
  const category = input.categories?.[0] || 'Education'
  const readTime = input.readingMinutes ? `${input.readingMinutes} min read` : null

  return {
    title: input.title,
    slug: input.slug.toLowerCase(),
    excerpt: (input.excerpt || input.title).slice(0, 500),
    content: sanitizeEckePublicText(input.bodyHtml) ?? input.bodyHtml,
    author_name: input.authorDisplayName,
    category,
    status: published ? 'published' : 'draft',
    publish_date: pubDate,
    read_time: readTime,
    seo_title: input.title,
    meta_description: sanitizeEckePublicText(input.excerpt?.slice(0, 320)) ?? null,
    og_image: input.heroImageUrl ?? null,
    c2k_source_type: 'education_article',
    c2k_source_id: input.id,
  }
}

export function buildEckeDungeonRowFromOrg(input: {
  id: string
  slug: string
  displayName: string
  bio?: string | null
  websiteUrl?: string | null
  visibility: string
  city?: string | null
  state?: string | null
}): EckeDungeonRow {
  return {
    slug: input.slug.toLowerCase(),
    name: input.displayName,
    description: sanitizeEckePublicText(input.bio?.slice(0, 12000)),
    city: input.city ?? null,
    state: input.state ? input.state.slice(0, 2).toUpperCase() : null,
    website_url: input.websiteUrl ?? null,
    private_address: false,
    meta_title: input.displayName,
    meta_description: sanitizeEckePublicText(input.bio?.slice(0, 320)) ?? null,
    c2k_source_type: 'organization',
    c2k_source_id: input.id,
  }
}
