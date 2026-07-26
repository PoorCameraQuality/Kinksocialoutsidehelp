import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildMyConventionScheduleItems, type MyScheduleItem } from './convention-my-schedule.js'
import {
  clipIntervalToWindow,
  expandIntervalsTrailingBuffer,
  invertToFreeGaps,
  mergeIntervals,
  normalizeBufferMinutes,
  type IsoInterval,
} from './dancecard-intervals.js'

export type DancecardCalendarKind =
  | 'dancecard_manual'
  | 'dancecard_slot_signup'
  | 'dancecard_scene_booking'
  | 'presenting'
  | 'staff_slot'
  | 'staff_duty'
  | 'volunteer'

export type DancecardCalendarItem = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  kind: DancecardCalendarKind
  subtitle?: string
  location?: string | null
  mutable: boolean
  sourceKind?: string | null
  sourceId?: string | null
  /** Obligation refs when from my-schedule */
  slotId?: string | null
  dutyId?: string | null
  staffAssignmentId?: string | null
}

export async function getDancecardBufferMinutes(conventionId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({ bufferMinutes: schema.conventionDancecardPrefs.bufferMinutes })
    .from(schema.conventionDancecardPrefs)
    .where(
      and(
        eq(schema.conventionDancecardPrefs.conventionId, conventionId),
        eq(schema.conventionDancecardPrefs.userId, userId)
      )
    )
    .limit(1)
  return normalizeBufferMinutes(row?.bufferMinutes ?? 0)
}

export async function upsertDancecardBufferMinutes(
  conventionId: string,
  userId: string,
  bufferMinutes: number
): Promise<number> {
  const v = normalizeBufferMinutes(bufferMinutes)
  const [ex] = await db
    .select({ id: schema.conventionDancecardPrefs.id })
    .from(schema.conventionDancecardPrefs)
    .where(
      and(
        eq(schema.conventionDancecardPrefs.conventionId, conventionId),
        eq(schema.conventionDancecardPrefs.userId, userId)
      )
    )
    .limit(1)
  if (ex) {
    await db
      .update(schema.conventionDancecardPrefs)
      .set({ bufferMinutes: v })
      .where(eq(schema.conventionDancecardPrefs.id, ex.id))
  } else {
    await db.insert(schema.conventionDancecardPrefs).values({ conventionId, userId, bufferMinutes: v })
  }
  return v
}

function mapDancecardSourceToKind(sourceKind: string | null | undefined): DancecardCalendarKind {
  if (sourceKind === 'slot_signup') return 'dancecard_slot_signup'
  if (sourceKind === 'scene_booking') return 'dancecard_scene_booking'
  return 'dancecard_manual'
}

function mapObligationKind(kind: MyScheduleItem['kind']): DancecardCalendarKind {
  if (kind === 'presenting') return 'presenting'
  if (kind === 'staff_slot') return 'staff_slot'
  if (kind === 'staff_duty') return 'staff_duty'
  return 'volunteer'
}

export async function loadUnifiedDancecardCalendar(
  conventionId: string,
  userId: string
): Promise<{ items: DancecardCalendarItem[]; bufferMinutes: number }> {
  const bufferMinutes = await getDancecardBufferMinutes(conventionId, userId)

  const [danceRows, obligations] = await Promise.all([
    db
      .select()
      .from(schema.dancecardEntries)
      .where(and(eq(schema.dancecardEntries.conventionId, conventionId), eq(schema.dancecardEntries.userId, userId))),
    buildMyConventionScheduleItems(conventionId, userId),
  ])

  const items: DancecardCalendarItem[] = []

  const obligationSlotIds = new Set<string>()
  for (const o of obligations) {
    if (o.slotId) obligationSlotIds.add(o.slotId)
  }

  for (const row of danceRows) {
    if (row.sourceKind === 'slot_signup' && row.sourceId && obligationSlotIds.has(row.sourceId)) {
      continue
    }
    const kind = mapDancecardSourceToKind(row.sourceKind)
    const mutable = row.sourceKind === 'manual' || row.sourceKind === 'scene_booking'
    items.push({
      id: `dc:${row.id}`,
      startsAt: new Date(row.startsAt).toISOString(),
      endsAt: new Date(row.endsAt).toISOString(),
      title: row.title,
      kind,
      subtitle: row.notes?.trim() || undefined,
      location: row.location,
      mutable,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId ?? undefined,
    })
  }

  for (const o of obligations) {
    items.push({
      id: `ob:${o.kind}:${o.slotId ?? o.dutyId ?? o.staffAssignmentId ?? `${o.startsAt}`}`,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      title: o.title,
      kind: mapObligationKind(o.kind),
      subtitle: o.detail,
      location: o.location,
      mutable: false,
      slotId: o.slotId ?? null,
      dutyId: o.dutyId ?? null,
      staffAssignmentId: o.staffAssignmentId ?? null,
    })
  }

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  return { items, bufferMinutes }
}

