import { SCOPED_STANDINGS, type ScopedStanding } from '@c2k/shared'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const RETALIATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/**
 * When a scoped ban/timeout follows a user report or appeal, emit a private platform review signal.
 * Does not auto-punish organizers - creates trust_signal_event for mod queue.
 */
export async function maybeEmitRetaliationReviewSignal(input: {
  userId: string
  scopeType: string
  scopeId: string
  standingAfter: ScopedStanding
  createdBy: string
  reasonCategory: string
}): Promise<void> {
  if (
    input.standingAfter !== SCOPED_STANDINGS.banned &&
    input.standingAfter !== SCOPED_STANDINGS.timedOut
  ) {
    return
  }

  const windowStart = new Date(Date.now() - RETALIATION_WINDOW_MS)
  let suspicious = false
  const metadata: Record<string, unknown> = {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    reasonCategory: input.reasonCategory,
  }

  const [recentReport] = await db
    .select({ id: schema.moderationReports.id })
    .from(schema.moderationReports)
    .where(
      and(
        eq(schema.moderationReports.reporterId, input.userId),
        gte(schema.moderationReports.createdAt, windowStart)
      )
    )
    .orderBy(desc(schema.moderationReports.createdAt))
    .limit(1)

  if (recentReport) {
    suspicious = true
    metadata.trigger = 'report_before_ban'
  }

  const [recentAppeal] = await db
    .select({ id: schema.scopedModerationAppeals.id })
    .from(schema.scopedModerationAppeals)
    .where(
      and(
        eq(schema.scopedModerationAppeals.userId, input.userId),
        eq(schema.scopedModerationAppeals.scopeType, input.scopeType as 'organization' | 'group' | 'event' | 'convention'),
        eq(schema.scopedModerationAppeals.scopeId, input.scopeId),
        gte(schema.scopedModerationAppeals.createdAt, windowStart)
      )
    )
    .orderBy(desc(schema.scopedModerationAppeals.createdAt))
    .limit(1)

  if (recentAppeal) {
    suspicious = true
    metadata.trigger = metadata.trigger ? 'report_and_appeal' : 'appeal_before_ban'
  }

  const [modActionVolume] = await db
    .select({ c: count() })
    .from(schema.scopedStandingEvents)
    .where(
      and(
        eq(schema.scopedStandingEvents.createdBy, input.createdBy),
        eq(schema.scopedStandingEvents.scopeType, input.scopeType as 'organization' | 'group' | 'event' | 'convention'),
        eq(schema.scopedStandingEvents.scopeId, input.scopeId),
        gte(schema.scopedStandingEvents.createdAt, windowStart)
      )
    )

  if ((modActionVolume?.c ?? 0) >= 8) {
    suspicious = true
    metadata.trigger = metadata.trigger ?? 'high_mod_action_volume'
    metadata.modActionCount = modActionVolume?.c
  }

  if (!suspicious) return

  await db.insert(schema.trustSignalEvents).values({
    userId: input.createdBy,
    scopeType: input.scopeType as 'organization' | 'group' | 'event' | 'convention',
    scopeId: input.scopeId,
    signalType: 'ORGANIZER_RETALIATION_REVIEW_RECOMMENDED',
    sourceType: 'scoped_standing_action',
    severity: 'MEDIUM',
    confidence: 0.35,
    visibility: 'PLATFORM_MOD',
    status: 'ACTIVE',
    metadata: {
      ...metadata,
      affectedUserId: input.userId,
    },
  })
}
