import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import {
  MEDIA_HASH_KINDS,
  MEDIA_HASH_LIST_ACTIONS,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  POLICY_REASONS,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
  SCAN_STATUSES,
  aggregateScannerResults,
  scannerResultToScanStatus,
} from '@c2k/shared'
import { MalwareClamAvScanner, AdultClassifierScanner, OcrRiskScanner } from '../lib/media-scan/adapters.js'
import { ExactHashListScanner } from '../lib/media-scan/hash-list.js'
import type { MediaScanContext } from '../lib/media-scan/types.js'
import {
  isInfraOnlyMalwareScannerFailure,
  softenProfileGalleryScanAggregate,
} from '../lib/profile-gallery-scan-policy.js'

const baseContext: MediaScanContext = {
  mediaAssetId: '00000000-0000-4000-8000-000000000001',
  sha256Hash: 'abc123',
  mimeType: 'image/jpeg',
  quarantineStorageKey: 'quarantine/x.jpg',
  contentRating: null,
  visibility: null,
  originalFilename: 'photo.jpg',
  sourceSurface: null,
  buffer: null,
}

describe('T&S-4A scanner adapters (unit)', () => {
  test('profile gallery infra-only malware error softens to passed for safe public', () => {
    const results = [
      {
        scannerName: SCANNER_NAMES.malwareClamav,
        status: SCANNER_RESULT_STATUSES.error,
        labels: ['scanner_unavailable'],
      },
      { scannerName: SCANNER_NAMES.exactHash, status: SCANNER_RESULT_STATUSES.passed, labels: [] },
      {
        scannerName: SCANNER_NAMES.adultClassifier,
        status: SCANNER_RESULT_STATUSES.passed,
        labels: [],
      },
      { scannerName: SCANNER_NAMES.ocrRisk, status: SCANNER_RESULT_STATUSES.passed, labels: [] },
    ]
    assert.ok(isInfraOnlyMalwareScannerFailure(results))
    assert.equal(
      softenProfileGalleryScanAggregate({
        sourceSurface: 'profile_gallery',
        contentRating: 'SAFE_PUBLIC',
        aggregateScannerStatus: SCANNER_RESULT_STATUSES.error,
        scannerResults: results,
      }),
      SCANNER_RESULT_STATUSES.passed,
    )
  })

  test('profile gallery explicit content does not soften infra-only malware error', () => {
    const results = [
      {
        scannerName: SCANNER_NAMES.malwareClamav,
        status: SCANNER_RESULT_STATUSES.error,
        labels: ['scanner_unavailable'],
      },
      { scannerName: SCANNER_NAMES.exactHash, status: SCANNER_RESULT_STATUSES.passed, labels: [] },
      {
        scannerName: SCANNER_NAMES.adultClassifier,
        status: SCANNER_RESULT_STATUSES.passed,
        labels: [],
      },
      { scannerName: SCANNER_NAMES.ocrRisk, status: SCANNER_RESULT_STATUSES.passed, labels: [] },
    ]
    assert.equal(
      softenProfileGalleryScanAggregate({
        sourceSurface: 'profile_gallery',
        contentRating: 'EXPLICIT_ADULT',
        aggregateScannerStatus: SCANNER_RESULT_STATUSES.error,
        scannerResults: results,
      }),
      SCANNER_RESULT_STATUSES.error,
    )
  })

  test('aggregateScannerResults worst status wins', () => {
    assert.equal(
      aggregateScannerResults([
        { status: SCANNER_RESULT_STATUSES.passed },
        { status: SCANNER_RESULT_STATUSES.flagged },
      ]),
      SCANNER_RESULT_STATUSES.flagged
    )
    assert.equal(
      scannerResultToScanStatus(SCANNER_RESULT_STATUSES.blocked),
      SCAN_STATUSES.failed
    )
    assert.equal(scannerResultToScanStatus(SCANNER_RESULT_STATUSES.error), SCAN_STATUSES.error)
  })

  test('malware noop when clamd unavailable in local dev', async () => {
    const prevMalware = process.env.MEDIA_SCANNER_MALWARE
    const prevNode = process.env.NODE_ENV
    const prevAllow = process.env.MEDIA_SCANNER_ALLOW_NOOP
    process.env.MEDIA_SCANNER_MALWARE = 'auto'
    process.env.NODE_ENV = 'development'
    process.env.MEDIA_SCANNER_ALLOW_NOOP = 'true'
    delete process.env.MEDIA_SCAN_SIMULATE_MALWARE
    try {
      const scanner = new MalwareClamAvScanner()
      const result = await scanner.scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.passed)
      assert.ok(result.labels?.includes('NOOP_PASSED'))
    } finally {
      process.env.MEDIA_SCANNER_MALWARE = prevMalware
      if (prevNode === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevNode
      if (prevAllow === undefined) delete process.env.MEDIA_SCANNER_ALLOW_NOOP
      else process.env.MEDIA_SCANNER_ALLOW_NOOP = prevAllow
    }
  })

  test('strict staging returns ERROR when clamd down', async () => {
    const prevMalware = process.env.MEDIA_SCANNER_MALWARE
    const prevEnv = process.env.C2K_ENV
    const prevAllow = process.env.MEDIA_SCANNER_ALLOW_NOOP
    process.env.C2K_ENV = 'staging'
    process.env.MEDIA_SCANNER_ALLOW_NOOP = 'false'
    delete process.env.MEDIA_SCANNER_MALWARE
    delete process.env.MEDIA_SCAN_SIMULATE_MALWARE
    try {
      const result = await new MalwareClamAvScanner().scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.error)
    } finally {
      process.env.MEDIA_SCANNER_MALWARE = prevMalware
      if (prevEnv === undefined) delete process.env.C2K_ENV
      else process.env.C2K_ENV = prevEnv
      if (prevAllow === undefined) delete process.env.MEDIA_SCANNER_ALLOW_NOOP
      else process.env.MEDIA_SCANNER_ALLOW_NOOP = prevAllow
    }
  })

  test('simulated malware blocks', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE_MALWARE
    process.env.MEDIA_SCAN_SIMULATE_MALWARE = 'BLOCKED'
    try {
      const result = await new MalwareClamAvScanner().scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.blocked)
    } finally {
      process.env.MEDIA_SCAN_SIMULATE_MALWARE = prev
    }
  })

  test('hash simulate DENY blocks', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE_HASH
    process.env.MEDIA_SCAN_SIMULATE_HASH = 'DENY'
    try {
      const result = await new ExactHashListScanner().scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.blocked)
    } finally {
      process.env.MEDIA_SCAN_SIMULATE_HASH = prev
    }
  })

  test('hash simulate REVIEW flags', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE_HASH
    process.env.MEDIA_SCAN_SIMULATE_HASH = 'REVIEW'
    try {
      const result = await new ExactHashListScanner().scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.flagged)
    } finally {
      process.env.MEDIA_SCAN_SIMULATE_HASH = prev
    }
  })

  test('classifier explicit attestation passes', async () => {
    const result = await new AdultClassifierScanner().scan({
      ...baseContext,
      contentRating: 'EXPLICIT_ADULT',
    })
    assert.equal(result.status, SCANNER_RESULT_STATUSES.passed)
    assert.ok(result.labels?.includes('explicit_adult'))
  })

  test('classifier SAFE vs explicit mismatch flags', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER
    process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER = 'MISMATCH'
    try {
      const result = await new AdultClassifierScanner().scan({
        ...baseContext,
        contentRating: 'SAFE_PUBLIC',
      })
      assert.equal(result.status, SCANNER_RESULT_STATUSES.flagged)
      assert.equal(result.policyReason, POLICY_REASONS.explicitVisibilityViolation)
    } finally {
      process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER = prev
    }
  })

  test('OCR NCII terms flag', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE_OCR
    process.env.MEDIA_SCAN_SIMULATE_OCR = 'NCII'
    try {
      const result = await new OcrRiskScanner().scan(baseContext)
      assert.equal(result.status, SCANNER_RESULT_STATUSES.flagged)
    } finally {
      process.env.MEDIA_SCAN_SIMULATE_OCR = prev
    }
  })

  test('scanner ERROR maps to asset error status', () => {
    assert.equal(scannerResultToScanStatus(SCANNER_RESULT_STATUSES.error), SCAN_STATUSES.error)
  })
})
