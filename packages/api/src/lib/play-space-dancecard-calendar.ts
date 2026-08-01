/**
 * Play-space dancecard calendar / free-gap helpers (mirrors convention-dancecard-calendar,
 * scoped to play_space_* tables — no convention obligations).
 */
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  clipIntervalToWindow,
  expandIntervalsTrailingBuffer,
  invertToFreeGaps,
  mergeIntervals,
  normalizeBufferMinutes,
  type IsoInterval,
} from './dancecard-intervals.js'

export type PlayCalendarItem = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  kind: 'dancecard_manual' | 'dancecard_slot_signup' | 'dancecard_scene_booking'
  subtitle?: string
  location?: string | null
  mutable: boolean
  sourceKind?: string | null
  sourceId?: string | null
}

export async function getPlayDancecardBufferMinutes(playSpaceId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({ bufferMinutes: schema.playSpaceDancecardPrefs.bufferMinutes })
    .from(schema.playSpaceDancecardPrefs)
    .where(
      and(
        eq(schema.playSpaceDancecardPrefs.playSpaceId, playSpaceId),
        eq(schema.playSpaceDancecardPrefs.userId, userId),
      ),
    )
    .limit(1)
  return normalizeBufferMinutes(row?.bufferMinutes ?? 0)
}

export async function upsertPlayDancecardBufferMinutes(
  playSpaceId: string,
  userId: string,
  bufferMinutes: number,
): Promise<number> {
  const v = normalizeBufferMinutes(bufferMinutes)
  const [ex] = await db
    .select({ id: schema.playSpaceDancecardPrefs.id })
    .from(schema.playSpaceDancecardPrefs)
    .where(
      and(
        eq(schema.playSpaceDancecardPrefs.playSpaceId, playSpaceId),
        eq(schema.playSpaceDancecardPrefs.userId, userId),
      ),
    )
    .limit(1)
  if (ex) {
    await db
      .update(schema.playSpaceDancecardPrefs)
      .set({ bufferMinutes: v, updatedAt: new Date() })
      .where(eq(schema.playSpaceDancecardPrefs.id, ex.id))
  } else {
    await db.insert(schema.playSpaceDancecardPrefs).values({ playSpaceId, userId, bufferMinutes: v })
  }
  return v
}

export async function loadPlayDancecardCalendar(
  playSpaceId: string,
  userId: string,
): Promise<{ items: PlayCalendarItem[]; bufferMinutes: number }> {
  const bufferMinutes = await getPlayDancecardBufferMinutes(playSpaceId, userId)
  const danceRows = await db
    .select()
    .from(schema.playSpaceDancecardEntries)
    .where(
      and(
        eq(schema.playSpaceDancecardEntries.playSpaceId, playSpaceId),
        eq(schema.playSpaceDancecardEntries.userId, userId),
      ),
    )

  const items: PlayCalendarItem[] = danceRows.map((row) => {
    const sk = row.sourceKind ?? 'manual'
    const kind =
      sk === 'slot_signup'
        ? 'dancecard_slot_signup'
        : sk === 'scene_booking'
          ? 'dancecard_scene_booking'
          : 'dancecard_manual'
    return {
      id: `dc:${row.id}`,
      startsAt: new Date(row.startsAt).toISOString(),
      endsAt: new Date(row.endsAt).toISOString(),
      title: row.title,
      kind,
      subtitle: row.notes?.trim() || undefined,
      location: row.location,
      mutable: sk === 'manual' || sk === 'scene_booking',
      sourceKind: sk,
      sourceId: row.sourceId ?? undefined,
    }
  })

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  return { items, bufferMinutes }
}

function itemsToBusy(items: PlayCalendarItem[]): IsoInterval[] {
  return items.map((it) => ({ startsAt: new Date(it.startsAt), endsAt: new Date(it.endsAt) }))
}

export async function computePlayFreeGapsForUser(
  playSpaceId: string,
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  minGapMinutes: number = 15,
): Promise<{ freeGaps: IsoInterval[]; bufferMinutes: number }> {
  const { items, bufferMinutes } = await loadPlayDancecardCalendar(playSpaceId, userId)
  const raw = itemsToBusy(items)
  const clipped = raw
    .map((it) => clipIntervalToWindow(it, windowStart, windowEnd))
    .filter((x): x is IsoInterval => Boolean(x))
  const expanded = expandIntervalsTrailingBuffer(clipped, bufferMinutes * 60_000)
  const merged = mergeIntervals(expanded)
  const freeGaps = invertToFreeGaps(windowStart, windowEnd, merged, minGapMinutes * 60_000)
  return { freeGaps, bufferMinutes }
}

export async function playGuestCalendarConflict(
  playSpaceId: string,
  guestUserId: string,
  proposed: IsoInterval,
): Promise<{ conflicts: IsoInterval[] }> {
  const { items, bufferMinutes } = await loadPlayDancecardCalendar(playSpaceId, guestUserId)
  const expanded = expandIntervalsTrailingBuffer(itemsToBusy(items), bufferMinutes * 60_000)
  const merged = mergeIntervals(expanded)
  const overlaps: IsoInterval[] = []
  for (const b of merged) {
    if (proposed.startsAt < b.endsAt && proposed.endsAt > b.startsAt) overlaps.push(b)
  }
  return { conflicts: overlaps }
}

export async function playIntervalInsideHostFreeGaps(
  playSpaceId: string,
  hostUserId: string,
  windowStart: Date,
  windowEnd: Date,
  proposed: IsoInterval,
): Promise<boolean> {
  const { freeGaps } = await computePlayFreeGapsForUser(playSpaceId, hostUserId, windowStart, windowEnd, 1)
  return freeGaps.some((g) => proposed.startsAt >= g.startsAt && proposed.endsAt <= g.endsAt)
}
