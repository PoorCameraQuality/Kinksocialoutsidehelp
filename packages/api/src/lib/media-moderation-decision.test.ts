import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  MEDIA_CONTENT_RATINGS,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCAN_STATUSES,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
} from '@c2k/shared'
import type { MediaAsset } from '../db/schema.js'
import {
  deriveMediaModerationDecision,
  MEDIA_MODERATION_REASON_CODES,
} from './media-moderation-decision.js'

function baseAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'asset-1',
    uploaderUserId: 'user-1',
    storageKey: 'quarantine/user-1/photo.jpg',
    quarantineStorageKey: 'quarantine/user-1/photo.jpg',
    storageState: MEDIA_STORAGE_STATES.validatedPrivate,
    uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
    scanStatus: SCAN_STATUSES.passed,
    visibility: 'LOGGED_IN',
    contentRating: MEDIA_CONTENT_RATINGS.safePublic,
    sourceSurface: 'profile_gallery',
    mimeType: 'image/jpeg',
    ...overrides,
  } as MediaAsset
}

const passedScanners = [
  {
    scannerName: SCANNER_NAMES.malwareClamav,
    scannerVersion: '1',
    status: SCANNER_RESULT_STATUSES.passed,
    confidence: null,
    labels: ['clamd_scanned'],
    policyReason: null,
    severity: null,
    queue: null,
    userFacingSummary: 'Malware scan passed.',
    simulated: false,
  },
]

describe('media-moderation-decision', () => {
  test('SAFE_PUBLIC profile photo auto-approved uses alpha auth proxy reason', () => {
    const decision = deriveMediaModerationDecision({
      asset: baseAsset(),
      publishLane: 'GREEN',
      scannerResults: passedScanners,
    })
    assert.equal(decision.reasonCode, MEDIA_MODERATION_REASON_CODES.alphaValidatedPrivate)
    assert.equal(decision.blockedFromMemberSurfaces, false)
    assert.equal(decision.alphaAuthProxyServing, true)
    assert.equal(decision.usesQuarantineStoragePrefix, true)
  })

  test('pending attestation is blocked with clear reason', () => {
    const decision = deriveMediaModerationDecision({
      asset: baseAsset({ uploadStatus: MEDIA_UPLOAD_STATUSES.pendingAttestation }),
    })
    assert.equal(decision.reasonCode, MEDIA_MODERATION_REASON_CODES.pendingAttestation)
    assert.equal(decision.blockedFromMemberSurfaces, true)
  })

  test('scanner error without infra soften is pending scan', () => {
    const decision = deriveMediaModerationDecision({
      asset: baseAsset({
        uploadStatus: MEDIA_UPLOAD_STATUSES.pendingScan,
        scanStatus: SCAN_STATUSES.error,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
      }),
      publishLane: 'GREEN',
      scannerResults: [
        {
          scannerName: SCANNER_NAMES.malwareClamav,
          scannerVersion: '1',
          status: SCANNER_RESULT_STATUSES.error,
          confidence: null,
          labels: ['scanner_unavailable'],
          policyReason: null,
          severity: null,
          queue: null,
          userFacingSummary: 'Malware scanner required but clamd is unavailable.',
          simulated: false,
        },
        ...passedScanners.filter((s) => s.scannerName !== SCANNER_NAMES.malwareClamav),
      ],
    })
    assert.equal(decision.reasonCode, MEDIA_MODERATION_REASON_CODES.scannerErrorPendingScan)
    assert.equal(decision.blockedFromMemberSurfaces, true)
  })

  test('public visibility promotion uses approved public reason', () => {
    const decision = deriveMediaModerationDecision({
      asset: baseAsset({
        visibility: 'PUBLIC',
        storageState: MEDIA_STORAGE_STATES.approvedPublic,
        publicStorageKey: 'media/user-1/asset-1.jpg',
      }),
      publishLane: 'GREEN',
      scannerResults: passedScanners,
    })
    assert.equal(decision.reasonCode, MEDIA_MODERATION_REASON_CODES.approvedPublic)
    assert.equal(decision.alphaAuthProxyServing, false)
  })
})
