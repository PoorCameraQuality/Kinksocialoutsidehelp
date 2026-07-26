/**
 * T&S-2 shared media enums - unit tests (no DB).
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ADULT_CONTENT_PREFERENCES,
  DEPICTED_PEOPLE,
  MAX_VIDEO_UPLOAD_BYTES,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  SCAN_STATUSES,
  SCAN_STATUS_VALUES,
  hasRequiredAttestations,
  explicitCannotBePublicPreview,
  isExplicitRating,
  isPublishBlocked,
  isScanBlockingPublish,
  isKnownAdultContentPreference,
  isKnownDepictedPeople,
  isKnownMediaContentRating,
  isKnownMediaUploadStatus,
  isKnownMediaVisibility,
  isKnownScanStatus,
  mapUploaderAttestationToPublishLaneFields,
  resolvePublishLane,
  scanStatusSchema,
  uploadLimitMegabytes,
  visibilityAllowsAnonymousDirectUrl,
} from './media-types.js'

describe('T&S-2 media-types (shared)', () => {
  test('upload status enum is complete and guarded', () => {
    for (const status of Object.values(MEDIA_UPLOAD_STATUSES)) {
      assert.equal(isKnownMediaUploadStatus(status), true, `missing guard for ${status}`)
    }
    assert.equal(isKnownMediaUploadStatus('NOT_A_STATUS'), false)
  })

  test('content rating enum is complete and guarded', () => {
    for (const rating of Object.values(MEDIA_CONTENT_RATINGS)) {
      assert.equal(isKnownMediaContentRating(rating), true, `missing guard for ${rating}`)
    }
    assert.equal(isKnownMediaContentRating('UNKNOWN'), false)
  })

  test('visibility enum is complete and guarded', () => {
    for (const visibility of Object.values(MEDIA_VISIBILITIES)) {
      assert.equal(isKnownMediaVisibility(visibility), true, `missing guard for ${visibility}`)
    }
    assert.equal(isKnownMediaVisibility('PUBLIC_WEB'), false)
  })

  test('scan status and adult preference guards', () => {
    for (const scan of Object.values(SCAN_STATUSES)) {
      assert.equal(isKnownScanStatus(scan), true)
    }
    for (const pref of Object.values(ADULT_CONTENT_PREFERENCES)) {
      assert.equal(isKnownAdultContentPreference(pref), true)
    }
    for (const people of Object.values(DEPICTED_PEOPLE)) {
      assert.equal(isKnownDepictedPeople(people), true)
    }
  })

  test('resolvePublishLane · GREEN solo explicit with attestations', () => {
    assert.equal(
      resolvePublishLane({
        contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
        depictedPeople: DEPICTED_PEOPLE.onlyMe,
        scanStatus: SCAN_STATUSES.notRequired,
        attestation: {
          allDepictedAreAdults: true,
          iAmDepictedOrAuthorizedUploader: true,
          noHiddenCameraOrNonConsensualCapture: true,
          contentRatingAccurate: true,
        },
      }),
      'GREEN'
    )
  })

  test('resolvePublishLane · RED for blocked illegal', () => {
    assert.equal(
      resolvePublishLane({
        contentRating: MEDIA_CONTENT_RATINGS.blockedIllegal,
        depictedPeople: DEPICTED_PEOPLE.onlyMe,
        scanStatus: SCAN_STATUSES.notRequired,
        attestation: null,
      }),
      'RED'
    )
  })

  test('resolvePublishLane · YELLOW for multi-person, edge review, and pending scan', () => {
    const soloGreen = {
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      depictedPeople: DEPICTED_PEOPLE.onlyMe,
      scanStatus: SCAN_STATUSES.notRequired,
      attestation: {
        allDepictedAreAdults: true,
        iAmDepictedOrAuthorizedUploader: true,
        noHiddenCameraOrNonConsensualCapture: true,
        contentRatingAccurate: true,
      },
    }

    assert.equal(
      resolvePublishLane({ ...soloGreen, depictedPeople: DEPICTED_PEOPLE.meAndOtherAdults }),
      'YELLOW'
    )
    assert.equal(
      resolvePublishLane({ ...soloGreen, contentRating: MEDIA_CONTENT_RATINGS.edgeReview }),
      'YELLOW'
    )
    assert.equal(
      resolvePublishLane({ ...soloGreen, scanStatus: SCAN_STATUSES.pending }),
      'YELLOW'
    )
  })

  test('rating and visibility rule helpers', () => {
    assert.equal(isExplicitRating(MEDIA_CONTENT_RATINGS.explicitAdult), true)
    assert.equal(isPublishBlocked(MEDIA_CONTENT_RATINGS.blockedIllegal), true)
    assert.equal(
      explicitCannotBePublicPreview(
        MEDIA_VISIBILITIES.publicPreview,
        MEDIA_CONTENT_RATINGS.explicitAdult
      ),
      true
    )
    assert.equal(isScanBlockingPublish(SCAN_STATUSES.pending), true)
    assert.equal(isScanBlockingPublish(SCAN_STATUSES.passed), false)
    assert.equal(visibilityAllowsAnonymousDirectUrl(MEDIA_VISIBILITIES.publicPreview), true)
    assert.equal(visibilityAllowsAnonymousDirectUrl(MEDIA_VISIBILITIES.loggedIn), false)
    assert.equal(visibilityAllowsAnonymousDirectUrl(MEDIA_VISIBILITIES.groupOnly), false)
  })

  test('hasRequiredAttestations requires all boolean fields', () => {
    assert.equal(hasRequiredAttestations(null), false)
    assert.equal(
      hasRequiredAttestations({
        allDepictedAreAdults: true,
        iAmDepictedOrAuthorizedUploader: true,
        noHiddenCameraOrNonConsensualCapture: true,
        contentRatingAccurate: true,
      }),
      true
    )
  })

  test('scanStatusSchema accepts every SCAN_STATUSES value including RUNNING', () => {
    for (const status of SCAN_STATUS_VALUES) {
      assert.equal(scanStatusSchema.safeParse(status).success, true, status)
    }
    assert.equal(scanStatusSchema.safeParse(SCAN_STATUSES.running).success, true)
  })

  test('mapUploaderAttestationToPublishLaneFields bridges UI checkboxes to lane fields', () => {
    const lane = mapUploaderAttestationToPublishLaneFields({
      uploaderConfirmed18: true,
      uploaderConfirmedDepictedAdults18: true,
      uploaderConfirmedConsent: true,
      uploaderConfirmedRightToUpload: true,
      uploaderConfirmedNoNcii: true,
      uploaderConfirmedNoMinors: true,
      uploaderConfirmedNoHiddenCamera: true,
      uploaderConfirmedNoAiDeepfakeWithoutConsent: true,
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
    })
    assert.equal(hasRequiredAttestations(lane), true)
    assert.equal(
      resolvePublishLane({
        contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
        depictedPeople: DEPICTED_PEOPLE.onlyMe,
        scanStatus: SCAN_STATUSES.passed,
        attestation: lane,
      }),
      'GREEN',
    )
  })

  test('video upload limit constant is 100 MiB', () => {
    assert.equal(MAX_VIDEO_UPLOAD_BYTES, 100 * 1024 * 1024)
    assert.equal(uploadLimitMegabytes(MAX_VIDEO_UPLOAD_BYTES), 100)
  })
})
