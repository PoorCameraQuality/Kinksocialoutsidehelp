import assert from 'node:assert/strict'
import test from 'node:test'
import { MEDIA_UPLOAD_STATUSES } from '@c2k/shared'
import { isProfilePhotoPendingReviewStatus, pickPrimaryProfilePhoto } from '@c2k/shared'

test('isProfilePhotoPendingReviewStatus treats quarantine and scan queue as pending', () => {
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.quarantined), true)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.pendingScan), true)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.escalated), true)
})

test('pickPrimaryProfilePhoto prefers newest photo at order 0', () => {
  const photos = [
    { id: 'a', order: 0 },
    { id: 'b', order: 0 },
    { id: 'c', order: 1 },
  ]
  assert.equal(pickPrimaryProfilePhoto(photos)?.id, 'b')
})

test('isProfilePhotoPendingReviewStatus excludes published and hard rejects', () => {
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.autoApproved), false)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.approvedBlurred), false)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.rejected), false)
  assert.equal(isProfilePhotoPendingReviewStatus(MEDIA_UPLOAD_STATUSES.pendingAttestation), false)
})
