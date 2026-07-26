import { and, count, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type EventProgramSummary = {
  conventionId: string
  slug: string
  name: string
  slotCount: number
}

/** Convention shell linked by anchor_event_id (one row per event when program exists). */
export async function getProgramSummaryForEvent(eventId: string): Promise<EventProgramSummary | null> {
  const [conv] = await db
    .select({
      id: schema.conventions.id,
      slug: schema.conventions.slug,
      name: schema.conventions.name,
    })
    .from(schema.conventions)
    .where(eq(schema.conventions.anchorEventId, eventId))
    .limit(1)
  if (!conv) return null
  const [cnt] = await db
    .select({ n: count(schema.scheduleSlots.id) })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
  return {
    conventionId: conv.id,
    slug: conv.slug,
    name: conv.name,
    slotCount: Number(cnt?.n ?? 0),
  }
}

/** Batch: event id -> program summary (skips events with no program). */
export async function getProgramSummariesForEventIds(
  eventIds: string[]
): Promise<Map<string, EventProgramSummary>> {
  const out = new Map<string, EventProgramSummary>()
  if (eventIds.length === 0) return out
  const convs = await db
    .select({
      id: schema.conventions.id,
      slug: schema.conventions.slug,
      name: schema.conventions.name,
      anchorEventId: schema.conventions.anchorEventId,
    })
    .from(schema.conventions)
    .where(
      and(isNotNull(schema.conventions.anchorEventId), inArray(schema.conventions.anchorEventId, eventIds))
    )
  if (convs.length === 0) return out
  const convIds = convs.map((c) => c.id)
  const countRows = await db
    .select({
      conventionId: schema.scheduleSlots.conventionId,
      n: count(schema.scheduleSlots.id),
    })
    .from(schema.scheduleSlots)
    .where(inArray(schema.scheduleSlots.conventionId, convIds))
    .groupBy(schema.scheduleSlots.conventionId)
  const countMap = new Map(countRows.map((r) => [r.conventionId, Number(r.n)]))
  for (const c of convs) {
    if (!c.anchorEventId) continue
    out.set(c.anchorEventId, {
      conventionId: c.id,
      slug: c.slug,
      name: c.name,
      slotCount: countMap.get(c.id) ?? 0,
    })
  }
  return out
}
