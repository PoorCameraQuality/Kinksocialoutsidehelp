import {
  ADULT_CONTENT_PREFERENCES,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  explicitCannotBePublicPreview,
  isExplicitRating,
  isMediaPublishedStatus,
  isPublishBlocked,
  type AdultContentPreference,
  type MediaContentRating,
  type MediaUploadStatus,
  type MediaVisibility,
} from '@c2k/shared'

const EXPLICIT_MEMBER_ONLY_VISIBILITIES = new Set<MediaVisibility>([
  MEDIA_VISIBILITIES.loggedIn,
  MEDIA_VISIBILITIES.followers,
  MEDIA_VISIBILITIES.privateProfile,
  MEDIA_VISIBILITIES.groupOnly,
  MEDIA_VISIBILITIES.orgOnly,
  MEDIA_VISIBILITIES.eventAttendees,
  MEDIA_VISIBILITIES.conventionAttendees,
  MEDIA_VISIBILITIES.staffOnly,
])

export type MediaVisibilityViewer = {
  authenticated: boolean
  adultContentPref: AdultContentPreference
  isStaff?: boolean
  /** When true (moderator UI safe mode), adult-rated media is always blurred. */
  moderatorSafeMode?: boolean
}

export type MediaVisibilityMedia = {
  contentRating: MediaContentRating
  visibility: MediaVisibility
  uploadStatus: MediaUploadStatus
  isBlurredByDefault: boolean
}

export type VisibilityRatingValidationResult =
  | { ok: true }
  | {
      ok: false
      reason: 'explicit_public_preview' | 'blocked_illegal' | 'edge_review_no_auto_publish'
    }

function isAdultRated(rating: MediaContentRating): boolean {
  return rating === MEDIA_CONTENT_RATINGS.adultNonExplicit || isExplicitRating(rating)
}

function isPendingMediaStatus(status: MediaUploadStatus): boolean {
  return (
    status === MEDIA_UPLOAD_STATUSES.pendingUpload ||
    status === MEDIA_UPLOAD_STATUSES.pendingAttestation ||
    status === MEDIA_UPLOAD_STATUSES.pendingScan
  )
}

/**
 * Coarse visibility band only: public preview, staff-only, or “any authenticated member”.
 * Owner/follower/group/org/event scope must be enforced by a separate scope gate
 * (`viewerPassesAssetScopeGate` / `canViewerSeeMediaItem`).
 */
function viewerPassesCoarseVisibilityBand(
  viewer: MediaVisibilityViewer,
  visibility: MediaVisibility,
): boolean {
  if (visibility === MEDIA_VISIBILITIES.publicPreview) return true
  if (visibility === MEDIA_VISIBILITIES.staffOnly) return viewer.isStaff === true
  return viewer.authenticated
}

/**
 * Rating, upload-status, adult-pref, and coarse visibility-band gate.
 *
 * This is **not** a full media ACL. After this returns true, callers that serve
 * bytes or item previews must still apply owner/relationship/community scope
 * (`canViewerSeeMediaItem` or `viewerPassesAssetScopeGate`).
 *
 * Quarantined / rejected / pending / publish-blocked content stays staff-only
 * (or hidden) so untrusted bytes never appear on member surfaces.
 */
export function passesMediaRatingAndStatusGate(
  viewer: MediaVisibilityViewer,
  media: MediaVisibilityMedia,
): boolean {
  const { contentRating, visibility, uploadStatus } = media

  if (isPublishBlocked(contentRating)) {
    return viewer.isStaff === true
  }

  if (contentRating === MEDIA_CONTENT_RATINGS.edgeReview && viewer.isStaff !== true) {
    return false
  }

  if (uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined) {
    return viewer.isStaff === true
  }

  if (
    uploadStatus === MEDIA_UPLOAD_STATUSES.rejected ||
    uploadStatus === MEDIA_UPLOAD_STATUSES.removed
  ) {
    return false
  }

  if (isPendingMediaStatus(uploadStatus) || !isMediaPublished(uploadStatus)) {
    return viewer.isStaff === true
  }

  if (
    viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.hide &&
    isExplicitRating(contentRating)
  ) {
    return false
  }

  return viewerPassesCoarseVisibilityBand(viewer, visibility)
}

/**
 * @deprecated Prefer `passesMediaRatingAndStatusGate` — the old name implied a full ACL.
 */
export const canViewerSeeMedia = passesMediaRatingAndStatusGate

/**
 * Whether the client should render a blur overlay for this viewer.
 * Explicit media with SHOW preference is shown unblurred to signed-in adults.
 */
export function shouldBlurMediaForViewer(
  viewer: MediaVisibilityViewer,
  media: MediaVisibilityMedia,
): boolean {
  if (!passesMediaRatingAndStatusGate(viewer, media)) {
    return false
  }

  const { contentRating, uploadStatus, isBlurredByDefault } = media

  if (uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined) {
    return true
  }

  if (viewer.moderatorSafeMode === true) {
    return true
  }

  if (
    uploadStatus === MEDIA_UPLOAD_STATUSES.approvedBlurred ||
    isBlurredByDefault
  ) {
    return true
  }

  if (contentRating === MEDIA_CONTENT_RATINGS.safePublic) {
    return false
  }

  if (!viewer.authenticated) {
    return isAdultRated(contentRating)
  }

  if (viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.hide) {
    return isAdultRated(contentRating)
  }

  if (viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.blur) {
    return isAdultRated(contentRating)
  }

  if (
    viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.show &&
    viewer.authenticated &&
    isExplicitRating(contentRating)
  ) {
    return false
  }

  if (
    viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.show &&
    viewer.authenticated &&
    contentRating === MEDIA_CONTENT_RATINGS.adultNonExplicit
  ) {
    return false
  }

  return isAdultRated(contentRating)
}

/** AUTO_APPROVED and APPROVED_BLURRED count as published; pending/quarantined/rejected do not. */
export function isMediaPublished(status: MediaUploadStatus): boolean {
  return isMediaPublishedStatus(status)
}

/**
 * Explicit media must not appear in public discovery, sitemap, or OG surfaces.
 * `visibility` is accepted for call-site symmetry with `explicitMediaAllowsPublicUrl`
 * but is intentionally unused — discovery eligibility is rating-only.
 */
export function explicitMediaEligibleForPublicDiscovery(
  contentRating: MediaContentRating,
  visibility: MediaVisibility,
): boolean {
  void visibility
  if (!isExplicitRating(contentRating)) return true
  return false
}

/** Whether a published explicit asset may receive a direct public URL / OG tag. */
export function explicitMediaAllowsPublicUrl(
  contentRating: MediaContentRating,
  visibility: MediaVisibility,
): boolean {
  if (!isExplicitRating(contentRating)) return true
  return EXPLICIT_MEMBER_ONLY_VISIBILITIES.has(visibility)
}

/** Validates visibility + rating combos before auto-publish. */
export function validateVisibilityRatingCombo(
  visibility: MediaVisibility,
  rating: MediaContentRating,
): VisibilityRatingValidationResult {
  if (isPublishBlocked(rating)) {
    return { ok: false, reason: 'blocked_illegal' }
  }

  if (explicitCannotBePublicPreview(visibility, rating)) {
    return { ok: false, reason: 'explicit_public_preview' }
  }

  if (rating === MEDIA_CONTENT_RATINGS.edgeReview) {
    return { ok: false, reason: 'edge_review_no_auto_publish' }
  }

  return { ok: true }
}
