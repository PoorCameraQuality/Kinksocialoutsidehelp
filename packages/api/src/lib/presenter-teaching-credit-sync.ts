import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  buildVerifiedTeachingCreditInsert,
  type VerifiedTeachingCreditInsert,
} from './presenter-teaching-credits.js'

export type PresenterTeachingCreditSyncResult = {
  inserted: number
  skipped: number
}

async function insertVerifiedCredit(values: VerifiedTeachingCreditInsert): Promise<boolean> {
  const rows = await db
    .insert(schema.presenterTeachingCredits)
    .values({
      presenterUserId: values.presenterUserId,
      title: values.title,
      eventName: values.eventName,
      eventDate: values.eventDate,
      detailUrl: values.detailUrl,
      scheduleSlotId: values.scheduleSlotId,
      verified: true,
    })
    .onConflictDoNothing({
      target: [
        schema.presenterTeachingCredits.presenterUserId,
        schema.presenterTeachingCredits.scheduleSlotId,
      ],
    })
    .returning({ id: schema.presenterTeachingCredits.id })
  return rows.length > 0
}

/**
 * Upsert verified teaching credits for program assignments whose slots have ended.
 * Idempotent via partial unique index on (presenter_user_id, schedule_slot_id).
 */
export async function runPresenterTeachingCreditSync(): Promise<PresenterTeachingCreditSyncResult> {
  const now = new Date()
  const pending = await db
    .select({
      presenterUserId: schema.scheduleSlotPresenters.userId,
      scheduleSlotId: schema.scheduleSlots.id,
      slotTitle: schema.scheduleSlots.title,
      startsAt: schema.scheduleSlots.startsAt,
      conventionName: schema.conventions.name,
      conventionSlug: schema.conventions.slug,
    })
    .from(schema.scheduleSlotPresenters)
    .innerJoin(
      schema.scheduleSlots,
      eq(schema.scheduleSlots.id, schema.scheduleSlotPresenters.scheduleSlotId),
    )
    .innerJoin(schema.conventions, eq(schema.conventions.id, schema.scheduleSlots.conventionId))
    .leftJoin(
      schema.presenterTeachingCredits,
      and(
        eq(schema.presenterTeachingCredits.presenterUserId, schema.scheduleSlotPresenters.userId),
        eq(schema.presenterTeachingCredits.scheduleSlotId, schema.scheduleSlots.id),
      ),
    )
    .where(
      and(
        isNotNull(schema.scheduleSlots.conventionId),
        isNotNull(schema.scheduleSlots.endsAt),
        lt(schema.scheduleSlots.endsAt, now),
        isNull(schema.presenterTeachingCredits.id),
      ),
    )

  let inserted = 0
  let skipped = 0

  for (const row of pending) {
    const values = buildVerifiedTeachingCreditInsert({
      presenterUserId: row.presenterUserId,
      slotTitle: row.slotTitle,
      conventionName: row.conventionName,
      conventionSlug: row.conventionSlug,
      scheduleSlotId: row.scheduleSlotId,
      startsAt: row.startsAt,
    })
    const ok = await insertVerifiedCredit(values)
    if (ok) inserted += 1
    else skipped += 1
  }

  return { inserted, skipped }
}
