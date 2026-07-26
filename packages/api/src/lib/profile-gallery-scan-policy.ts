import {
  MEDIA_CONTENT_RATINGS,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
  type ScannerResultRecord,
  type ScannerResultStatus,
} from '@c2k/shared'
import { isProfileGallerySurface } from './profile-photo-policy.js'

const CONTENT_SCANNERS = [
  SCANNER_NAMES.exactHash,
  SCANNER_NAMES.adultClassifier,
  SCANNER_NAMES.ocrRisk,
] as const

/** Malware scanner down / timeout — not a content signal. */
export function isInfraOnlyMalwareScannerFailure(
  results: Array<Pick<ScannerResultRecord, 'scannerName' | 'status' | 'labels'>>,
): boolean {
  const malware = results.find((r) => r.scannerName === SCANNER_NAMES.malwareClamav)
  if (!malware || malware.status !== SCANNER_RESULT_STATUSES.error) return false
  const labels = malware.labels ?? []
  if (!labels.includes('scanner_unavailable') && !labels.includes('scanner_error')) return false
  return CONTENT_SCANNERS.every((name) => {
    const row = results.find((r) => r.scannerName === name)
    return row?.status === SCANNER_RESULT_STATUSES.passed
  })
}

/** Profile headshots: do not block publish when only ClamAV infra failed and content scanners passed (safe public only). */
export function softenProfileGalleryScanAggregate(params: {
  sourceSurface: string | null | undefined
  contentRating: string | null | undefined
  aggregateScannerStatus: ScannerResultStatus
  scannerResults: Array<Pick<ScannerResultRecord, 'scannerName' | 'status' | 'labels'>>
}): ScannerResultStatus {
  if (params.aggregateScannerStatus !== SCANNER_RESULT_STATUSES.error) {
    return params.aggregateScannerStatus
  }
  if (!isProfileGallerySurface(params.sourceSurface)) return params.aggregateScannerStatus
  // Explicit or non-safe ratings must not auto-publish when malware scan is unavailable.
  if (params.contentRating !== MEDIA_CONTENT_RATINGS.safePublic) return params.aggregateScannerStatus
  if (!isInfraOnlyMalwareScannerFailure(params.scannerResults)) return params.aggregateScannerStatus
  return SCANNER_RESULT_STATUSES.passed
}

export function shouldSkipScannerModerationCase(
  scannerResults: Array<Pick<ScannerResultRecord, 'scannerName' | 'status' | 'labels'>>,
): boolean {
  return isInfraOnlyMalwareScannerFailure(scannerResults)
}
