import { and, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/**
 * RSVP going/maybe and event end in the past (per `docs/PROJECT_DECISIONS.md`).
 */
export async function userAttendedEvent(userId: string, eventId: string): Promise<boolean> {
  const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
  if (!ev) return false
  const endAt = ev.endsAt ?? new Date(ev.startsAt.getTime() + 24 * 60 * 60 * 1000)
  if (endAt.getTime() > Date.now()) return false
  const [rsvp] = await db
    .select()
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)))
    .limit(1)
  if (!rsvp) return false
  if (rsvp.status === 'waitlist') return false
  if (rsvp.status === 'going' && ev.locationVisibility === 'approved' && rsvp.rsvpApprovalStatus !== 'approved') {
    return false
  }
  return rsvp.status === 'going' || rsvp.status === 'maybe'
}

/** Staff-confirmed door check-in at a convention run by the event's organization. */
export async function userStaffCheckedInForEvent(userId: string, eventId: string): Promise<boolean> {
  const [ev] = await db
    .select({ organizationId: schema.events.organizationId })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (!ev?.organizationId) return false

  const checkIns = await db
    .select({ conventionId: schema.conventionCheckIns.conventionId })
    .from(schema.conventionCheckIns)
    .where(
      and(
        eq(schema.conventionCheckIns.userId, userId),
        isNotNull(schema.conventionCheckIns.checkedInByUserId)
      )
    )

  for (const row of checkIns) {
    const [conv] = await db
      .select({ organizationId: schema.conventions.organizationId })
      .from(schema.conventions)
      .where(eq(schema.conventions.id, row.conventionId))
      .limit(1)
    if (conv?.organizationId === ev.organizationId) return true
  }
  return false
}

export async function userAttendedAnyOrgEvent(userId: string, organizationId: string): Promise<boolean> {
  const evs = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.organizationId, organizationId))
  for (const e of evs) {
    if (await userAttendedEvent(userId, e.id)) return true
  }
  return false
}
