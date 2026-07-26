import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Mark convention access paid (idempotent upsert). */
export async function setConventionPaidConfirmed(params: {
  conventionId: string
  userId: string
  grantedByUserId?: string | null
}): Promise<void> {
  const [existing] = await db
    .select({ id: schema.conventionAccessGrants.id })
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, params.conventionId),
        eq(schema.conventionAccessGrants.userId, params.userId),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(schema.conventionAccessGrants)
      .set({ paidConfirmed: true })
      .where(eq(schema.conventionAccessGrants.id, existing.id))
    return
  }

  await db.insert(schema.conventionAccessGrants).values({
    conventionId: params.conventionId,
    userId: params.userId,
    role: 'ATTENDEE',
    paidConfirmed: true,
    attendingConfirmed: false,
    staffPreAccess: false,
    canAssignStaffSchedules: false,
    grantedByUserId: params.grantedByUserId ?? null,
  })
}

/** Mark event RSVP paid (upsert going RSVP if missing). */
export async function setEventPaidConfirmed(params: {
  eventId: string
  userId: string
}): Promise<void> {
  const [existing] = await db
    .select({ id: schema.eventRsvps.id })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.eventId, params.eventId),
        eq(schema.eventRsvps.userId, params.userId),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(schema.eventRsvps)
      .set({ paidConfirmed: true, updatedAt: new Date() })
      .where(eq(schema.eventRsvps.id, existing.id))
    return
  }

  await db.insert(schema.eventRsvps).values({
    eventId: params.eventId,
    userId: params.userId,
    status: 'going',
    paidConfirmed: true,
  })
}
