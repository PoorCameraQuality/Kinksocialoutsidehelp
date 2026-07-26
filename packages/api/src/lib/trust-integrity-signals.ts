import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type ReputationIntegritySignal = {
  id: string
  signalType: string
  sourceType: string
  sourceId: string | null
  visibility: string
  status: string
  modReviewStatus: string
  severity: string | null
  scopeType: string | null
  scopeId: string | null
  createdAt: string
  expiresAt: string | null
  metadata: Record<string, unknown>
  label: string
}

const SIGNAL_LABELS: Record<string, string> = {
  RATING_SPIKE_REVIEW_RECOMMENDED: 'Rating spike after recent reports',
  REVIEW_TEXT_BURST_REVIEW_RECOMMENDED: 'Identical review text burst',
  RECIPROCAL_REVIEW_PATTERN: 'Reciprocal review pattern',
  ORGANIZER_RETALIATION_REVIEW_RECOMMENDED: 'Possible organizer retaliation',
}

export function signalLabel(signalType: string): string {
  return SIGNAL_LABELS[signalType] ?? signalType.replace(/_/g, ' ').toLowerCase()
}

export async function loadReputationIntegritySignals(
  userId: string,
  opts: { viewerIsSiteAdmin: boolean }
): Promise<ReputationIntegritySignal[]> {
  const visibilityFilter = opts.viewerIsSiteAdmin ?
    inArray(schema.trustSignalEvents.visibility, ['PLATFORM_MOD', 'SCOPED_MOD', 'SITE_ADMIN_ONLY'])
  : inArray(schema.trustSignalEvents.visibility, ['PLATFORM_MOD', 'SCOPED_MOD'])

  const rows = await db
    .select()
    .from(schema.trustSignalEvents)
    .where(
      and(
        eq(schema.trustSignalEvents.userId, userId),
        eq(schema.trustSignalEvents.status, 'ACTIVE'),
        visibilityFilter
      )
    )
    .orderBy(desc(schema.trustSignalEvents.createdAt))
    .limit(25)

  return rows.map((r) => {
    const meta =
      typeof r.metadata === 'object' && r.metadata ? (r.metadata as Record<string, unknown>) : {}
    const modReviewStatus =
      typeof meta.modReviewStatus === 'string' ? meta.modReviewStatus : 'OPEN'
    return {
      id: r.id,
      signalType: r.signalType,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      visibility: r.visibility,
      status: r.status,
      modReviewStatus,
      severity: r.severity,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      metadata: meta,
      label: signalLabel(r.signalType),
    }
  })
}

export async function updateTrustSignalModReview(
  signalId: string,
  modReviewStatus: 'REVIEWED' | 'DISMISSED' | 'ESCALATED',
  reviewerUserId: string
): Promise<boolean> {
  const [row] = await db
    .select({ metadata: schema.trustSignalEvents.metadata })
    .from(schema.trustSignalEvents)
    .where(eq(schema.trustSignalEvents.id, signalId))
    .limit(1)
  if (!row) return false

  const meta =
    typeof row.metadata === 'object' && row.metadata ? { ...(row.metadata as Record<string, unknown>) } : {}
  meta.modReviewStatus = modReviewStatus
  meta.reviewedByUserId = reviewerUserId
  meta.reviewedAt = new Date().toISOString()

  await db
    .update(schema.trustSignalEvents)
    .set({
      metadata: meta,
      reviewedBy: reviewerUserId,
      updatedAt: new Date(),
      ...(modReviewStatus === 'DISMISSED' ? { status: 'OVERTURNED' as const } : {}),
    })
    .where(eq(schema.trustSignalEvents.id, signalId))
  return true
}
