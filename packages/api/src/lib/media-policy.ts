import {
  EXPLICIT_MEDIA_BLOCKED_MESSAGE,
  explicitUploadAllowedInPolicyMode,
  isExplicitMediaAllowed,
  isExplicitRating,
  isNudityMediaAllowed,
  MEDIA_CONTENT_RATINGS,
  MEDIA_POLICY_BLOCK_MESSAGES,
  MEDIA_VISIBILITIES,
  NUDITY_MEDIA_BLOCKED_MESSAGE,
  readMediaPolicyAdminSnapshot,
  resolveMediaPolicyMode,
  type MediaContentRating,
  type MediaVisibility,
} from '@c2k/shared'

export class MediaPolicyBlockedError extends Error {
  readonly code = 'media_policy_blocked' as const

  constructor(message: string = MEDIA_POLICY_BLOCK_MESSAGES.explicitAttestation) {
    super(message)
    this.name = 'MediaPolicyBlockedError'
  }
}

export function getActiveMediaPolicyMode() {
  return resolveMediaPolicyMode()
}

export function getMediaPolicyAdminSnapshot() {
  return readMediaPolicyAdminSnapshot()
}

/** Gate upload attestation by content rating + env flags (ALLOW_EXPLICIT_MEDIA / ALLOW_NUDITY). */
export function assertMediaContentRatingAllowed(contentRating: MediaContentRating): void {
  if (contentRating === MEDIA_CONTENT_RATINGS.blockedIllegal) {
    throw new MediaPolicyBlockedError('This content rating is not permitted.')
  }
  if (isExplicitRating(contentRating)) {
    if (!isExplicitMediaAllowed() || !explicitUploadAllowedInPolicyMode()) {
      throw new MediaPolicyBlockedError(EXPLICIT_MEDIA_BLOCKED_MESSAGE)
    }
    return
  }
  if (
    contentRating === MEDIA_CONTENT_RATINGS.adultNonExplicit ||
    contentRating === MEDIA_CONTENT_RATINGS.edgeReview
  ) {
    if (!isNudityMediaAllowed()) {
      throw new MediaPolicyBlockedError(NUDITY_MEDIA_BLOCKED_MESSAGE)
    }
  }
}

/** @deprecated Use assertMediaContentRatingAllowed */
export function assertExplicitUploadAllowed(contentRating: MediaContentRating): void {
  assertMediaContentRatingAllowed(contentRating)
}

/** Server-side privacy defaults for explicit media (T&S-4B EPIC 3). */
export function applyExplicitMediaPrivacyDefaults(params: {
  contentRating: MediaContentRating
  visibility: MediaVisibility
}): MediaVisibility {
  if (!isExplicitRating(params.contentRating)) return params.visibility
  if (params.visibility === MEDIA_VISIBILITIES.publicPreview) {
    return MEDIA_VISIBILITIES.loggedIn
  }
  return params.visibility
}

export function explicitMediaBlocksPublicDiscovery(contentRating: MediaContentRating | null): boolean {
  return contentRating === MEDIA_CONTENT_RATINGS.explicitAdult
}
