import type { MediaContentRating } from '@c2k/shared'

export type MediaScanContext = {
  mediaAssetId: string
  sha256Hash: string | null
  mimeType: string
  quarantineStorageKey: string | null
  contentRating: MediaContentRating | null
  visibility: string | null
  originalFilename: string | null
  sourceSurface: string | null
  /** Optional bytes for malware/OCR - loaded by orchestrator when available. */
  buffer: Buffer | null
}

export type MediaScanAdapterResult = {
  status: import('@c2k/shared').ScannerResultStatus
  confidence?: number | null
  labels?: string[]
  policyReason?: import('@c2k/shared').PolicyReason | null
  severity?: import('@c2k/shared').PolicySeverity | null
  queue?: import('@c2k/shared').ModerationQueue | null
  userFacingSummary: string
  rawResultPrivate?: Record<string, unknown>
  simulated?: boolean
  matchedHashEntryId?: string | null
}

export interface MediaScanAdapter {
  readonly name: import('@c2k/shared').ScannerName
  readonly version: string
  scan(context: MediaScanContext): Promise<MediaScanAdapterResult>
}
