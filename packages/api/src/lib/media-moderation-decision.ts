/**
 * Derive media publish / quarantine *decisions* from scan + lane state.
 *
 * Read-model / pipeline logic — not human moderator actions. For quarantine/remove/
 * restore mutations see `media-mod-actions.ts`.
 */
import {
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCAN_STATUSES,
  visibilityAllowsAnonymousDirectUrl,
  type MediaPublishLane,
  type MediaUploadStatus,
  type ScanStatus,
  type ScannerResultRecord,
  type ScannerResultStatus,
} from '@c2k/shared'
import type { MediaAsset } from '../db/schema.js'
import { buildMediaScannerSummary, loadScannerResultsForAsset } from './media-scan/orchestrator.js'
import { isInfraOnlyMalwareScannerFailure } from './profile-gallery-scan-policy.js'

/** Machine-readable reason for upload / moderation outcome (logs, admin UI, debug API). */
export const MEDIA_MODERATION_REASON_CODES = {
  stagingQuarantinePrefix: 'STAGING_QUARANTINE_PREFIX',
  pendingAttestation: 'PENDING_ATTESTATION',
  alphaValidatedPrivate: 'ALPHA_VALIDATED_PRIVATE',
  approvedPublic: 'APPROVED_PUBLIC',
  laneRedRejected: 'LANE_RED_REJECT',
  laneYellowPendingScan: 'LANE_YELLOW_PENDING_SCAN',
  laneYellowQuarantined: 'LANE_YELLOW_QUARANTINED',
  scannerErrorPendingScan: 'SCANNER_ERROR_PENDING_SCAN',
  scannerFlaggedQuarantined: 'SCANNER_FLAGGED_QUARANTINED',
  scannerBlockedRejected: 'SCANNER_BLOCKED_REJECT',
  moderatorQuarantined: 'MODERATOR_QUARANTINED',
  unknown: 'UNKNOWN',
} as const

export type MediaModerationReasonCode =
  (typeof MEDIA_MODERATION_REASON_CODES)[keyof typeof MEDIA_MODERATION_REASON_CODES]

export type MediaModerationDecision = {
  reasonCode: MediaModerationReasonCode
  reasonSummary: string
  /** True when upload_status is QUARANTINED or PENDING_SCAN (needs mod action). */
  blockedFromMemberSurfaces: boolean
  /** True when S3 key is under quarantine/ prefix (normal for all uploads). */
  usesQuarantineStoragePrefix: boolean
  /** True when scan passed but alpha privacy keeps auth-proxy serving. */
  alphaAuthProxyServing: boolean
  publishLane: MediaPublishLane | null
  uploadStatus: MediaUploadStatus | string
  scanStatus: ScanStatus | string
  storageState: string
  visibility: string | null
  sourceSurface: string | null
  scannerResults: Array<{
    name: string
    status: string
    summary: string
    labels: string[]
  }>
  infraOnlyMalwareFailure: boolean
}

function usesQuarantinePrefix(asset: Pick<MediaAsset, 'quarantineStorageKey' | 'storageKey'>): boolean {
  const key = asset.quarantineStorageKey ?? asset.storageKey ?? ''
  return key.startsWith('quarantine/')
}

function blockedUploadStatus(status: string): boolean {
  return (
    status === MEDIA_UPLOAD_STATUSES.quarantined ||
    status === MEDIA_UPLOAD_STATUSES.pendingScan ||
    status === MEDIA_UPLOAD_STATUSES.rejected ||
    status === MEDIA_UPLOAD_STATUSES.pendingAttestation
  )
}

function worstScannerResult(
  results: ScannerResultRecord[],
): ScannerResultRecord | undefined {
  return [...results].sort(
    (a, b) =>
      ({ BLOCKED: 4, ERROR: 3, FLAGGED: 2, PASSED: 0 }[b.status as ScannerResultStatus] ?? 0) -
      ({ BLOCKED: 4, ERROR: 3, FLAGGED: 2, PASSED: 0 }[a.status as ScannerResultStatus] ?? 0),
  )[0]
}

