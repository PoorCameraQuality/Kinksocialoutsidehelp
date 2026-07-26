import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ADULT_CONTENT_PREFERENCES,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
} from '@c2k/shared'
import {
  canViewerSeeMedia,
  passesMediaRatingAndStatusGate,
  isMediaPublished,
  shouldBlurMediaForViewer,
  validateVisibilityRatingCombo,
  type MediaVisibilityMedia,
  type MediaVisibilityViewer,
} from './media-visibility.js'

const publishedExplicit: MediaVisibilityMedia = {
  contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
  visibility: MEDIA_VISIBILITIES.loggedIn,
  uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
  isBlurredByDefault: false,
}

const publishedSafePublic: MediaVisibilityMedia = {
  contentRating: MEDIA_CONTENT_RATINGS.safePublic,
  visibility: MEDIA_VISIBILITIES.publicPreview,
  uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
  isBlurredByDefault: false,
}

const signedInShow: MediaVisibilityViewer = {
  authenticated: true,
  adultContentPref: ADULT_CONTENT_PREFERENCES.show,
}

const signedInBlur: MediaVisibilityViewer = {
  authenticated: true,
  adultContentPref: ADULT_CONTENT_PREFERENCES.blur,
}

const signedInHide: MediaVisibilityViewer = {
  authenticated: true,
  adultContentPref: ADULT_CONTENT_PREFERENCES.hide,
}

const loggedOut: MediaVisibilityViewer = {
  authenticated: false,
  adultContentPref: ADULT_CONTENT_PREFERENCES.show,
}

describe('isMediaPublished', () => {
  it('treats AUTO_APPROVED and APPROVED_BLURRED as published', () => {
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.autoApproved), true)
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.approvedBlurred), true)
  })

  it('rejects pending, quarantined, and rejected statuses', () => {
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.pendingUpload), false)
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.pendingAttestation), false)
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.pendingScan), false)
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.quarantined), false)
    assert.equal(isMediaPublished(MEDIA_UPLOAD_STATUSES.rejected), false)
  })
})

describe('validateVisibilityRatingCombo', () => {
  it('blocks explicit content on PUBLIC_PREVIEW', () => {
    const result = validateVisibilityRatingCombo(
      MEDIA_VISIBILITIES.publicPreview,
      MEDIA_CONTENT_RATINGS.explicitAdult,
    )
    assert.deepEqual(result, { ok: false, reason: 'explicit_public_preview' })
  })

  it('blocks BLOCKED_ILLEGAL from publishing', () => {
    const result = validateVisibilityRatingCombo(
      MEDIA_VISIBILITIES.loggedIn,
      MEDIA_CONTENT_RATINGS.blockedIllegal,
    )
    assert.deepEqual(result, { ok: false, reason: 'blocked_illegal' })
  })

  it('blocks EDGE_REVIEW from auto-publish', () => {
    const result = validateVisibilityRatingCombo(
      MEDIA_VISIBILITIES.loggedIn,
      MEDIA_CONTENT_RATINGS.edgeReview,
    )
    assert.deepEqual(result, { ok: false, reason: 'edge_review_no_auto_publish' })
  })

  it('allows safe explicit on LOGGED_IN', () => {
    const result = validateVisibilityRatingCombo(
      MEDIA_VISIBILITIES.loggedIn,
      MEDIA_CONTENT_RATINGS.explicitAdult,
    )
    assert.deepEqual(result, { ok: true })
  })
})

