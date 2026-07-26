import { SCAN_STATUSES, type ScanStatus, type ScannerResultRecord } from '@c2k/shared'
import type { MediaAsset } from '../db/schema.js'
import { runMediaScanOrchestration } from './media-scan/orchestrator.js'

export type MediaScannerKind =
  | 'hash'
  | 'image_moderation'
  | 'ocr'
  | 'malware'
  | 'perceptual_hash'

export type MediaScannerInput = {
  mediaAssetId: string
  sha256Hash: string | null
  mimeType: string
  quarantineStorageKey: string | null
  contentRating?: string | null
  visibility?: string | null
  originalFilename?: string | null
}

export type MediaScannerResult = {
  status: ScanStatus
  detail?: string
  simulated?: boolean
  scannerSummary?: ScannerResultRecord[]
}

/** Adapter hook for vendor scanners (T&S-4A composite orchestrator). */
export interface MediaScannerAdapter {
  readonly kind: MediaScannerKind
  scan(input: MediaScannerInput): Promise<MediaScannerResult>
}

/** Runs all T&S-4A open-source scanner adapters and persists results. */
export class CompositeMediaScanner implements MediaScannerAdapter {
  readonly kind: MediaScannerKind = 'hash'

  async scan(input: MediaScannerInput): Promise<MediaScannerResult> {
    const asset = {
      id: input.mediaAssetId,
      sha256Hash: input.sha256Hash,
      mimeType: input.mimeType,
      quarantineStorageKey: input.quarantineStorageKey,
      contentRating: input.contentRating ?? null,
      visibility: input.visibility ?? null,
      originalFilename: input.originalFilename ?? null,
    } as MediaAsset

    const outcome = await runMediaScanOrchestration(asset)
    return {
      status: outcome.aggregateStatus,
      detail: outcome.quarantineReason ?? 'scan_complete',
      simulated: outcome.results.some((r) => r.simulated),
      scannerSummary: outcome.results,
    }
  }
}

export const defaultMediaScanner: MediaScannerAdapter = new CompositeMediaScanner()

/** @deprecated T&S-3 noop - use CompositeMediaScanner. Kept for unit tests. */
export class NoopMediaScanner implements MediaScannerAdapter {
  readonly kind: MediaScannerKind = 'hash'

  async scan(_input: MediaScannerInput): Promise<MediaScannerResult> {
    const simulate = process.env.MEDIA_SCAN_SIMULATE?.toUpperCase()
    if (simulate === 'FLAGGED') {
      return { status: SCAN_STATUSES.flagged, detail: 'simulated_flag', simulated: true }
    }
    if (simulate === 'ERROR') {
      return { status: SCAN_STATUSES.error, detail: 'simulated_error', simulated: true }
    }
    if (simulate === 'FAILED') {
      return { status: SCAN_STATUSES.failed, detail: 'simulated_failed', simulated: true }
    }
    return { status: SCAN_STATUSES.passed, detail: 'noop_pass', simulated: true }
  }
}

export async function runMediaScanWithOrchestration(asset: MediaAsset) {
  return runMediaScanOrchestration(asset)
}
