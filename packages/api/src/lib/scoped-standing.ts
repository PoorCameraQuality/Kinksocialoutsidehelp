import { SCOPED_STANDINGS, type ScopedStanding, type TrustScopeType } from '@c2k/shared'
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type ScopedStandingView = {
  userId: string
  scopeType: TrustScopeType
  scopeId: string
  standing: ScopedStanding
  activeBan: boolean
  expiresAt: string | null
  recentEvents: Array<{
    standingBefore: ScopedStanding
    standingAfter: ScopedStanding
    reasonCategory: string
    createdAt: string
    expiresAt: string | null
  }>
}

export async function getCurrentScopedStanding(
  userId: string,
  scopeType: TrustScopeType,
  scopeId: string
): Promise<ScopedStanding> {
  const [rollup] = await db
    .select({ scopedStanding: schema.trustSignalRollups.scopedStanding })
    .from(schema.trustSignalRollups)
    .where(
      and(
        eq(schema.trustSignalRollups.userId, userId),
        eq(schema.trustSignalRollups.scopeType, scopeType),
        eq(schema.trustSignalRollups.scopeId, scopeId)
      )
    )
    .limit(1)

  if (rollup?.scopedStanding) return rollup.scopedStanding as ScopedStanding

  const [ban] = await db
    .select({ id: schema.scopeBans.id })
    .from(schema.scopeBans)
    .where(
      and(
        eq(schema.scopeBans.userId, userId),
        eq(schema.scopeBans.scopeType, scopeType as 'organization' | 'group'),
        eq(schema.scopeBans.scopeId, scopeId),
        eq(schema.scopeBans.active, true),
        or(isNull(schema.scopeBans.expiresAt), gt(schema.scopeBans.expiresAt, new Date()))
      )
    )
    .limit(1)

  if (ban) return SCOPED_STANDINGS.banned

  const [lastEvent] = await db
    .select({ standingAfter: schema.scopedStandingEvents.standingAfter })
    .from(schema.scopedStandingEvents)
    .where(
      and(
        eq(schema.scopedStandingEvents.userId, userId),
        eq(schema.scopedStandingEvents.scopeType, scopeType),
        eq(schema.scopedStandingEvents.scopeId, scopeId)
      )
    )
    .orderBy(desc(schema.scopedStandingEvents.createdAt))
    .limit(1)

  return (lastEvent?.standingAfter as ScopedStanding) ?? SCOPED_STANDINGS.goodStanding
}

export async function setScopedStanding(input: {
  userId: string
  scopeType: TrustScopeType
  scopeId: string
  standingAfter: ScopedStanding
  reasonCategory: string
  createdBy: string
  sourceType: string
  sourceId?: string
  expiresAt?: Date | null
}): Promise<ScopedStandingView> {
  const standingBefore = await getCurrentScopedStanding(input.userId, input.scopeType, input.scopeId)

  await db.insert(schema.scopedStandingEvents).values({
    userId: input.userId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    standingBefore,
    standingAfter: input.standingAfter,
    reasonCategory: input.reasonCategory,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    createdBy: input.createdBy,
    expiresAt: input.expiresAt ?? null,
  })

  const existing = await db
    .select({ id: schema.trustSignalRollups.id })
    .from(schema.trustSignalRollups)
    .where(
      and(
        eq(schema.trustSignalRollups.userId, input.userId),
        eq(schema.trustSignalRollups.scopeType, input.scopeType),
        eq(schema.trustSignalRollups.scopeId, input.scopeId)
      )
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(schema.trustSignalRollups)
      .set({
        scopedStanding: input.standingAfter,
        lastRecomputedAt: new Date(),
      })
      .where(eq(schema.trustSignalRollups.id, existing[0].id))
  } else {
    await db.insert(schema.trustSignalRollups).values({
      userId: input.userId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      scopedStanding: input.standingAfter,
    })
  }

  if (input.standingAfter === SCOPED_STANDINGS.banned || input.standingAfter === SCOPED_STANDINGS.timedOut) {
    if (input.scopeType === 'organization' || input.scopeType === 'group') {
      await db.insert(schema.scopeBans).values({
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        userId: input.userId,
        reason: input.reasonCategory,
        bannedByUserId: input.createdBy,
        active: true,
        expiresAt: input.expiresAt ?? null,
      })
    }
  }

  if (input.standingAfter === SCOPED_STANDINGS.goodStanding) {
    if (input.scopeType === 'organization' || input.scopeType === 'group') {
      await db
        .update(schema.scopeBans)
        .set({ active: false })
        .where(
          and(
            eq(schema.scopeBans.userId, input.userId),
            eq(schema.scopeBans.scopeType, input.scopeType),
            eq(schema.scopeBans.scopeId, input.scopeId),
            eq(schema.scopeBans.active, true)
          )
        )
    }
  }

  const { maybeEmitRetaliationReviewSignal } = await import('./scoped-retaliation.js')
  await maybeEmitRetaliationReviewSignal({
    userId: input.userId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    standingAfter: input.standingAfter,
    createdBy: input.createdBy,
    reasonCategory: input.reasonCategory,
  })

  return getScopedStandingView(input.userId, input.scopeType, input.scopeId)
}

export async function getScopedStandingView(
  userId: string,
  scopeType: TrustScopeType,
  scopeId: string
): Promise<ScopedStandingView> {
  const standing = await getCurrentScopedStanding(userId, scopeType, scopeId)

  const banQuery =
    scopeType === 'organization' || scopeType === 'group'
      ? db
          .select({ expiresAt: schema.scopeBans.expiresAt })
          .from(schema.scopeBans)
          .where(
            and(
              eq(schema.scopeBans.userId, userId),
              eq(schema.scopeBans.scopeType, scopeType),
              eq(schema.scopeBans.scopeId, scopeId),
              eq(schema.scopeBans.active, true),
              or(isNull(schema.scopeBans.expiresAt), gt(schema.scopeBans.expiresAt, new Date()))
            )
          )
          .limit(1)
      : Promise.resolve([])

  const [banRow, events] = await Promise.all([
    banQuery,
    db
      .select({
        standingBefore: schema.scopedStandingEvents.standingBefore,
        standingAfter: schema.scopedStandingEvents.standingAfter,
        reasonCategory: schema.scopedStandingEvents.reasonCategory,
        createdAt: schema.scopedStandingEvents.createdAt,
        expiresAt: schema.scopedStandingEvents.expiresAt,
      })
      .from(schema.scopedStandingEvents)
      .where(
        and(
          eq(schema.scopedStandingEvents.userId, userId),
          eq(schema.scopedStandingEvents.scopeType, scopeType),
          eq(schema.scopedStandingEvents.scopeId, scopeId)
        )
      )
      .orderBy(desc(schema.scopedStandingEvents.createdAt))
      .limit(10),
  ])

  return {
    userId,
    scopeType,
    scopeId,
    standing,
    activeBan: Boolean(banRow[0]),
    expiresAt: banRow[0]?.expiresAt?.toISOString() ?? null,
    recentEvents: events.map((e) => ({
      standingBefore: e.standingBefore as ScopedStanding,
      standingAfter: e.standingAfter as ScopedStanding,
      reasonCategory: e.reasonCategory,
      createdAt: e.createdAt.toISOString(),
      expiresAt: e.expiresAt?.toISOString() ?? null,
    })),
  }
}