describe('passesMediaRatingAndStatusGate', () => {
  it('keeps deprecated canViewerSeeMedia alias identical', () => {
    assert.equal(canViewerSeeMedia, passesMediaRatingAndStatusGate)
  })

  it('allows signed-in viewers for published explicit on LOGGED_IN', () => {
    assert.equal(passesMediaRatingAndStatusGate(signedInShow, publishedExplicit), true)
  })

  it('hides explicit from logged-out viewers on LOGGED_IN', () => {
    assert.equal(passesMediaRatingAndStatusGate(loggedOut, publishedExplicit), false)
  })

  it('hides explicit when preference is HIDE', () => {
    assert.equal(passesMediaRatingAndStatusGate(signedInHide, publishedExplicit), false)
  })

  it('still shows adult non-explicit when preference is HIDE', () => {
    const adultNonExplicit = {
      ...publishedExplicit,
      contentRating: MEDIA_CONTENT_RATINGS.adultNonExplicit,
    }
    assert.equal(passesMediaRatingAndStatusGate(signedInHide, adultNonExplicit), true)
  })

  it('allows public preview for safe content when logged out', () => {
    assert.equal(passesMediaRatingAndStatusGate(loggedOut, publishedSafePublic), true)
  })

  it('hides pending media from members', () => {
    const pending = {
      ...publishedSafePublic,
      uploadStatus: MEDIA_UPLOAD_STATUSES.pendingScan,
    }
    assert.equal(passesMediaRatingAndStatusGate(signedInShow, pending), false)
    assert.equal(passesMediaRatingAndStatusGate({ ...signedInShow, isStaff: true }, pending), true)
  })

  it('hides quarantined media from members', () => {
    const quarantined = {
      ...publishedExplicit,
      uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
    }
    assert.equal(passesMediaRatingAndStatusGate(signedInShow, quarantined), false)
    assert.equal(
      passesMediaRatingAndStatusGate({ ...signedInShow, isStaff: true }, quarantined),
      true,
    )
  })

  it('hides EDGE_REVIEW from non-staff', () => {
    const edge = {
      ...publishedSafePublic,
      contentRating: MEDIA_CONTENT_RATINGS.edgeReview,
    }
    assert.equal(passesMediaRatingAndStatusGate(signedInShow, edge), false)
    assert.equal(passesMediaRatingAndStatusGate({ ...signedInShow, isStaff: true }, edge), true)
  })
})

describe('shouldBlurMediaForViewer', () => {
  it('does not blur explicit for signed-in SHOW preference', () => {
    assert.equal(shouldBlurMediaForViewer(signedInShow, publishedExplicit), false)
  })

  it('blurs explicit for BLUR preference', () => {
    assert.equal(shouldBlurMediaForViewer(signedInBlur, publishedExplicit), true)
  })

  it('blurs explicit for logged-out viewers', () => {
    const publicAdult = {
      ...publishedExplicit,
      visibility: MEDIA_VISIBILITIES.publicPreview,
      contentRating: MEDIA_CONTENT_RATINGS.adultNonExplicit,
    }
    assert.equal(passesMediaRatingAndStatusGate(loggedOut, publicAdult), true)
    assert.equal(shouldBlurMediaForViewer(loggedOut, publicAdult), true)
  })

  it('blurs quarantined media even for staff viewers', () => {
    const quarantined = {
      ...publishedExplicit,
      uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
    }
    assert.equal(shouldBlurMediaForViewer({ ...signedInShow, isStaff: true }, quarantined), true)
  })

  it('blurs for moderator safe mode', () => {
    assert.equal(
      shouldBlurMediaForViewer({ ...signedInShow, moderatorSafeMode: true }, publishedExplicit),
      true,
    )
  })

  it('does not blur safe public content', () => {
    assert.equal(shouldBlurMediaForViewer(loggedOut, publishedSafePublic), false)
  })

  it('blurs APPROVED_BLURRED publish status', () => {
    const blurred = {
      ...publishedExplicit,
      uploadStatus: MEDIA_UPLOAD_STATUSES.approvedBlurred,
    }
    assert.equal(shouldBlurMediaForViewer(signedInShow, blurred), true)
  })

  it('returns false when media is not visible', () => {
    assert.equal(shouldBlurMediaForViewer(signedInHide, publishedExplicit), false)
  })
})