export function deriveMediaModerationDecision(input: {
  asset: MediaAsset
  publishLane?: MediaPublishLane | null
  scannerResults?: ScannerResultRecord[]
}): MediaModerationDecision {
  const { asset } = input
  const uploadStatus = asset.uploadStatus ?? MEDIA_UPLOAD_STATUSES.pendingAttestation
  const scanStatus = (asset.scanStatus ?? SCAN_STATUSES.notRequired) as ScanStatus
  const storageState = asset.storageState ?? MEDIA_STORAGE_STATES.quarantinedPrivate
  const visibility = asset.visibility ?? null
  const scannerResults = input.scannerResults ?? []
  const infraOnlyMalwareFailure = isInfraOnlyMalwareScannerFailure(scannerResults)
  const lane = input.publishLane ?? null
  const quarantinePrefix = usesQuarantinePrefix(asset)

  const scannerRows = scannerResults.map((r) => ({
    name: r.scannerName,
    status: r.status,
    summary: r.userFacingSummary,
    labels: r.labels ?? [],
  }))

  const base = {
    uploadStatus,
    scanStatus,
    storageState,
    visibility,
    sourceSurface: asset.sourceSurface ?? null,
    usesQuarantineStoragePrefix: quarantinePrefix,
    scannerResults: scannerRows,
    infraOnlyMalwareFailure,
    publishLane: lane,
  }

  if (uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation) {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.pendingAttestation,
      reasonSummary:
        'Upload staged in quarantine storage; attestation and scan not completed yet.',
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  if (uploadStatus === MEDIA_UPLOAD_STATUSES.rejected || lane === 'RED') {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.laneRedRejected,
      reasonSummary: 'Policy lane RED: upload rejected (attestation or content rating).',
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  const worst = worstScannerResult(scannerResults)
  if (worst?.status === 'BLOCKED') {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.scannerBlockedRejected,
      reasonSummary: worst.userFacingSummary ?? 'Scanner blocked this upload.',
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  if (
    scanStatus === SCAN_STATUSES.error &&
    uploadStatus === MEDIA_UPLOAD_STATUSES.pendingScan &&
    !infraOnlyMalwareFailure
  ) {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.scannerErrorPendingScan,
      reasonSummary:
        worst?.userFacingSummary ??
        'Scanner error (often ClamAV unavailable or bytes not loaded). Upload held for retry/review.',
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  if (
    uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined ||
    scanStatus === SCAN_STATUSES.flagged ||
    scanStatus === SCAN_STATUSES.failed
  ) {
    const yellowMulti =
      lane === 'YELLOW' && uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined
    return {
      ...base,
      reasonCode: yellowMulti
        ? MEDIA_MODERATION_REASON_CODES.laneYellowQuarantined
        : MEDIA_MODERATION_REASON_CODES.scannerFlaggedQuarantined,
      reasonSummary: yellowMulti
        ? 'YELLOW lane: multi-person explicit content requires moderator review before publish.'
        : (worst?.userFacingSummary ?? 'Scanner flagged content for moderator review.'),
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  if (uploadStatus === MEDIA_UPLOAD_STATUSES.pendingScan && lane === 'YELLOW') {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.laneYellowPendingScan,
      reasonSummary: 'YELLOW lane: upload pending scan or human review before publish.',
      blockedFromMemberSurfaces: true,
      alphaAuthProxyServing: false,
    }
  }

  if (
    uploadStatus === MEDIA_UPLOAD_STATUSES.autoApproved &&
    scanStatus === SCAN_STATUSES.passed &&
    storageState === MEDIA_STORAGE_STATES.validatedPrivate &&
    !visibilityAllowsAnonymousDirectUrl(visibility as Parameters<typeof visibilityAllowsAnonymousDirectUrl>[0])
  ) {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.alphaValidatedPrivate,
      reasonSummary:
        'Scan passed and upload approved. Alpha privacy: file stays in quarantine storage and is served only via signed-in auth proxy (not a moderation block).',
      blockedFromMemberSurfaces: false,
      alphaAuthProxyServing: true,
    }
  }

  if (
    storageState === MEDIA_STORAGE_STATES.approvedPublic ||
    (uploadStatus === MEDIA_UPLOAD_STATUSES.autoApproved && scanStatus === SCAN_STATUSES.passed)
  ) {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.approvedPublic,
      reasonSummary: 'Scan passed; media promoted to public storage with anonymous URL where visibility allows.',
      blockedFromMemberSurfaces: false,
      alphaAuthProxyServing: false,
    }
  }

  if (quarantinePrefix && storageState === MEDIA_STORAGE_STATES.quarantinedPrivate) {
    return {
      ...base,
      reasonCode: MEDIA_MODERATION_REASON_CODES.stagingQuarantinePrefix,
      reasonSummary:
        'File in quarantine storage prefix awaiting scan completion or promotion.',
      blockedFromMemberSurfaces: blockedUploadStatus(uploadStatus),
      alphaAuthProxyServing: false,
    }
  }

  return {
    ...base,
    reasonCode: MEDIA_MODERATION_REASON_CODES.unknown,
    reasonSummary: `Upload status ${uploadStatus}, scan ${scanStatus}, storage ${storageState}.`,
    blockedFromMemberSurfaces: blockedUploadStatus(uploadStatus),
    alphaAuthProxyServing: false,
  }
}

export function logMediaModerationDecision(
  event: 'media.upload_decision' | 'media.attestation_decision',
  input: {
    mediaAssetId: string
    userId: string
    mimeType?: string | null
    sizeBytes?: number | null
    sourceSurface?: string | null
    decision: MediaModerationDecision
  },
): void {
  const payload = {
    event,
    mediaId: input.mediaAssetId,
    userId: input.userId,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    uploadPurpose: input.sourceSurface ?? input.decision.sourceSurface,
    reasonCode: input.decision.reasonCode,
    reasonSummary: input.decision.reasonSummary,
    uploadStatus: input.decision.uploadStatus,
    scanStatus: input.decision.scanStatus,
    storageState: input.decision.storageState,
    visibility: input.decision.visibility,
    publishLane: input.decision.publishLane,
    blockedFromMemberSurfaces: input.decision.blockedFromMemberSurfaces,
    alphaAuthProxyServing: input.decision.alphaAuthProxyServing,
    usesQuarantineStoragePrefix: input.decision.usesQuarantineStoragePrefix,
    infraOnlyMalwareFailure: input.decision.infraOnlyMalwareFailure,
    scannerResults: input.decision.scannerResults.map((r) => ({
      scanner: r.name,
      status: r.status,
      summary: r.summary,
    })),
  }
  console.info(JSON.stringify(payload))
}

export async function buildMediaModerationDebugReport(mediaAssetId: string) {
  const rows = await loadScannerResultsForAsset(mediaAssetId)
  const latestByName = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    if (!latestByName.has(row.scannerName)) latestByName.set(row.scannerName, row)
  }
  const scannerRecords: ScannerResultRecord[] = [...latestByName.values()].map((row) => ({
    scannerName: row.scannerName as ScannerResultRecord['scannerName'],
    scannerVersion: row.scannerVersion,
    status: row.status as ScannerResultStatus,
    confidence: row.confidence,
    labels: (row.labels as string[]) ?? [],
    policyReason: row.policyReason,
    severity: row.severity,
    queue: row.queue,
    userFacingSummary: row.userFacingSummary,
    simulated: row.simulated,
  }))

  return {
    scannerSummary: await buildMediaScannerSummary(
      mediaAssetId,
      scannerRecords.length ? 'derived' : 'none',
    ),
    scannerRecords,
  }
}
