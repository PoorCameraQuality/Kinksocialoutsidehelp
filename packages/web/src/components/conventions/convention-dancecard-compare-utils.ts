export type FreeGap = { startsAt: string; endsAt: string }
export type CalItem = { startsAt: string; endsAt: string }

export const PX_PER_HOUR = 48
export const MIN_BOOKING_MS = 15 * 60 * 1000

export function getYmdKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function startOfLocalDay(ymdKey: string, tz: string): Date {
  const [y, m, d] = ymdKey.split('-').map(Number)
  let t = Date.UTC(y, m - 1, d - 1, 0, 0, 0)
  for (let i = 0; i < 200; i++) {
    if (getYmdKey(new Date(t), tz) === ymdKey) {
      let s = t
      while (s > Date.UTC(y, m - 1, d - 4, 0, 0, 0) && getYmdKey(new Date(s - 15 * 60 * 1000), tz) === ymdKey) {
        s -= 15 * 60 * 1000
      }
      return new Date(s)
    }
    t += 15 * 60 * 1000
  }
  return new Date(Date.UTC(y, m - 1, d))
}

export function endOfLocalDayExclusive(ymdKey: string, tz: string): Date {
  const s = startOfLocalDay(ymdKey, tz).getTime()
  let t = s + 15 * 60 * 1000
  const cap = s + 36 * 60 * 60 * 1000
  while (t < cap && getYmdKey(new Date(t), tz) === ymdKey) {
    t += 15 * 60 * 1000
  }
  return new Date(t)
}

export function dayLabel(d: Date, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export type DayColumn = {
  ymdKey: string
  label: string
  colStart: Date
  colEnd: Date
}

export function buildDayColumns(convStart: Date, convEnd: Date, tz: string): DayColumn[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const step = 45 * 60 * 1000
  for (let t = convStart.getTime(); t <= convEnd.getTime(); t += step) {
    const k = getYmdKey(new Date(t), tz)
    if (!seen.has(k)) {
      seen.add(k)
      keys.push(k)
    }
  }
  keys.sort()
  return keys.map((ymdKey) => {
    const sod = startOfLocalDay(ymdKey, tz)
    const eod = endOfLocalDayExclusive(ymdKey, tz)
    const colStart = new Date(Math.max(convStart.getTime(), sod.getTime()))
    const colEnd = new Date(Math.min(convEnd.getTime(), eod.getTime()))
    return { ymdKey, label: dayLabel(sod, tz), colStart, colEnd }
  })
}

export function intersectRange(aStart: number, aEnd: number, bStart: number, bEnd: number): { s: number; e: number } | null {
  const s = Math.max(aStart, bStart)
  const e = Math.min(aEnd, bEnd)
  if (e <= s) return null
  return { s, e }
}

export function normalizeBufferMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0
  const capped = Math.min(120, Math.floor(raw))
  return Math.floor(capped / 15) * 15
}

export function mergeIntervalsMillis(intervals: { s: number; e: number }[]): { s: number; e: number }[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.s - b.s)
  const out: { s: number; e: number }[] = []
  let cur = { ...sorted[0]! }
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!
    if (n.s <= cur.e) cur.e = Math.max(cur.e, n.e)
    else {
      out.push(cur)
      cur = { ...n }
    }
  }
  out.push(cur)
  return out
}

function clipToWindow(s: number, e: number, winS: number, winE: number): { s: number; e: number } | null {
  const a = Math.max(s, winS)
  const b = Math.min(e, winE)
  if (b <= a) return null
  return { s: a, e: b }
}

export function viewerExpandedBusy(
  items: CalItem[],
  bufferMinutes: number,
  winS: number,
  winE: number,
): { s: number; e: number }[] {
  const bufMs = normalizeBufferMinutes(bufferMinutes) * 60 * 1000
  const raw: { s: number; e: number }[] = []
  for (const it of items) {
    const s = new Date(it.startsAt).getTime()
    const e = new Date(it.endsAt).getTime()
    const cl = clipToWindow(s, e, winS, winE)
    if (cl) raw.push(cl)
  }
  const merged = mergeIntervalsMillis(raw)
  if (bufMs <= 0) return merged
  const expanded = merged.map((i) => ({ s: i.s, e: i.e + bufMs }))
  return mergeIntervalsMillis(expanded)
}

function subtractBusyFromFreeGap(freeS: number, freeE: number, busy: { s: number; e: number }[]): { s: number; e: number }[] {
  let pieces: { s: number; e: number }[] = [{ s: freeS, e: freeE }]
  for (const b of busy) {
    pieces = pieces.flatMap((p) => {
      if (b.e <= p.s || b.s >= p.e) return [p]
      const out: { s: number; e: number }[] = []
      if (b.s > p.s) out.push({ s: p.s, e: Math.min(b.s, p.e) })
      if (b.e < p.e) out.push({ s: Math.max(b.e, p.s), e: p.e })
      return out
    })
  }
  return pieces.filter((x) => x.e - x.s >= MIN_BOOKING_MS)
}

export function buildMutualFreeMillis(hostGaps: FreeGap[], viewerBusy: { s: number; e: number }[]): { s: number; e: number }[] {
  if (viewerBusy.length === 0) {
    return hostGaps.map((g) => ({ s: new Date(g.startsAt).getTime(), e: new Date(g.endsAt).getTime() }))
  }
  const parts: { s: number; e: number }[] = []
  for (const g of hostGaps) {
    const hs = new Date(g.startsAt).getTime()
    const he = new Date(g.endsAt).getTime()
    parts.push(...subtractBusyFromFreeGap(hs, he, viewerBusy))
  }
  return mergeIntervalsMillis(parts)
}

export function convBoundsFromShared(data: {
  conventionStartsAt?: string
  conventionEndsAt?: string
  freeGaps: FreeGap[]
}): { start: Date; end: Date } | null {
  if (data.conventionStartsAt && data.conventionEndsAt) {
    return { start: new Date(data.conventionStartsAt), end: new Date(data.conventionEndsAt) }
  }
  if (data.freeGaps.length > 0) {
    let minT = Infinity
    let maxT = -Infinity
    for (const g of data.freeGaps) {
      minT = Math.min(minT, new Date(g.startsAt).getTime())
      maxT = Math.max(maxT, new Date(g.endsAt).getTime())
    }
    return { start: new Date(minT), end: new Date(maxT) }
  }
  return null
}
