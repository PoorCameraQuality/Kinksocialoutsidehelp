import { z } from 'zod'
import type { ModerationQueue, PolicyReason, PolicySeverity } from './moderation-types.js'
import { SCAN_STATUSES, type ScanStatus } from './media-types.js'

/** Per-scanner outcome - distinct from aggregate asset scan_status. */
export const SCANNER_RESULT_STATUSES = {
  passed: 'PASSED',
  flagged: 'FLAGGED',
  blocked: 'BLOCKED',
  error: 'ERROR',
} as const

export type ScannerResultStatus =
  (typeof SCANNER_RESULT_STATUSES)[keyof typeof SCANNER_RESULT_STATUSES]

export const SCANNER_RESULT_STATUS_VALUES: readonly ScannerResultStatus[] = Object.values(
  SCANNER_RESULT_STATUSES
)

export const SCANNER_NAMES = {
  malwareClamav: 'malware_clamav',
  exactHash: 'exact_hash',
  adultClassifier: 'adult_classifier',
  ocrRisk: 'ocr_risk',
} as const

export type ScannerName = (typeof SCANNER_NAMES)[keyof typeof SCANNER_NAMES]

export const SCANNER_NAME_VALUES: readonly ScannerName[] = Object.values(SCANNER_NAMES)

export const SCANNER_VERSIONS: Record<ScannerName, string> = {
  [SCANNER_NAMES.malwareClamav]: '1.0.0',
  [SCANNER_NAMES.exactHash]: '1.0.0',
  [SCANNER_NAMES.adultClassifier]: '1.0.0',
  [SCANNER_NAMES.ocrRisk]: '1.0.0',
}

export const MEDIA_HASH_LIST_ACTIONS = {
  deny: 'DENY',
  review: 'REVIEW',
} as const

export type MediaHashListAction =
  (typeof MEDIA_HASH_LIST_ACTIONS)[keyof typeof MEDIA_HASH_LIST_ACTIONS]

export const MEDIA_HASH_KINDS = {
  sha256: 'SHA256',
  perceptual: 'PERCEPTUAL',
} as const

export type MediaHashKind = (typeof MEDIA_HASH_KINDS)[keyof typeof MEDIA_HASH_KINDS]

export type ScannerResultRecord = {
  scannerName: ScannerName
  scannerVersion: string
  status: ScannerResultStatus
  confidence: number | null
  labels: string[]
  policyReason: PolicyReason | null
  severity: PolicySeverity | null
  queue: ModerationQueue | null
  userFacingSummary: string
  simulated: boolean
}

/** Worst per-scanner status wins when aggregating to asset scan_status. */
const SCANNER_STATUS_RANK: Record<ScannerResultStatus, number> = {
  PASSED: 0,
  FLAGGED: 1,
  ERROR: 2,
  BLOCKED: 3,
}

export function aggregateScannerResults(
  results: Array<{ status: ScannerResultStatus }>
): ScannerResultStatus {
  if (results.length === 0) return SCANNER_RESULT_STATUSES.passed
  let worst: ScannerResultStatus = SCANNER_RESULT_STATUSES.passed
  for (const row of results) {
    if (SCANNER_STATUS_RANK[row.status] > SCANNER_STATUS_RANK[worst]) {
      worst = row.status
    }
  }
  return worst
}

/** Map per-scanner status to asset-level scan_status. */
export function scannerResultToScanStatus(status: ScannerResultStatus): ScanStatus {
  switch (status) {
    case SCANNER_RESULT_STATUSES.blocked:
      return SCAN_STATUSES.failed
    case SCANNER_RESULT_STATUSES.error:
      return SCAN_STATUSES.error
    case SCANNER_RESULT_STATUSES.flagged:
      return SCAN_STATUSES.flagged
    default:
      return SCAN_STATUSES.passed
  }
}

export const scannerResultStatusSchema = z.enum([
  SCANNER_RESULT_STATUSES.passed,
  SCANNER_RESULT_STATUSES.flagged,
  SCANNER_RESULT_STATUSES.blocked,
  SCANNER_RESULT_STATUSES.error,
])
