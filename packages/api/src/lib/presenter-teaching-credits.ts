import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type PresenterTeachingCreditRow = {
  id: string
  title: string
  eventName: string
  eventDate: string | null
  detailUrl: string | null
  verified: boolean
  scheduleSlotId: string | null
  conventionSlug: string | null
  createdAt: Date
}

/** Format slot start as YYYY-MM-DD for `event_date`. */
export function formatTeachingCreditEventDate(startsAt: Date | null | undefined): string | undefined {
  if (!startsAt) return undefined
  return startsAt.toISOString().slice(0, 10)
}

export function conventionProgramDetailUrl(conventionSlug: string): string {
  return `/conventions/${encodeURIComponent(conventionSlug)}?tab=Schedule`
}

export async function loadPresenterTeachingCredits(
  presenterUserId: string,
): Promise<PresenterTeachingCreditRow[]> {
  const rows = await db
    .select({
      id: schema.presenterTeachingCredits.id,
      title: schema.presenterTeachingCredits.title,
      eventName: schema.presenterTeachingCredits.eventName,
      eventDate: schema.presenterTeachingCredits.eventDate,
      detailUrl: schema.presenterTeachingCredits.detailUrl,
      verified: schema.presenterTeachingCredits.verified,
      scheduleSlotId: schema.presenterTeachingCredits.scheduleSlotId,
      conventionSlug: schema.conventions.slug,
      createdAt: schema.presenterTeachingCredits.createdAt,
    })
    .from(schema.presenterTeachingCredits)
    .leftJoin(
      schema.scheduleSlots,
      eq(schema.scheduleSlots.id, schema.presenterTeachingCredits.scheduleSlotId),
    )
    .leftJoin(schema.conventions, eq(schema.conventions.id, schema.scheduleSlots.conventionId))
    .where(eq(schema.presenterTeachingCredits.presenterUserId, presenterUserId))
    .orderBy(
      desc(schema.presenterTeachingCredits.eventDate),
      desc(schema.presenterTeachingCredits.createdAt),
    )

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    eventName: r.eventName,
    eventDate: r.eventDate,
    detailUrl: r.detailUrl,
    verified: r.verified,
    scheduleSlotId: r.scheduleSlotId,
    conventionSlug: r.conventionSlug,
    createdAt: r.createdAt,
  }))
}

export type VerifiedTeachingCreditInsert = {
  presenterUserId: string
  title: string
  eventName: string
  eventDate: string | undefined
  detailUrl: string
  scheduleSlotId: string
}

/** Build row values for a ended schedule assignment (pure - unit tested). */
export function buildVerifiedTeachingCreditInsert(input: {
  presenterUserId: string
  slotTitle: string
  conventionName: string
  conventionSlug: string
  scheduleSlotId: string
  startsAt: Date | null
}): VerifiedTeachingCreditInsert {
  return {
    presenterUserId: input.presenterUserId,
    title: input.slotTitle,
    eventName: input.conventionName,
    eventDate: formatTeachingCreditEventDate(input.startsAt),
    detailUrl: conventionProgramDetailUrl(input.conventionSlug),
    scheduleSlotId: input.scheduleSlotId,
  }
}
