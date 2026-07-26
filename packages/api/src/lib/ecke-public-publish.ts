import {
  APP_NAME,
  buildCanonicalUrl,
  buildKinkSocialIdempotencyKey,
  educationEckePayloadContainsLeakedPrivateUrls,
  isEckePublishEligible,
  KINK_SOCIAL_SOURCE_SYSTEM,
  sanitizeEckeArticleSlug,
  sanitizeEckeEducationPublicText,
  sanitizeEckeEducationBodyHtml,
  sanitizeEckeHeroImageUrl,
  type EckeEducationArticlePayload,
  type KinkSocialPublicIngestEnvelope,
  type KinkSocialUnpublishEnvelope,
  resolveEckePayloadHeroUrl,
} from '@c2k/shared'
import { resolveEckeEducationHeroImageUrl } from './ecke-education-hero.js'
import { buildEducationArticlePhotosManifest } from './ecke-photo-manifest.js'
import { isEckePhotosPublishEnabled } from './ecke-publish-config.js'

/** Fields loaded from education_articles for ECKE publish eligibility and redaction. */
export type EducationArticlePublishRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  bodyHtml: string
  categories: string[]
  contentWarnings: string[]
  difficulty: string | null
  heroImageUrl: string | null
  readingMinutes: number | null
  publishedAt: Date | null
  updatedAt: Date
  visibility: 'PUBLIC' | 'MEMBERS' | 'CONNECTIONS'
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  eckePublish: boolean
  authorUserId: string
  organizationId: string | null
  presenterProfileUserId: string | null
}

export type EducationArticleAuthorContext = {
  displayName: string | null
  username: string | null
  presenterUsername: string | null
  presenterDirectoryVisibility: string | null
}

const SUPPORTED_RUNTIME_ENTITY = 'education_article' as const
export type EckePublicPublishEntityType = typeof SUPPORTED_RUNTIME_ENTITY

export function kinkSocialPublicWebBase(): string {
  return (
    process.env.C2K_PUBLIC_WEB_URL ??
    process.env.C2K_WEB_PUBLIC_URL ??
    process.env.VITE_SITE_URL ??
    'http://127.0.0.1:5173'
  ).replace(/\/$/, '')
}

export function buildEducationArticleCanonicalUrl(slug: string): string {
  return buildCanonicalUrl(`/education/${encodeURIComponent(slug)}`, kinkSocialPublicWebBase())
}

function buildAuthorProfileUrl(username: string | null | undefined): string | null {
  const trimmed = username?.trim()
  if (!trimmed) return null
  return buildCanonicalUrl(`/profile/${encodeURIComponent(trimmed)}`, kinkSocialPublicWebBase())
}

function buildPresenterProfileUrl(
  username: string | null | undefined,
  directoryVisibility: string | null | undefined,
): string | null {
  if (directoryVisibility !== 'PUBLIC') return null
  const trimmed = username?.trim()
  if (!trimmed) return null
  return buildCanonicalUrl(`/presenters/${encodeURIComponent(trimmed)}`, kinkSocialPublicWebBase())
}

/** Human-readable ineligibility reason, or null when publish may proceed. */
export function getEducationArticleIneligibilityReason(article: EducationArticlePublishRow): string | null {
  if (!article.eckePublish) return 'Article is not opted in for ECKE publish'
  if (article.publicationStatus === 'ARCHIVED') return 'Archived articles cannot be published to ECKE'
  if (article.publicationStatus !== 'PUBLISHED') return 'Only published articles can sync to ECKE'
  if (article.visibility === 'MEMBERS') return 'Member-only articles cannot be published to ECKE'
  if (article.visibility === 'CONNECTIONS') return 'Connection-only articles cannot be published to ECKE'
  if (article.visibility !== 'PUBLIC') return 'Article visibility must be PUBLIC'

  if (
    !isEckePublishEligible({
      publishToEcke: article.eckePublish,
      visibility: article.visibility,
      publicationStatus: article.publicationStatus,
    })
  ) {
    return 'Article not eligible for ECKE publish'
  }

  return null
}

export function isEntityEckePublishEligible(
  entityType: EckePublicPublishEntityType,
  article: EducationArticlePublishRow,
): boolean {
  if (entityType !== 'education_article') return false
  return getEducationArticleIneligibilityReason(article) === null
}

