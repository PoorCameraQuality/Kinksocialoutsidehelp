import {
  buildKinkSocialIdempotencyKey,
  KINK_SOCIAL_SOURCE_SYSTEM,
  type EckeEventPayload,
  type EckePublicEntityType,
  type KinkSocialPublicIngestEnvelope,
  type KinkSocialUnpublishEnvelope,
} from '@c2k/shared'
import type { EckeEventRow } from './ecke-directory-sync.js'
import { isEckeEventIngestEnabled, isEckePlaceIngestEnabled, isEckeVendorIngestEnabled } from './ecke-publish-config.js'
import { kinkSocialPublicWebBase } from './ecke-public-publish.js'

/** Convention subtype marker for ECKE Events surface (/events/{slug}). */
export type EckeEventSourceType = 'event' | 'convention'

export type EckePlaceKind = 'dungeon' | 'club' | 'venue' | 'other'

export type EckePlacePrivacyMode = 'public_summary_only' | 'public_address_ok'

/** Place ingest payload — future community_places source. */
export type EckePlaceIngestPayload = {
  name: string
  slug: string
  placeKind: EckePlaceKind
  privacyMode: EckePlacePrivacyMode
  description?: string | null
  publicLocationSummary?: string | null
  city?: string | null
  state?: string | null
  publicAddress?: string | null
  publicImageUrl?: string | null
  publicWebsiteUrl?: string | null
  tags?: string[]
  seoTitle?: string | null
  metaDescription?: string | null
  updatedAt: string
}

/** Vendor ingest payload — mirrors future vendor_profile ingest. */
export type EckeVendorIngestPayload = {
  displayName: string
  slug: string
  tagline?: string | null
  description?: string | null
  city?: string | null
  state?: string | null
  publicImageUrl?: string | null
  publicShopUrl?: string | null
  tags?: string[]
  categories?: string[]
  seoTitle?: string | null
  metaDescription?: string | null
  updatedAt: string
}

export type BuildEckeEventIngestInput = {
  sourceId: string
  sourceUpdatedAt: string
  c2kSourceType: EckeEventSourceType
  preferredSlug: string
  canonicalKinkSocialPath: string
  payload: EckeEventPayload
}

export type BuildEckePlaceIngestInput = {
  sourceId: string
  sourceUpdatedAt: string
  preferredSlug: string
  canonicalKinkSocialPath: string
  payload: EckePlaceIngestPayload
}

export type BuildEckeVendorIngestInput = {
  sourceId: string
  sourceUpdatedAt: string
  preferredSlug: string
  canonicalKinkSocialPath: string
  payload: EckeVendorIngestPayload
}

function canonicalUrl(path: string): string {
  const base = kinkSocialPublicWebBase().replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** Strips private address fields when place privacy mode forbids them. */
export function redactPlacePayloadForPrivacy(payload: EckePlaceIngestPayload): EckePlaceIngestPayload {
  if (payload.privacyMode === 'public_summary_only') {
    return { ...payload, publicAddress: null }
  }
  return payload
}

export function buildEckeEventIngestEnvelope(
  input: BuildEckeEventIngestInput,
): KinkSocialPublicIngestEnvelope<EckeEventPayload & { c2k_source_type: EckeEventSourceType }> {
  const entityType = input.c2kSourceType === 'convention' ? 'convention' : 'event'
  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType,
    sourceId: input.sourceId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    action: 'upsert',
    visibility: 'PUBLIC',
    publishToEcke: true,
    publicSafe: true,
    idempotencyKey: buildKinkSocialIdempotencyKey(entityType, input.sourceId),
    canonicalKinkSocialUrl: canonicalUrl(input.canonicalKinkSocialPath),
    preferredSlug: input.preferredSlug,
    allowSlugSuffix: false,
    payload: {
      ...input.payload,
      c2k_source_type: input.c2kSourceType,
    },
  }
}

