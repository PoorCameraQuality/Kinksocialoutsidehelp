/**
 * Outbound ECKE publish safety helpers.
 *
 * Data flows kink.social to ECKE only. Keep member-only URLs and private fields
 * off the public SEO pages. Robots and sitemap rules live in seo-policy.ts.
 *
 * @see docs/ECKE_PUBLIC_PUBLISHING_CONTRACT.md
 * @see docs/DOMAIN_GLOSSARY.md
 */

/** eastcoastkinkevents.com public SEO directory. Not the member app. */
export const ECKE_DOMAIN = 'eastcoastkinkevents.com'

export const ECKE_URL = 'https://www.eastcoastkinkevents.com'

/** ECKE page that explains how kink.social relates to the directory. */
export const ECKE_KINK_SOCIAL_EXPLAINER_PATH = '/kink-social'

export type EckePublishEligibilityInput = {
  /** Matches eckePublish / publishToEcke toggles on source rows. */
  publishToEcke?: boolean | null
  visibility?: string | null
  moderationStatus?: string | null
  directoryVisibility?: 'PUBLIC' | 'UNLISTED' | string | null
  publicationStatus?: string | null
}

function isPublicVisibility(visibility: string | null | undefined): boolean {
  if (!visibility) return false
  const normalized = visibility.trim().toUpperCase()
  return normalized === 'PUBLIC'
}

/**
 * Returns true only when a record is safe to publish to ECKE.
 * Needs publishToEcke, public visibility, and not UNLISTED.
 * If moderation or publication status is set, they must be approved / PUBLISHED.
 * Fail closed otherwise. Call this before enqueue or send.
 */
export function isEckePublishEligible(input: EckePublishEligibilityInput): boolean {
  if (input.publishToEcke !== true) return false
  if (!isPublicVisibility(input.visibility ?? null)) return false
  if (input.directoryVisibility === 'UNLISTED') return false
  if (input.moderationStatus && input.moderationStatus !== 'approved') return false
  if (input.publicationStatus && input.publicationStatus !== 'PUBLISHED') return false
  return true
}

const KINK_SOCIAL_URL_RE = /https?:\/\/(?:www\.)?kink\.social[^\s"'<>]*/gi

const KINK_SOCIAL_HOST_RE = /\bkink\.social\b/i

/**
 * Member-only kink.social paths that must not appear on ECKE.
 * Detect with a non-global regex. A /g RegExp leaves lastIndex set after .test(),
 * so the next leak check can miss a match.
 */
const KINK_SOCIAL_PRIVATE_URL_SOURCE =
  String.raw`https?:\/\/(?:www\.)?kink\.social(?:\/api\b|\/messages\b|\/dm\b|\/inbox\b|\/settings\b|\/profile\/edit\b|\/education\/write\b|\/organizer\b)[^\s"'<>]*`
const KINK_SOCIAL_PRIVATE_URL_RE = new RegExp(KINK_SOCIAL_PRIVATE_URL_SOURCE, 'gi')
const KINK_SOCIAL_PRIVATE_URL_DETECT_RE = new RegExp(KINK_SOCIAL_PRIVATE_URL_SOURCE, 'i')

/** Remove private-app URLs from text going to ECKE. */
export function sanitizeEckePublicText(text: string | null | undefined): string | null {
  if (text == null) return null
  const cleaned = text.replace(KINK_SOCIAL_URL_RE, '').replace(KINK_SOCIAL_HOST_RE, '').trim()
  return cleaned || null
}

/**
 * Private or proxy kink.social img tags. Public CDN paths under /c2k-uploads/ stay.
 */
const KINK_SOCIAL_PRIVATE_IMG_TAG_RE =
  /<img\b[^>]*\ssrc\s*=\s*["']https?:\/\/(?:www\.)?kink\.social\/(?!c2k-uploads\/)[^"']*["'][^>]*\/?>/gi

/**
 * Clean education HTML for ECKE.
 * Keep TipTap markup and public CDN images. Strip private app URLs and proxy media.
 * Brand name mentions stay.
 */
export function sanitizeEckeEducationBodyHtml(html: string | null | undefined): string | null {
  if (html == null) return null
  const cleaned = html
    .replace(KINK_SOCIAL_PRIVATE_IMG_TAG_RE, '')
    .replace(KINK_SOCIAL_PRIVATE_URL_RE, '')
    .trim()
  return cleaned || null
}

/**
 * Education copy may name kink.social and link to public profiles.
 * Only strip member-only app URLs.
 */
export function sanitizeEckeEducationPublicText(text: string | null | undefined): string | null {
  if (text == null) return null
  const cleaned = text.replace(KINK_SOCIAL_PRIVATE_URL_RE, '').trim()
  return cleaned || null
}

/**
 * Anonymous CDN object URLs under kink.social/c2k-uploads.
 * Safe to hotlink on ECKE as hero or logo images.
 */
const KINK_SOCIAL_PUBLIC_CDN_URL_RE =
  /https?:\/\/(?:www\.)?kink\.social\/c2k-uploads\/[^\s"'<>\\]*/gi

/** True if the ECKE payload still has private kink.social app URLs after CDN URLs are ignored. */
export function eckePayloadContainsPrivateAppUrls(payload: unknown): boolean {
  const withoutPublicCdn = JSON.stringify(payload).replace(KINK_SOCIAL_PUBLIC_CDN_URL_RE, '')
  return KINK_SOCIAL_HOST_RE.test(withoutPublicCdn)
}

/** Education ingest fields that may hold public profile URLs. */
export const ECKE_EDUCATION_ATTRIBUTION_URL_KEYS = ['authorProfileUrl', 'presenterProfileUrl'] as const

/**
 * True if an education payload still has member-only kink.social URLs.
 * Brand mentions and public profile links are fine.
 */
export function educationEckePayloadContainsLeakedPrivateUrls(
  payload: Record<string, unknown>,
): boolean {
  return KINK_SOCIAL_PRIVATE_URL_DETECT_RE.test(JSON.stringify(payload))
}

/** Build a URL-safe slug. Do not strip the kink.social brand name from the text. */
export function sanitizeEckeArticleSlug(slug: string): string {
  const lowered = slug.toLowerCase().trim()
  const withoutUrls = lowered.replace(KINK_SOCIAL_URL_RE, '')
  const normalized = withoutUrls
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return normalized || 'article'
}

/** Keep public CDN hero URLs. Drop private kink.social app or proxy links. */
export function sanitizeEckeHeroImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  // Prod CDN is anonymous GET at https://kink.social/c2k-uploads/...
  if (/^https?:\/\/(?:www\.)?kink\.social\/c2k-uploads\//i.test(trimmed)) return trimmed
  if (KINK_SOCIAL_HOST_RE.test(trimmed)) return null
  return trimmed
}

/**
 * Organizer external site link for ECKE.
 * Must be absolute http(s) and must not point at kink.social.
 */
export function sanitizeEckeExternalUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  if (KINK_SOCIAL_HOST_RE.test(trimmed)) return null
  return trimmed
}
