import { and, asc, count, eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Going RSVP that counts toward capacity and public "going" totals. */
export function committedGoingCondition() {
  return and(
    eq(schema.eventRsvps.status, 'going'),
    or(
      eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
      eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
    )
  )
}

export async function countCommittedGoing(eventId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), committedGoingCondition()))
  return Number(row?.n ?? 0)
}

/**
 * Recompute `events.rsvp_count` from committed going rows (not waitlist, not pending approval).
 */
export async function refreshEventRsvpCount(eventId: string): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), committedGoingCondition()))
  const n = Number(row?.n ?? 0)
  await db.update(schema.events).set({ rsvpCount: n }).where(eq(schema.events.id, eventId))
}

/**
 * After a slot frees up, promote oldest waitlist member to going (auto-approved for gated events).
 */
export async function promoteNextWaitlist(eventId: string): Promise<void> {
  const [ev] = await db
    .select({
      locationVisibility: schema.events.locationVisibility,
    })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (!ev) return

  const [next] = await db
    .select({
      id: schema.eventRsvps.id,
    })
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.status, 'waitlist')))
    .orderBy(asc(schema.eventRsvps.createdAt))
    .limit(1)

  if (!next) return

  await db
    .update(schema.eventRsvps)
    .set({
      status: 'going',
      rsvpApprovalStatus: ev.locationVisibility === 'approved' ? 'approved' : 'not_required',
      updatedAt: new Date(),
    })
    .where(eq(schema.eventRsvps.id, next.id))

  await refreshEventRsvpCount(eventId)
}
