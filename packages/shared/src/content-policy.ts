import { MEDIA_CONTENT_RATINGS, type MediaContentRating } from './media-types.js'

/** v1 launch default: explicit sexual media uploads disabled until legal review. */
export const EXPLICIT_MEDIA_BLOCKED_MESSAGE =
  'Explicit sexual media uploads are not supported on this platform at this time.'

export const NUDITY_MEDIA_BLOCKED_MESSAGE =
  'Adult or suggestive media uploads are not supported on this platform at this time.'

export function parseEnvFlag(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === '') return defaultValue
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

/** Read from C2K_ALLOW_EXPLICIT_MEDIA or ALLOW_EXPLICIT_MEDIA. Default false. */
export function isExplicitMediaAllowed(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {}
): boolean {
  return parseEnvFlag(env.C2K_ALLOW_EXPLICIT_MEDIA ?? env.ALLOW_EXPLICIT_MEDIA, false)
}

/**
 * Env gate for adultNonExplicit and edgeReview ratings.
 * Name says nudity but it is not limited to that. Reads C2K_ALLOW_NUDITY / ALLOW_NUDITY.
 * Default false. Prefer isAdultSuggestiveMediaAllowed in new code.
 */
export function isNudityMediaAllowed(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {}
): boolean {
  return parseEnvFlag(env.C2K_ALLOW_NUDITY ?? env.ALLOW_NUDITY, false)
}

/** Same env flags as isNudityMediaAllowed. Clearer name for rating gates. */
export const isAdultSuggestiveMediaAllowed = isNudityMediaAllowed

export function isMediaContentRatingAllowed(
  contentRating: MediaContentRating,
  env?: Record<string, string | undefined>
): boolean {
  if (contentRating === MEDIA_CONTENT_RATINGS.blockedIllegal) return false
  if (contentRating === MEDIA_CONTENT_RATINGS.explicitAdult) {
    return isExplicitMediaAllowed(env)
  }
  if (
    contentRating === MEDIA_CONTENT_RATINGS.adultNonExplicit ||
    contentRating === MEDIA_CONTENT_RATINGS.edgeReview
  ) {
    return isNudityMediaAllowed(env)
  }
  return true
}

export function mediaContentRatingBlockReason(
  contentRating: MediaContentRating,
  env?: Record<string, string | undefined>
): string | null {
  if (isMediaContentRatingAllowed(contentRating, env)) return null
  if (contentRating === MEDIA_CONTENT_RATINGS.explicitAdult) {
    return EXPLICIT_MEDIA_BLOCKED_MESSAGE
  }
  if (
    contentRating === MEDIA_CONTENT_RATINGS.adultNonExplicit ||
    contentRating === MEDIA_CONTENT_RATINGS.edgeReview
  ) {
    return NUDITY_MEDIA_BLOCKED_MESSAGE
  }
  if (contentRating === MEDIA_CONTENT_RATINGS.blockedIllegal) {
    return 'This content rating is not permitted.'
  }
  return EXPLICIT_MEDIA_BLOCKED_MESSAGE
}
