import {
  MEDIA_HASH_KINDS,
  MEDIA_HASH_LIST_ACTIONS,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
  SCANNER_VERSIONS,
  mediaScanSimulationEnabled,
  queueForPolicyReason,
  severityForPolicyReason,
} from '@c2k/shared'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import type { MediaScanAdapter, MediaScanAdapterResult, MediaScanContext } from './types.js'

export async function lookupActiveHashListEntry(sha256Hash: string | null) {
  if (!sha256Hash) return null
  const [row] = await db
    .select()
    .from(schema.mediaHashListEntries)
    .where(
      and(
        eq(schema.mediaHashListEntries.hashKind, MEDIA_HASH_KINDS.sha256),
        eq(schema.mediaHashListEntries.hashValue, sha256Hash),
        eq(schema.mediaHashListEntries.active, true),
        or(
          isNull(schema.mediaHashListEntries.expiresAt),
          gt(schema.mediaHashListEntries.expiresAt, new Date())
        )
      )
    )
    .limit(1)
  return row ?? null
}

export class ExactHashListScanner implements MediaScanAdapter {
  readonly name = SCANNER_NAMES.exactHash
  readonly version = SCANNER_VERSIONS[SCANNER_NAMES.exactHash]

  async scan(context: MediaScanContext): Promise<MediaScanAdapterResult> {
    // PR 3 (M9): simulate hooks are dead under production/staging.
    const simulate = mediaScanSimulationEnabled()
      ? process.env.MEDIA_SCAN_SIMULATE_HASH?.toUpperCase()
      : undefined
    if (simulate === 'DENY') {
      return {
        status: SCANNER_RESULT_STATUSES.blocked,
        labels: ['internal_denylist'],
        policyReason: POLICY_REASONS.ncii,
        severity: POLICY_SEVERITIES.critical,
        queue: MODERATION_QUEUES.nciiUrgent,
        userFacingSummary: 'Simulated internal hash denylist match.',
        simulated: true,
        rawResultPrivate: { simulate: 'DENY' },
      }
    }
    if (simulate === 'REVIEW') {
      return {
        status: SCANNER_RESULT_STATUSES.flagged,
        labels: ['internal_reviewlist'],
        policyReason: POLICY_REASONS.consentSafety,
        severity: POLICY_SEVERITIES.medium,
        queue: MODERATION_QUEUES.mediaReview,
        userFacingSummary: 'Simulated internal hash review-list match.',
        simulated: true,
        rawResultPrivate: { simulate: 'REVIEW' },
      }
    }

    const entry = await lookupActiveHashListEntry(context.sha256Hash)
    if (!entry) {
      return {
        status: SCANNER_RESULT_STATUSES.passed,
        labels: [],
        userFacingSummary: 'No internal hash list match.',
        rawResultPrivate: {},
      }
    }

    const severity = severityForPolicyReason(entry.policyReason)
    const queue = queueForPolicyReason(entry.policyReason)
    const blocked = entry.listAction === MEDIA_HASH_LIST_ACTIONS.deny

    return {
      status: blocked ? SCANNER_RESULT_STATUSES.blocked : SCANNER_RESULT_STATUSES.flagged,
      labels: [entry.listAction.toLowerCase(), entry.source],
      policyReason: entry.policyReason,
      severity,
      queue,
      userFacingSummary: blocked
        ? 'Matched internal hash denylist (previously removed content).'
        : 'Matched internal hash review list. Human review required.',
      matchedHashEntryId: entry.id,
      rawResultPrivate: {
        hashKind: entry.hashKind,
        listAction: entry.listAction,
        source: entry.source,
      },
    }
  }
}
