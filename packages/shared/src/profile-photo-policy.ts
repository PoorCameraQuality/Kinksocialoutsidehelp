import {
  MEDIA_UPLOAD_STATUSES,
  isMediaPublishedStatus,
  MEDIA_CONTENT_RATINGS,
  type MediaContentRating,
  type MediaUploadStatus,
} from './media-types.js'

/** Profile header photos. Portrait-style only. Explicit media belongs in private albums. */
export const PROFILE_PHOTO_ALLOWED_CONTENT_RATINGS: readonly MediaContentRating[] = [
  MEDIA_CONTENT_RATINGS.safePublic,
  MEDIA_CONTENT_RATINGS.adultNonExplicit,
]

export const PROFILE_PHOTO_BLOCKED_MESSAGE =
  'Profile photos must be portrait-style pictures of you. Genitals and graphic sex are not allowed — use private albums for explicit media.'

export const PROFILE_PHOTO_PENDING_REVIEW_MESSAGE =
  'Your photo was saved but needs a quick review before it appears on your public profile. If our scanner flagged it by mistake, a moderator will usually approve it shortly — you do not need to upload again.'

export const PROFILE_PHOTO_PENDING_REVIEW_SHORT = 'Pending review'

export const PROFILE_PHOTO_PENDING_REVIEW_DETAIL =
  'Not shown on your public profile until approved.'

export type ProfilePhotoUploadFeedbackTone = 'success' | 'info' | 'error'

/** Upload statuses that mean the photo is saved but not yet public (scanner / moderation queue). */
export function isProfilePhotoPendingReviewStatus(
  uploadStatus: MediaUploadStatus | string | null | undefined,
): boolean {
  if (!uploadStatus) return false
  if (isMediaPublishedStatus(uploadStatus as MediaUploadStatus)) return false
  if (uploadStatus === MEDIA_UPLOAD_STATUSES.rejected) return false
  if (uploadStatus === MEDIA_UPLOAD_STATUSES.removed) return false
  if (uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation) return false
  return (
    uploadStatus === MEDIA_UPLOAD_STATUSES.pendingScan ||
    uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined ||
    uploadStatus === MEDIA_UPLOAD_STATUSES.escalated ||
    uploadStatus === MEDIA_UPLOAD_STATUSES.pendingUpload ||
    uploadStatus === MEDIA_UPLOAD_STATUSES.preserved
  )
}

export function getProfilePhotoUploadFeedback(params: {
  uploadStatus?: MediaUploadStatus | string | null
  pendingReview?: boolean
}): { tone: ProfilePhotoUploadFeedbackTone; message: string } | null {
  if (params.pendingReview || isProfilePhotoPendingReviewStatus(params.uploadStatus)) {
    return { tone: 'info', message: PROFILE_PHOTO_PENDING_REVIEW_MESSAGE }
  }
  if (
    params.uploadStatus === MEDIA_UPLOAD_STATUSES.autoApproved ||
    params.uploadStatus === MEDIA_UPLOAD_STATUSES.approvedBlurred
  ) {
    return { tone: 'success', message: 'Profile photo saved.' }
  }
  return null
}

export const PROFILE_PHOTO_GUIDELINES: readonly { text: string; bold?: string }[] = [
  { text: 'Must be of you. Faces may be blurred or cropped if you like.' },
  {
    bold: 'Portrait-style only.',
    text: 'Scenery, cartoons, art, and animals are all fine on the site — just save those for your albums, not your profile photo.',
  },
  { text: "Keep profile photos classy.", bold: 'No genitals or graphic sex.' },
  { text: 'Not even in the background.', bold: 'No children — ever.' },
]

export function isProfilePhotoContentRatingAllowed(rating: MediaContentRating): boolean {
  return (PROFILE_PHOTO_ALLOWED_CONTENT_RATINGS as readonly string[]).includes(rating)
}

/** Primary slot uses sortOrder 0. If duplicates exist, prefer the newest. API sorts createdAt asc. */
export function pickPrimaryProfilePhoto<T extends { order: number }>(
  photos: readonly T[],
): T | undefined {
  if (photos.length === 0) return undefined
  const primaries = photos.filter((p) => p.order === 0)
  if (primaries.length > 0) return primaries[primaries.length - 1]
  return photos[0]
}
