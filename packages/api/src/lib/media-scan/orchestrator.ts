import {
  SCANNER_NOOP_PASSED_LABEL,
  SCAN_STATUSES,
  aggregateScannerResults,
  mediaScanSimulationEnabled,
  scannerResultToScanStatus,
  type ScanStatus,
  type ScannerResultRecord,
  type ScannerResultStatus,
} from '@c2k/shared'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import type { MediaAsset } from '../../db/schema.js'
import { defaultScanAdapters } from './adapters.js'
import type { MediaScanAdapter, MediaScanContext } from './types.js'
import { getObjectBuffer, getS3Client } from '../s3-upload.js'
import { softenProfileGalleryScanAggregate } from '../profile-gallery-scan-policy.js'

async function loadQuarantineBytes(quarantineStorageKey: string | null): Promise<Buffer | null> {
  if (!quarantineStorageKey) return null
  const client = getS3Client()
  if (!client) return null
  const obj = await getObjectBuffer(client, quarantineStorageKey)
  return obj?.body ?? null
}

export type MediaScanRunOutcome = {
  aggregateStatus: ScanStatus
  aggregateScannerStatus: ScannerResultStatus
  results: ScannerResultRecord[]
  primaryPolicyReason: string | null
  quarantineReason: string | null
}

function applyLegacySimulateOverride(
  aggregateScannerStatus: ScannerResultStatus
): ScannerResultStatus {
  // PR 3 (M9): simulation is a no-op under production/staging.
  if (!mediaScanSimulationEnabled()) return aggregateScannerStatus
  const simulate = process.env.MEDIA_SCAN_SIMULATE?.toUpperCase()
  if (simulate === 'FLAGGED') return 'FLAGGED'
  if (simulate === 'ERROR') return 'ERROR'
  if (simulate === 'FAILED') return 'BLOCKED'
  return aggregateScannerStatus
}

async function persistScannerResult(
  mediaAssetId: string,
  adapter: MediaScanAdapter,
  result: Awaited<ReturnType<MediaScanAdapter['scan']>>
): Promise<void> {
  await db.insert(schema.mediaScannerResults).values({
    mediaAssetId,
    scannerName: adapter.name,
    scannerVersion: adapter.version,
    status: result.status,
    confidence: result.confidence ?? null,
    labels: result.labels ?? [],
    policyReason: result.policyReason ?? null,
    severity: result.severity ?? null,
    queue: result.queue ?? null,
    userFacingSummary: result.userFacingSummary,
    rawResultPrivate: result.rawResultPrivate ?? {},
    simulated: result.simulated ?? false,
    matchedHashEntryId: result.matchedHashEntryId ?? null,
  })
}

function buildScanContext(asset: MediaAsset, buffer: Buffer | null): MediaScanContext {
  return {
    mediaAssetId: asset.id,
    sha256Hash: asset.sha256Hash,
    mimeType: asset.mimeType,
    quarantineStorageKey: asset.quarantineStorageKey,
    contentRating: (asset.contentRating as MediaScanContext['contentRating']) ?? null,
    visibility: asset.visibility,
    originalFilename: asset.originalFilename,
    sourceSurface: asset.sourceSurface ?? null,
    buffer,
  }
}

export async function runMediaScanOrchestration(
  asset: MediaAsset,
  adapters: MediaScanAdapter[] = defaultScanAdapters
): Promise<MediaScanRunOutcome> {
  // Reload from DB so scan policy sees attestation fields (contentRating, sourceSurface).
  const [dbAsset] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, asset.id))
    .limit(1)
  const scanAsset = dbAsset ?? asset

  const buffer = await loadQuarantineBytes(scanAsset.quarantineStorageKey)
  const context = buildScanContext(scanAsset, buffer)
  const records: ScannerResultRecord[] = []

  for (const adapter of adapters) {
    const result = await adapter.scan(context)
    await persistScannerResult(asset.id, adapter, result)
    records.push({
      scannerName: adapter.name,
      scannerVersion: adapter.version,
      status: result.status,
      confidence: result.confidence ?? null,
      labels: result.labels ?? [],
      policyReason: result.policyReason ?? null,
      severity: result.severity ?? null,
      queue: result.queue ?? null,
      userFacingSummary: result.userFacingSummary,
      simulated: result.simulated ?? false,
    })
  }

  let aggregateScannerStatus = aggregateScannerResults(records)
  aggregateScannerStatus = applyLegacySimulateOverride(aggregateScannerStatus)
  aggregateScannerStatus = softenProfileGalleryScanAggregate({
    sourceSurface: scanAsset.sourceSurface,
    contentRating: scanAsset.contentRating,
    aggregateScannerStatus,
    scannerResults: records,
  })
  const aggregateStatus = scannerResultToScanStatus(aggregateScannerStatus)

  const worst = [...records].sort(
    (a, b) =>
      ({ BLOCKED: 3, ERROR: 2, FLAGGED: 1, PASSED: 0 }[b.status] ?? 0) -
      ({ BLOCKED: 3, ERROR: 2, FLAGGED: 1, PASSED: 0 }[a.status] ?? 0)
  )[0]

  const quarantineReason =
    aggregateScannerStatus === 'PASSED'
      ? null
      : (worst?.userFacingSummary ?? 'Scanner signal requires review.')

  return {
    aggregateStatus,
    aggregateScannerStatus,
    results: records,
    primaryPolicyReason: worst?.policyReason ?? null,
    quarantineReason,
  }
}

export async function loadScannerResultsForAsset(mediaAssetId: string) {
  return db
    .select()
    .from(schema.mediaScannerResults)
    .where(eq(schema.mediaScannerResults.mediaAssetId, mediaAssetId))
    .orderBy(desc(schema.mediaScannerResults.createdAt))
    .limit(20)
}

export type MediaScannerSummary = {
  finalScanStatus: string
  scanners: Array<{
    name: string
    status: string
    summary: string
    labels: string[]
    simulated: boolean
  }>
  quarantineReason: string | null
}

export async function buildMediaScannerSummary(
  mediaAssetId: string,
  finalScanStatus: string
): Promise<MediaScannerSummary> {
  const rows = await loadScannerResultsForAsset(mediaAssetId)
  const latestByName = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    if (!latestByName.has(row.scannerName)) latestByName.set(row.scannerName, row)
  }

  const scanners = [...latestByName.values()].map((row) => {
    const labels = (row.labels as string[]) ?? []
    const noopPassed = labels.includes(SCANNER_NOOP_PASSED_LABEL)
    return {
      name: row.scannerName,
      status: noopPassed && row.status === 'PASSED' ? 'NOOP_PASSED' : row.status,
      summary: row.userFacingSummary,
      labels,
      simulated: row.simulated,
    }
  })

  const worst = scanners.find((s) => s.status !== 'PASSED')
  return {
    finalScanStatus,
    scanners,
    quarantineReason: worst?.summary ?? null,
  }
}

export function scanStatusBlocksPublish(status: ScanStatus): boolean {
  return (
    status === SCAN_STATUSES.error ||
    status === SCAN_STATUSES.flagged ||
    status === SCAN_STATUSES.failed
  )
}