export function redactEducationArticleForEcke(
  article: EducationArticlePublishRow,
  author: EducationArticleAuthorContext,
  opts?: { resolvedHeroImageUrl?: string | null },
): EckeEducationArticlePayload {
  const rawTitle = article.title.trim()
  const rawExcerpt = (article.excerpt ?? article.title).trim()
  const rawBody = article.bodyHtml

  const title = sanitizeEckeEducationPublicText(rawTitle) ?? rawTitle
  const excerpt = (sanitizeEckeEducationPublicText(rawExcerpt) ?? rawExcerpt).slice(0, 2000)
  const bodyHtml = sanitizeEckeEducationBodyHtml(rawBody) ?? rawBody

  const authorDisplayName =
    author.displayName?.trim() || author.username?.trim() || `${APP_NAME} Educator`

  const payload: EckeEducationArticlePayload = {
    title,
    slug: sanitizeEckeArticleSlug(article.slug),
    excerpt: excerpt || title.slice(0, 500),
    bodyHtml,
    authorDisplayName,
    authorUsername: author.username?.trim() || null,
    authorProfileUrl: buildAuthorProfileUrl(author.username),
    presenterProfileUrl: buildPresenterProfileUrl(
      author.presenterUsername,
      author.presenterDirectoryVisibility,
    ),
    contentWarnings: [...(article.contentWarnings ?? [])],
    categories: article.categories?.length ? article.categories : ['Education'],
    difficulty: article.difficulty,
    readingMinutes: article.readingMinutes,
    publishedAt: (article.publishedAt ?? article.updatedAt).toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    heroImageUrl:
      opts?.resolvedHeroImageUrl !== undefined ?
        opts.resolvedHeroImageUrl
      : sanitizeEckeHeroImageUrl(article.heroImageUrl),
    seoTitle: title,
    metaDescription: excerpt.slice(0, 500) || null,
  }

  if (educationEckePayloadContainsLeakedPrivateUrls(payload as Record<string, unknown>)) {
    throw new Error('Article contains private kink.social URLs (messages, settings, API, etc.)')
  }

  return payload
}

export function redactForEcke(
  entityType: EckePublicPublishEntityType,
  article: EducationArticlePublishRow,
  author: EducationArticleAuthorContext,
): EckeEducationArticlePayload {
  if (entityType !== 'education_article') {
    throw new Error(`Unsupported entity type for redaction: ${entityType}`)
  }
  return redactEducationArticleForEcke(article, author)
}

export function buildEckePublicEnvelope(
  entityType: EckePublicPublishEntityType,
  article: EducationArticlePublishRow,
  author: EducationArticleAuthorContext,
): KinkSocialPublicIngestEnvelope<EckeEducationArticlePayload> {
  if (entityType !== 'education_article') {
    throw new Error(`Unsupported entity type for envelope: ${entityType}`)
  }

  const payload = redactEducationArticleForEcke(article, author)
  return finalizeEckePublicEnvelope(article, payload)
}

export async function buildEckePublicEnvelopeAsync(
  entityType: EckePublicPublishEntityType,
  article: EducationArticlePublishRow,
  author: EducationArticleAuthorContext,
): Promise<KinkSocialPublicIngestEnvelope<EckeEducationArticlePayload>> {
  if (entityType !== 'education_article') {
    throw new Error(`Unsupported entity type for envelope: ${entityType}`)
  }

  const resolvedHero = await resolveEckeEducationHeroImageUrl(article.heroImageUrl)
  const photos = await buildEducationArticlePhotosManifest({ heroImageUrl: article.heroImageUrl })
  const payload = redactEducationArticleForEcke(article, author, { resolvedHeroImageUrl: resolvedHero })
  if (isEckePhotosPublishEnabled() && (photos.hero || photos.gallery.length > 0)) {
    payload.photos = photos
    payload.heroImageUrl = resolveEckePayloadHeroUrl({
      photos,
      legacyHeroUrl: payload.heroImageUrl,
    })
  }
  return finalizeEckePublicEnvelope(article, payload)
}

function finalizeEckePublicEnvelope(
  article: EducationArticlePublishRow,
  payload: EckeEducationArticlePayload,
): KinkSocialPublicIngestEnvelope<EckeEducationArticlePayload> {
  const sourceUpdatedAt = article.updatedAt.toISOString()

  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType: 'education_article',
    sourceId: article.id,
    sourceUpdatedAt,
    action: 'upsert',
    visibility: 'PUBLIC',
    publishToEcke: true,
    publicSafe: true,
    idempotencyKey: buildKinkSocialIdempotencyKey('education_article', article.id),
    canonicalKinkSocialUrl: buildEducationArticleCanonicalUrl(article.slug),
    preferredSlug: sanitizeEckeArticleSlug(article.slug),
    allowSlugSuffix: false,
    payload,
  }
}

export function buildEducationArticleUnpublishEnvelope(
  articleId: string,
  reason?: KinkSocialUnpublishEnvelope['reason'],
): KinkSocialUnpublishEnvelope {
  return {
    sourceSystem: KINK_SOCIAL_SOURCE_SYSTEM,
    entityType: 'education_article',
    sourceId: articleId,
    action: 'unpublish',
    ...(reason ? { reason } : {}),
  }
}

/** Keys that must never appear in a redacted education payload object. */
export const FORBIDDEN_EDUCATION_REDACTION_KEYS = [
  'privateNotes',
  'internalNotes',
  'memberOnlyBody',
  'connectionOnlyBody',
  'draftBody',
  'hiddenAuthorData',
  'moderationNotes',
  'email',
  'phone',
  'bodyJson',
  'authorUserId',
  'raw',
] as const

export function redactedPayloadExcludesForbiddenKeys(payload: EckeEducationArticlePayload): boolean {
  const serialized = JSON.stringify(payload)
  return !FORBIDDEN_EDUCATION_REDACTION_KEYS.some((key) => serialized.includes(`"${key}"`))
}
