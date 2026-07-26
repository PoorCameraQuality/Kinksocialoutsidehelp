import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  PROFILE_PHOTO_BLOCKED_MESSAGE,
  isProfilePhotoContentRatingAllowed,
  isProfilePhotoPendingReviewStatus,
} from '@c2k/shared'
import { assertProfilePhotoContentRatingAllowed } from './profile-photo-policy.js'
import { MediaAttestationValidationError } from './media-asset-service.js'

test('profile photo allows safe and adult non-explicit ratings', () => {
  assert.equal(isProfilePhotoContentRatingAllowed(MEDIA_CONTENT_RATINGS.safePublic), true)
  assert.equal(isProfilePhotoContentRatingAllowed(MEDIA_CONTENT_RATINGS.adultNonExplicit), true)
  assert.equal(isProfilePhotoContentRatingAllowed(MEDIA_CONTENT_RATINGS.explicitAdult), false)
})

test('assertProfilePhotoContentRatingAllowed rejects explicit', () => {
  assert.throws(
    () => assertProfilePhotoContentRatingAllowed(MEDIA_CONTENT_RATINGS.explicitAdult),
    (err: unknown) => {
      assert.ok(err instanceof MediaAttestationValidationError)
      assert.equal(err.message, PROFILE_PHOTO_BLOCKED_MESSAGE)
      return true
    },
  )
})

test('quarantined profile photo status is pending review not rejection', () => {
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.quarantined), true)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.rejected), false)
})
