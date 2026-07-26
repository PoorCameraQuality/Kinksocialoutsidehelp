import {
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  type ModerationQueue,
  type PolicyReason,
  type PolicySeverity,
  type ScannerResultRecord,
} from '@c2k/shared'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { shouldSkipScannerModerationCase } from './profile-gallery-scan-policy.js'

export type MinorSafetyReviewStatus = 'none' | 'pending' | 'escalated' | 'cleared'

export type ScannerCaseMetadata = {
  minorSafetyReviewStatus?: MinorSafetyReviewStatus
  scannerSource?: 'media_pipeline'
  lastScannerEventAt?: string
}

const SCANNER_STATUS_RANK = { PASSED: 0, FLAGGED: 1, ERROR: 2, BLOCKED: 3 } as const

function worstScannerResult(results: ScannerResultRecord[]): ScannerResultRecord | null {
  if (!results.length) return null
  return [...results].sort(
    (a, b) => (SCANNER_STATUS_RANK[b.status] ?? 0) - (SCANNER_STATUS_RANK[a.status] ?? 0)
  )[0]!
}

function mapScannerToCaseFields(result: ScannerResultRecord): {
  policyReason: PolicyReason
  severity: PolicySeverity
  queue: ModerationQueue
  minorSafetyReviewStatus: MinorSafetyReviewStatus
} {
  const policyReason = result.policyReason ?? POLICY_REASONS.consentSafety
  const severity = result.severity ?? POLICY_SEVERITIES.medium
  const queue = result.queue ?? MODERATION_QUEUES.mediaReview
  const minorSafetyReviewStatus: MinorSafetyReviewStatus =
    queue === MODERATION_QUEUES.minorSafetyRestricted ||
    result.labels?.includes('ocr_critical') ||
    result.labels?.includes('ocr_minor_coded')
      ? 'pending'
      : 'none'
  return { policyReason, severity, queue, minorSafetyReviewStatus }
}

async function findOpenMediaAssetCase(mediaAssetId: string) {
  const [row] = await db
    .select()
    .from(schema.moderationCases)
    .where(
      and(
        eq(schema.moderationCases.targetContentType, 'media_asset'),
        eq(schema.moderationCases.targetContentId, mediaAssetId),
        eq(schema.moderationCases.status, MODERATION_CASE_STATUSES.open)
      )
    )
    .limit(1)
  return row ?? null
}

/** One open scanner/moderation case per media asset - append events on new flags. */
export async function upsertScannerModerationCase(params: {
  mediaAssetId: string
  uploaderUserId: string
  scannerResults: ScannerResultRecord[]
  actorUserId?: string | null
}): Promise<string | null> {
  if (shouldSkipScannerModerationCase(params.scannerResults)) return null

  const worst = worstScannerResult(params.scannerResults)
  if (!worst || worst.status === 'PASSED') return null

  const { policyReason, severity, queue, minorSafetyReviewStatus } = mapScannerToCaseFields(worst)
  const existing = await findOpenMediaAssetCase(params.mediaAssetId)
  const now = new Date().toISOString()
  const caseMetadata: ScannerCaseMetadata = {
    minorSafetyReviewStatus,
    scannerSource: 'media_pipeline',
    lastScannerEventAt: now,
  }

  if (existing) {
    await db.insert(schema.moderationEvents).values({
      caseId: existing.id,
      actorUserId: params.actorUserId ?? params.uploaderUserId,
      eventType: 'media.scanner_flag_appended',
      payload: {
        mediaAssetId: params.mediaAssetId,
        scanner: worst.scannerName,
        status: worst.status,
        labels: worst.labels,
        policyReason,
        severity,
        queue,
        caseMetadata,
      },
    })
    return existing.id
  }

  const [caseRow] = await db
    .insert(schema.moderationCases)
    .values({
      targetContentType: 'media_asset',
      targetContentId: params.mediaAssetId,
      targetUserId: params.uploaderUserId,
      policyReason,
      severity,
      queue,
      status: MODERATION_CASE_STATUSES.open,
    })
    .returning({ id: schema.moderationCases.id })

  const caseId = caseRow!.id
  await db.insert(schema.moderationQueueItems).values({
    caseId,
    queue,
    severity,
    status: 'OPEN',
  })
  await db.insert(schema.moderationEvents).values({
    caseId,
    actorUserId: params.actorUserId ?? params.uploaderUserId,
    eventType: 'media.scanner_case_opened',
    payload: {
      mediaAssetId: params.mediaAssetId,
      scanner: worst.scannerName,
      status: worst.status,
      labels: worst.labels,
      caseMetadata,
    },
  })
  return caseId
}
