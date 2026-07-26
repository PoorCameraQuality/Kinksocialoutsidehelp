import {
  ADULT_CONTENT_PREFERENCES,
  isExplicitRating,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  type AdultContentPreference,
  type MediaContentRating,
  type MediaUploadStatus,
  type MediaVisibility,
} from '@c2k/shared'

export type MediaViewerContext = {
  authenticated: boolean
  adultContentPref: AdultContentPreference
  isStaff?: boolean
  moderatorSafeMode?: boolean
}

export type MediaDisplayFields = {
  contentRating: MediaContentRating | null
  visibility: MediaVisibility | null
  uploadStatus: MediaUploadStatus | null
  isBlurredByDefault: boolean
}

function isAdultRated(rating: MediaContentRating | null): boolean {
  if (!rating || rating === MEDIA_CONTENT_RATINGS.safePublic) return false
  return rating === MEDIA_CONTENT_RATINGS.adultNonExplicit || isExplicitRating(rating)
}

/**
 * Client-side blur rules aligned with `packages/api/src/lib/media-visibility.ts`.
 * Legacy profile photos without media metadata are never blurred.
 */
export function shouldBlurMediaForViewer(
  viewer: MediaViewerContext,
  media: MediaDisplayFields
): boolean {
  if (!media.contentRating && !media.uploadStatus && !media.isBlurredByDefault) {
    return false
  }

  if (media.uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined) return true
  if (viewer.moderatorSafeMode) return true
  if (media.uploadStatus === MEDIA_UPLOAD_STATUSES.approvedBlurred || media.isBlurredByDefault) {
    return true
  }

  const rating = media.contentRating
  if (rating === MEDIA_CONTENT_RATINGS.safePublic) return false

  if (!viewer.authenticated) {
    return isAdultRated(rating)
  }

  if (viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.hide) {
    return isAdultRated(rating)
  }

  if (viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.blur) {
    return isAdultRated(rating)
  }

  if (
    viewer.adultContentPref === ADULT_CONTENT_PREFERENCES.show &&
    viewer.authenticated &&
    rating != null &&
    (isExplicitRating(rating) || rating === MEDIA_CONTENT_RATINGS.adultNonExplicit)
  ) {
    return false
  }

  return isAdultRated(rating)
}
