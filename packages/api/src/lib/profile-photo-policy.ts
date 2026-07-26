import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  PROFILE_PHOTO_BLOCKED_MESSAGE,
  isMediaPublishedStatus,
  isProfilePhotoContentRatingAllowed,
  isProfilePhotoPendingReviewStatus,
  type MediaContentRating,
  type MediaUploadStatus,
} from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  MediaAttestationValidationError,
  submitMediaAttestation,
} from './media-asset-service.js'

export const PROFILE_GALLERY_SURFACE = 'profile_gallery' as const

export function isProfileGallerySurface(sourceSurface: string | null | undefined): boolean {
  return sourceSurface === PROFILE_GALLERY_SURFACE
}

export function assertProfilePhotoContentRatingAllowed(contentRating: MediaContentRating): void {
  if (!isProfilePhotoContentRatingAllowed(contentRating)) {
    throw new MediaAttestationValidationError(PROFILE_PHOTO_BLOCKED_MESSAGE)
  }
}

export type AutoPublishProfilePhotoResult =
  | { outcome: 'published'; uploadStatus: MediaUploadStatus }
  | { outcome: 'pending_review'; uploadStatus: MediaUploadStatus }
  | { outcome: 'rejected'; uploadStatus: MediaUploadStatus; error: string }

/** Auto-attest portrait policy and publish profile gallery uploads when scan passes. */
export async function autoPublishProfileGalleryPhoto(params: {
  mediaAssetId: string
  userId: string
}): Promise<AutoPublishProfilePhotoResult> {
  const result = await submitMediaAttestation({
    mediaAssetId: params.mediaAssetId,
    userId: params.userId,
    contentRating: MEDIA_CONTENT_RATINGS.safePublic,
    depictedPeople: DEPICTED_PEOPLE.onlyMe,
    visibility: MEDIA_VISIBILITIES.loggedIn,
    uploaderConfirmed18: true,
    uploaderConfirmedDepictedAdults18: true,
    uploaderConfirmedConsent: true,
    uploaderConfirmedRightToUpload: true,
    uploaderConfirmedNoNcii: true,
    uploaderConfirmedNoMinors: true,
    uploaderConfirmedNoHiddenCamera: true,
    uploaderConfirmedNoAiDeepfakeWithoutConsent: true,
  })

  if (isMediaPublishedStatus(result.uploadStatus)) {
    return { outcome: 'published', uploadStatus: result.uploadStatus }
  }

  if (result.uploadStatus === MEDIA_UPLOAD_STATUSES.rejected) {
    return {
      outcome: 'rejected',
      uploadStatus: result.uploadStatus,
      error: PROFILE_PHOTO_BLOCKED_MESSAGE,
    }
  }

  if (isProfilePhotoPendingReviewStatus(result.uploadStatus)) {
    return { outcome: 'pending_review', uploadStatus: result.uploadStatus }
  }

  return { outcome: 'pending_review', uploadStatus: result.uploadStatus }
}

export async function rejectProfileGalleryMediaAsset(mediaAssetId: string): Promise<void> {
  await db
    .update(schema.mediaAssets)
    .set({
      uploadStatus: MEDIA_UPLOAD_STATUSES.rejected,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, mediaAssetId))
}
