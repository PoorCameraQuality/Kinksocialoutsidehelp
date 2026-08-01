import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MEDIA_UPLOAD_STATUSES } from '@c2k/shared'

import { SetPrimaryProfilePhotoError } from './set-primary-profile-photo.js'
import { isPhotoAvatarEligible, type ProfilePhotoDto } from './profile-photo-gallery.js'

function photo(partial: Partial<ProfilePhotoDto> & Pick<ProfilePhotoDto, 'id' | 'order'>): ProfilePhotoDto {
  return {
    url: 'https://example.com/p.jpg',
    caption: null,
    displaySettings: { displayFit: 'cover' },
    mediaAssetId: '11111111-1111-1111-1111-111111111111',
    uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
    contentRating: 'safePublic',
    visibility: 'publicPreview',
    isBlurredByDefault: false,
    pendingReview: false,
    publishLane: null,
    ...partial,
  }
}

describe('isPhotoAvatarEligible', () => {
  it('allows published photos', () => {
    assert.equal(isPhotoAvatarEligible(photo({ id: 'a', order: 1 })), true)
  })

  it('rejects pending review', () => {
    assert.equal(
      isPhotoAvatarEligible(photo({ id: 'a', order: 1, pendingReview: true })),
      false,
    )
  })

  it('rejects pending attestation', () => {
    assert.equal(
      isPhotoAvatarEligible(
        photo({ id: 'a', order: 1, uploadStatus: MEDIA_UPLOAD_STATUSES.pendingAttestation }),
      ),
      false,
    )
  })

  it('rejects missing media asset', () => {
    assert.equal(
      isPhotoAvatarEligible(photo({ id: 'a', order: 1, mediaAssetId: null })),
      false,
    )
  })
})

describe('SetPrimaryProfilePhotoError', () => {
  it('carries a stable code', () => {
    const err = new SetPrimaryProfilePhotoError('nope', 'not_eligible')
    assert.equal(err.code, 'not_eligible')
    assert.equal(err.name, 'SetPrimaryProfilePhotoError')
  })
})
