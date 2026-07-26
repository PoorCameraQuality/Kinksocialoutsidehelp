import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type PresenterScheduleCredit = {
  scheduleSlotId: string
  conventionId: string
  conventionSlug: string
  conventionName: string
  slotTitle: string
  startsAt: string | null
  endsAt: string | null
  source: 'schedule_slot_presenters'
}

type LoadScheduleCreditsOptions = {
  /** When true, only slots that have not ended yet (upcoming program preview). */
  upcomingOnly?: boolean
}

/** Auto credits from program assignments - source of truth per strategic guidance §7. */
export async function loadPresenterScheduleCredits(
  presenterUserId: string,
  limit = 60,
  options?: LoadScheduleCreditsOptions,
): Promise<PresenterScheduleCredit[]> {
  const now = new Date()
  const upcomingClause =
    options?.upcomingOnly ?
      and(isNotNull(schema.scheduleSlots.endsAt), gte(schema.scheduleSlots.endsAt, now))
    : undefined

  const rows = await db
    .select({
      scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
      conventionId: schema.conventions.id,
      conventionSlug: schema.conventions.slug,
      conventionName: schema.conventions.name,
      slotTitle: schema.scheduleSlots.title,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
    })
    .from(schema.scheduleSlotPresenters)
    .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotPresenters.scheduleSlotId))
    .innerJoin(schema.conventions, eq(schema.conventions.id, schema.scheduleSlots.conventionId))
    .where(
      and(
        eq(schema.scheduleSlotPresenters.userId, presenterUserId),
        isNotNull(schema.scheduleSlots.conventionId),
        upcomingClause,
      ),
    )
    .orderBy(desc(schema.scheduleSlots.startsAt))
    .limit(limit)

  return rows.map((r) => ({
    scheduleSlotId: r.scheduleSlotId,
    conventionId: r.conventionId,
    conventionSlug: r.conventionSlug,
    conventionName: r.conventionName,
    slotTitle: r.slotTitle,
    startsAt: r.startsAt?.toISOString() ?? null,
    endsAt: r.endsAt?.toISOString() ?? null,
    source: 'schedule_slot_presenters' as const,
  }))
}
