/** Pure interval helpers for dancecard busy/free time and buffer expansion. */

export type IsoInterval = { startsAt: Date; endsAt: Date }

export function normalizeBufferMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0
  const capped = Math.min(120, Math.floor(raw))
  const stepped = Math.floor(capped / 15) * 15
  return stepped
}

/** Extend each interval on the trailing edge by bufferMs (plan: recovery after a session ends). */
export function expandIntervalsTrailingBuffer(intervals: IsoInterval[], bufferMs: number): IsoInterval[] {
  if (bufferMs <= 0) return intervals.map((i) => ({ startsAt: i.startsAt, endsAt: i.endsAt }))
  return intervals.map((i) => ({
    startsAt: i.startsAt,
    endsAt: new Date(i.endsAt.getTime() + bufferMs),
  }))
}

export function mergeIntervals(intervals: IsoInterval[]): IsoInterval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const out: IsoInterval[] = []
  let cur = { ...sorted[0]! }
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!
    if (n.startsAt.getTime() <= cur.endsAt.getTime()) {
      if (n.endsAt.getTime() > cur.endsAt.getTime()) {
        cur.endsAt = n.endsAt
      }
    } else {
      out.push(cur)
      cur = { ...n }
    }
  }
  out.push(cur)
  return out
}

/** Clip interval to [windowStart, windowEnd]; drop if empty after clip. */
export function clipIntervalToWindow(it: IsoInterval, windowStart: Date, windowEnd: Date): IsoInterval | null {
  const s = Math.max(it.startsAt.getTime(), windowStart.getTime())
  const e = Math.min(it.endsAt.getTime(), windowEnd.getTime())
  if (e <= s) return null
  return { startsAt: new Date(s), endsAt: new Date(e) }
}

export function invertToFreeGaps(
  windowStart: Date,
  windowEnd: Date,
  busyMerged: IsoInterval[],
  minGapMs: number
): IsoInterval[] {
  const gaps: IsoInterval[] = []
  let cursor = windowStart.getTime()
  const end = windowEnd.getTime()
  for (const b of busyMerged) {
    const bs = b.startsAt.getTime()
    const be = b.endsAt.getTime()
    if (bs > cursor) {
      const gEnd = Math.min(bs, end)
      if (gEnd - cursor >= minGapMs) {
        gaps.push({ startsAt: new Date(cursor), endsAt: new Date(gEnd) })
      }
    }
    cursor = Math.max(cursor, be)
    if (cursor >= end) break
  }
  if (cursor < end && end - cursor >= minGapMs) {
    gaps.push({ startsAt: new Date(cursor), endsAt: new Date(end) })
  }
  return gaps
}

export function intervalsOverlap(a: IsoInterval, b: IsoInterval): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt
}

export function intervalOverlapsAny(target: IsoInterval, list: IsoInterval[]): IsoInterval[] {
  return list.filter((x) => intervalsOverlap(target, x))
}
