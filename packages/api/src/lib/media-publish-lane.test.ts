import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  SCAN_STATUSES,
  type MediaAttestationFields,
} from '@c2k/shared'
import {
  NEW_ACCOUNT_AGE_THRESHOLD_DAYS,
  accountTrustSignalsElevateToYellow,
  allRequiredAttestationsPresent,
  alphaHumanReviewRequiredForAutoPublish,
  captionContainsRiskTerms,
  computeMediaUploadStatusAfterAttestation,
  computePublishLaneAfterAttestation,
  isMultiPersonExplicitPendingReview,
  resolveEffectivePublishLane,
} from './media-publish-lane.js'

function fullAttestation(): MediaAttestationFields {
  return {
    allDepictedAreAdults: true,
    iAmDepictedOrAuthorizedUploader: true,
    noHiddenCameraOrNonConsensualCapture: true,
    contentRatingAccurate: true,
  }
}

const trustedAccount = { accountAgeDays: 90, priorReports: 0 }

test('media-publish-lane. AllRequiredAttestationsPresent', () => {
  assert.equal(allRequiredAttestationsPresent(null), false)
  assert.equal(allRequiredAttestationsPresent({}), false)
  assert.equal(
    allRequiredAttestationsPresent({ ...fullAttestation(), allDepictedAreAdults: false }),
    false
  )
  assert.equal(allRequiredAttestationsPresent(fullAttestation()), true)
})

test('media-publish-lane. Caption risk terms force YELLOW', () => {
  assert.equal(captionContainsRiskTerms('totally normal rope scene'), false)
  assert.equal(captionContainsRiskTerms('barely legal vibes'), true)
  assert.equal(captionContainsRiskTerms('LEAKED footage'), true)

  const greenBase = {
    contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
    depictedPeople: DEPICTED_PEOPLE.onlyMe,
    scanStatus: SCAN_STATUSES.notRequired,
    attestation: fullAttestation(),
    accountTrustSignals: trustedAccount,
  }

  assert.equal(resolveEffectivePublishLane(greenBase), 'GREEN')
  assert.equal(
    resolveEffectivePublishLane({ ...greenBase, caption: 'hidden cam clip' }),
    'YELLOW'
  )
  assert.equal(
    computeMediaUploadStatusAfterAttestation({ ...greenBase, caption: 'teen model' }),
    MEDIA_UPLOAD_STATUSES.pendingScan
  )
})

test('media-publish-lane. Account trust placeholder elevates explicit new accounts', () => {
  const soloExplicit = {
    contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
    depictedPeople: DEPICTED_PEOPLE.onlyMe,
    scanStatus: SCAN_STATUSES.notRequired,
    attestation: fullAttestation(),
  }

  assert.equal(
    accountTrustSignalsElevateToYellow(
      { accountAgeDays: NEW_ACCOUNT_AGE_THRESHOLD_DAYS - 1, priorReports: 0 },
      MEDIA_CONTENT_RATINGS.explicitAdult
    ),
    true
  )
  assert.equal(
    accountTrustSignalsElevateToYellow(trustedAccount, MEDIA_CONTENT_RATINGS.explicitAdult),
    false
  )
  assert.equal(
    accountTrustSignalsElevateToYellow(
      { accountAgeDays: 30, priorReports: 2 },
      MEDIA_CONTENT_RATINGS.safePublic
    ),
    false
  )

  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      ...soloExplicit,
      accountTrustSignals: { accountAgeDays: 1, priorReports: 0 },
    }),
    MEDIA_UPLOAD_STATUSES.pendingScan
  )
})

test('media-publish-lane · post-moderation: no pre-publish human-review force', () => {
  // Product policy: publish after scan; hide/YELLOW only when reported (or
  // other existing elevates like caption risk / multi-person explicit).
  assert.equal(
    alphaHumanReviewRequiredForAutoPublish({
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      visibility: MEDIA_VISIBILITIES.loggedIn,
    }),
    false
  )
  assert.equal(
    alphaHumanReviewRequiredForAutoPublish({
      contentRating: MEDIA_CONTENT_RATINGS.safePublic,
      visibility: MEDIA_VISIBILITIES.publicPreview,
    }),
    false
  )

  const soloExplicit = {
    contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
    depictedPeople: DEPICTED_PEOPLE.onlyMe,
    scanStatus: SCAN_STATUSES.notRequired,
    attestation: fullAttestation(),
    accountTrustSignals: trustedAccount,
  }
  assert.equal(resolveEffectivePublishLane(soloExplicit), 'GREEN')
  assert.equal(
    computeMediaUploadStatusAfterAttestation(soloExplicit),
    MEDIA_UPLOAD_STATUSES.autoApproved
  )
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.safePublic,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
      visibility: MEDIA_VISIBILITIES.loggedIn,
    }),
    MEDIA_UPLOAD_STATUSES.autoApproved
  )
  assert.equal(
    computePublishLaneAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.adultNonExplicit,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
    }),
    'GREEN'
  )
})

test('media-publish-lane · GREEN solo explicit and safe member destinations auto-approve', () => {
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
      accountTrustSignals: trustedAccount,
    }),
    MEDIA_UPLOAD_STATUSES.autoApproved
  )
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.safePublic,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
      visibility: MEDIA_VISIBILITIES.loggedIn,
    }),
    MEDIA_UPLOAD_STATUSES.autoApproved
  )
})

test('media-publish-lane · YELLOW multi-person explicit quarantines', () => {
  assert.equal(
    isMultiPersonExplicitPendingReview(
      MEDIA_CONTENT_RATINGS.explicitAdult,
      DEPICTED_PEOPLE.meAndOtherAdults
    ),
    true
  )

  const status = computeMediaUploadStatusAfterAttestation({
    contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
    depictedPeople: DEPICTED_PEOPLE.otherAdults,
    scanStatus: SCAN_STATUSES.notRequired,
    attestation: fullAttestation(),
    accountTrustSignals: trustedAccount,
  })

  assert.equal(status, MEDIA_UPLOAD_STATUSES.quarantined)
})

test('media-publish-lane · YELLOW edge review and scan backlog pending scan', () => {
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.edgeReview,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
    }),
    MEDIA_UPLOAD_STATUSES.pendingScan
  )

  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.pending,
      attestation: fullAttestation(),
      accountTrustSignals: trustedAccount,
    }),
    MEDIA_UPLOAD_STATUSES.pendingScan
  )
})

test('media-publish-lane · RED blocked illegal rejects', () => {
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.blockedIllegal,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
    }),
    MEDIA_UPLOAD_STATUSES.rejected
  )
  assert.equal(
    resolveEffectivePublishLane({
      contentRating: MEDIA_CONTENT_RATINGS.blockedIllegal,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: fullAttestation(),
      caption: 'teen',
    }),
    'RED'
  )
})

test('media-publish-lane. Incomplete attestation stays pending', () => {
  assert.equal(
    computeMediaUploadStatusAfterAttestation({
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: { allDepictedAreAdults: true },
    }),
    MEDIA_UPLOAD_STATUSES.pendingAttestation
  )
})
