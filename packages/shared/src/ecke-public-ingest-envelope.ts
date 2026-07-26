/**
 * kink.social to ECKE public SEO ingest envelope types.
 * Outbound only. C2K owns the data. ECKE never authenticates members.
 * @see docs/ECKE_PUBLIC_PUBLISHING_CONTRACT.md
 * @see docs/DOMAIN_GLOSSARY.md
 */

import type { EckePhotosManifest } from './ecke-photos-manifest.js'

export const KINK_SOCIAL_SOURCE_SYSTEM = 'kink.social' as const

/** Entity types eligible for public SEO ingest. `group` deferred pending privacy ADR. */
export type EckePublicEntityType =
  | 'education_article'
  | 'education_path'
  | 'event'
  | 'convention'
  | 'place'
  | 'organization'
  | 'presenter'
  | 'vendor'
  | 'class_sample'
  | 'media_reference'

export type KinkSocialIngestAction = 'upsert' | 'unpublish'

/** Maps envelope entityType to ECKE c2k_source_type column value. */
export const ECKE_SOURCE_TYPE_BY_ENTITY: Record<EckePublicEntityType, string> = {
  education_article: 'education_article',
  education_path: 'education_path',
  event: 'event',
  convention: 'convention',
  place: 'place',
  organization: 'organization',
  presenter: 'presenter_profile',
  vendor: 'vendor_profile',
  class_sample: 'class_sample',
  media_reference: 'media_reference',
}

export type KinkSocialPublicIngestEnvelope<TPayload = unknown> = {
  sourceSystem: typeof KINK_SOCIAL_SOURCE_SYSTEM
  entityType: EckePublicEntityType
  sourceId: string
  sourceUpdatedAt: string
  action: KinkSocialIngestAction
  /** Must be true for upsert. ECKE ingest API validates this. */
  visibility: 'PUBLIC'
  /** Required true for upsert. */
  publishToEcke: true
  /** Sender asserts redaction is done. ECKE checks again. */
  publicSafe: true
  idempotencyKey: string
  canonicalKinkSocialUrl?: string
  preferredSlug?: string
  allowSlugSuffix?: boolean
  payload: TPayload
}

export type KinkSocialUnpublishEnvelope = {
  sourceSystem: typeof KINK_SOCIAL_SOURCE_SYSTEM
  entityType: EckePublicEntityType
  sourceId: string
  action: 'unpublish'
  reason?: 'archived' | 'deleted' | 'opt_out' | 'ineligible' | 'visibility_change'
}

export type KinkSocialIngestResponse = {
  status: 'published' | 'unpublished' | 'rejected'
  eckeRecordId?: string
  eckeSlug?: string
  eckePublicUrl?: string
  errorCode?: string
  errorMessage?: string
}

/** education_article payload. See contract section 4.2. */
export type EckeEducationArticlePayload = {
  title: string
  slug: string
  excerpt: string
  bodyHtml: string
  authorDisplayName: string
  authorUsername?: string | null
  authorProfileUrl?: string | null
  presenterProfileUrl?: string | null
  contentWarnings: string[]
  categories: string[]
  difficulty?: string | null
  readingMinutes?: number | null
  publishedAt: string
  updatedAt: string
  heroImageUrl?: string | null
  seoTitle?: string | null
  metaDescription?: string | null
  photos?: EckePhotosManifest
}

/** event payload. See contract section 4.4. */
export type EckeEventPayload = {
  title: string
  slug: string
  shortDescription: string
  longDescription?: string | null
  startDate: string
  endDate: string
  city?: string | null
  state?: string | null
  publicVenueName?: string | null
  publicAddress?: string | null
  organizerDisplayName?: string | null
  publicImageUrl?: string | null
  publicInfoUrl?: string | null
  tags?: string[]
  accessibilityNotes?: string | null
}

export function buildKinkSocialIdempotencyKey(entityType: EckePublicEntityType, sourceId: string): string {
  return `${KINK_SOCIAL_SOURCE_SYSTEM}:${entityType}:${sourceId}`
}