export function itemsToBusyIntervals(items: DancecardCalendarItem[]): IsoInterval[] {
  return items.map((it) => ({
    startsAt: new Date(it.startsAt),
    endsAt: new Date(it.endsAt),
  }))
}

function excludeSceneBookingItems(items: DancecardCalendarItem[], excludeSceneBookingId?: string) {
  if (!excludeSceneBookingId) return items
  return items.filter(
    (it) =>
      !(
        it.kind === 'dancecard_scene_booking' &&
        it.sourceId &&
        String(it.sourceId) === String(excludeSceneBookingId)
      )
  )
}

export async function computeFreeGapsForUser(
  conventionId: string,
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  minGapMinutes: number = 15,
  /** When rescheduling, ignore the existing scene rows tied to this booking so the new window can overlap the old slot. */
  excludeSceneBookingId?: string
): Promise<{ freeGaps: IsoInterval[]; bufferMinutes: number }> {
  const { items, bufferMinutes } = await loadUnifiedDancecardCalendar(conventionId, userId)
  const raw = itemsToBusyIntervals(excludeSceneBookingItems(items, excludeSceneBookingId))
  const clipped = raw
    .map((it) => clipIntervalToWindow(it, windowStart, windowEnd))
    .filter((x): x is IsoInterval => Boolean(x))
  const bufferMs = bufferMinutes * 60_000
  const expanded = expandIntervalsTrailingBuffer(clipped, bufferMs)
  const merged = mergeIntervals(expanded)
  const minGapMs = minGapMinutes * 60_000
  const freeGaps = invertToFreeGaps(windowStart, windowEnd, merged, minGapMs)
  return { freeGaps, bufferMinutes }
}

export async function guestCalendarConflict(
  conventionId: string,
  guestUserId: string,
  proposed: IsoInterval,
  excludeSceneBookingId?: string
): Promise<{ conflicts: IsoInterval[] }> {
  const { items, bufferMinutes } = await loadUnifiedDancecardCalendar(conventionId, guestUserId)
  const raw = itemsToBusyIntervals(excludeSceneBookingItems(items, excludeSceneBookingId))
  const bufferMs = bufferMinutes * 60_000
  const expanded = expandIntervalsTrailingBuffer(raw, bufferMs)
  const merged = mergeIntervals(expanded)
  const overlaps: IsoInterval[] = []
  for (const b of merged) {
    if (proposed.startsAt < b.endsAt && proposed.endsAt > b.startsAt) {
      overlaps.push(b)
    }
  }
  return { conflicts: overlaps }
}

export async function intervalInsideHostFreeGaps(
  conventionId: string,
  hostUserId: string,
  windowStart: Date,
  windowEnd: Date,
  proposed: IsoInterval,
  excludeSceneBookingId?: string
): Promise<boolean> {
  const { freeGaps } = await computeFreeGapsForUser(
    conventionId,
    hostUserId,
    windowStart,
    windowEnd,
    1,
    excludeSceneBookingId
  )
  return freeGaps.some((g) => proposed.startsAt >= g.startsAt && proposed.endsAt <= g.endsAt)
}