export function buildEckePlaceIngestEnvelope(
  input: BuildEckePlaceIngestInput,
): KinkSocialPublicIngestEnvelope<EckePlaceIngestPayload> {
  const payload = redactPlacePayloadForPrivacy(input.payload)
  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType: 'place',
    sourceId: input.sourceId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    action: 'upsert',
    visibility: 'PUBLIC',
    publishToEcke: true,
    publicSafe: true,
    idempotencyKey: buildKinkSocialIdempotencyKey('place', input.sourceId),
    canonicalKinkSocialUrl: canonicalUrl(input.canonicalKinkSocialPath),
    preferredSlug: input.preferredSlug,
    allowSlugSuffix: false,
    payload,
  }
}

export function buildEckeVendorIngestEnvelope(
  input: BuildEckeVendorIngestInput,
): KinkSocialPublicIngestEnvelope<EckeVendorIngestPayload> {
  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType: 'vendor',
    sourceId: input.sourceId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    action: 'upsert',
    visibility: 'PUBLIC',
    publishToEcke: true,
    publicSafe: true,
    idempotencyKey: buildKinkSocialIdempotencyKey('vendor', input.sourceId),
    canonicalKinkSocialUrl: canonicalUrl(input.canonicalKinkSocialPath),
    preferredSlug: input.preferredSlug,
    allowSlugSuffix: false,
    payload: input.payload,
  }
}

/** Returns envelope only when the matching ingest flag is enabled; otherwise null (no send). */
export function buildEckeEventIngestEnvelopeIfEnabled(
  input: BuildEckeEventIngestInput,
): ReturnType<typeof buildEckeEventIngestEnvelope> | null {
  if (!isEckeEventIngestEnabled()) return null
  return buildEckeEventIngestEnvelope(input)
}

export function buildEckePlaceIngestEnvelopeIfEnabled(
  input: BuildEckePlaceIngestInput,
): ReturnType<typeof buildEckePlaceIngestEnvelope> | null {
  if (!isEckePlaceIngestEnabled()) return null
  return buildEckePlaceIngestEnvelope(input)
}

export function buildEckeVendorIngestEnvelopeIfEnabled(
  input: BuildEckeVendorIngestInput,
): ReturnType<typeof buildEckeVendorIngestEnvelope> | null {
  if (!isEckeVendorIngestEnabled()) return null
  return buildEckeVendorIngestEnvelope(input)
}

export function resolveEventIngestEntityType(c2kSourceType: string): EckePublicEntityType {
  return c2kSourceType === 'convention' ? 'convention' : 'event'
}

export function eckeEventRowToIngestPayload(
  row: EckeEventRow,
): EckeEventPayload & { c2k_source_type: EckeEventSourceType } {
  const c2kSourceType: EckeEventSourceType = row.c2k_source_type === 'convention' ? 'convention' : 'event'
  return {
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    longDescription: row.long_description || null,
    startDate: row.start_date,
    endDate: row.end_date,
    city: row.city || null,
    state: row.state || null,
    publicVenueName: row.venue ?? null,
    publicAddress: null,
    organizerDisplayName: row.organizer_name,
    publicImageUrl: row.logo || null,
    publicInfoUrl: row.website || null,
    tags: row.tags,
    accessibilityNotes: null,
    c2k_source_type: c2kSourceType,
  }
}

export function buildEckeEventIngestEnvelopeFromRow(
  row: EckeEventRow,
  canonicalKinkSocialPath: string,
): KinkSocialPublicIngestEnvelope<EckeEventPayload & { c2k_source_type: EckeEventSourceType }> {
  const c2kSourceType: EckeEventSourceType = row.c2k_source_type === 'convention' ? 'convention' : 'event'
  const sourceUpdatedAt = row.last_synced_at ?? new Date().toISOString()
  return buildEckeEventIngestEnvelope({
    sourceId: row.c2k_source_id,
    sourceUpdatedAt,
    c2kSourceType,
    preferredSlug: row.slug,
    canonicalKinkSocialPath,
    payload: eckeEventRowToIngestPayload(row),
  })
}

export function buildEckeEventUnpublishEnvelope(
  sourceId: string,
  c2kSourceType: EckeEventSourceType,
  reason?: KinkSocialUnpublishEnvelope['reason'],
): KinkSocialUnpublishEnvelope {
  const entityType = resolveEventIngestEntityType(c2kSourceType)
  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType,
    sourceId,
    action: 'unpublish',
    ...(reason ? { reason } : {}),
  }
}
