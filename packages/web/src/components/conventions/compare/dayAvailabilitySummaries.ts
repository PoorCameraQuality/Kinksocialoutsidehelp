import {
  exclusiveEndOfZonedCalendarDayMs,
  formatTime,
  utcMillisAtZonedWallClock,
  zonedCalendarDateFromUtc,
} from '@/components/dancecard/time'
import { formatDuration } from '@/components/conventions/compare/bestOpenWindows'
import {
  gapsToMs,
  mergeMsIntervals,
  type MsInterval,
} from '@/components/conventions/compare/intervalHelpers'

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export type DayWindow = {
  startMs: number
  endMs: number
  timeLabel: string
  durationLabel: string
  durationMs: number
}

export type DayAvailabilitySummary = {
  ymdKey: string
  weekdayLong: string
  weekdayShort: string
  dayLabel: string
  parts: DayPart[]
  partsLabel: string
  largest: DayWindow
  windows: DayWindow[]
  totalFreeMs: number
}

const PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening', 'night']

const PART_LABEL: Record<DayPart, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
}

/** Wall-clock hour ranges (local to event tz). Night wraps midnight. */
function partOverlapsHour(part: DayPart, hour: number): boolean {
  switch (part) {
    case 'morning':
      return hour >= 5 && hour < 12
    case 'afternoon':
      return hour >= 12 && hour < 17
    case 'evening':
      return hour >= 17 && hour < 21
    case 'night':
      return hour >= 21 || hour < 5
    default:
      return false
  }
}

function hourInTz(ms: number, tz: string): number {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(
      new Date(ms),
    ),
  )
  // Some engines yield "24" for midnight.
  return h === 24 ? 0 : h
}

function partsTouchedByWindow(startMs: number, endMs: number, tz: string): Set<DayPart> {
  const found = new Set<DayPart>()
  // Sample every 30 minutes inside the window (capped).
  const step = 30 * 60_000
  const last = Math.max(startMs, endMs - 1)
  for (let t = startMs; t <= last; t += step) {
    const hour = hourInTz(t, tz)
    for (const part of PART_ORDER) {
      if (partOverlapsHour(part, hour)) found.add(part)
    }
  }
  return found
}

function formatPartsLabel(parts: DayPart[]): string {
  if (parts.length === 0) return 'at times'
  if (parts.length === 1) return PART_LABEL[parts[0]!]
  if (parts.length === 2) return `${PART_LABEL[parts[0]!]} and ${PART_LABEL[parts[1]!]}`
  const head = parts.slice(0, -1).map((p) => PART_LABEL[p])
  const last = PART_LABEL[parts[parts.length - 1]!]
  return `${head.join(', ')}, and ${last}`
}

function toDayWindow(interval: MsInterval, tz: string): DayWindow {
  const durationMs = interval.endMs - interval.startMs
  return {
    startMs: interval.startMs,
    endMs: interval.endMs,
    timeLabel: `${formatTime(new Date(interval.startMs).toISOString(), tz)} – ${formatTime(new Date(interval.endMs).toISOString(), tz)}`,
    durationLabel: formatDuration(durationMs),
    durationMs,
  }
}

/**
 * Clip free gaps onto calendar days and summarize each day:
 * which day-parts are free, largest stretch, and every window that day.
 */
export function dayAvailabilitySummaries(
  intervals: { startsAt: string; endsAt: string }[],
  tz: string,
  opts?: { minWindowMs?: number; maxDays?: number },
): DayAvailabilitySummary[] {
  const minWindowMs = opts?.minWindowMs ?? 30 * 60_000
  const maxDays = opts?.maxDays ?? 8
  const merged = mergeMsIntervals(gapsToMs(intervals))
  if (merged.length === 0) return []

  const byDay = new Map<string, MsInterval[]>()

  for (const gap of merged) {
    let cursor = gap.startMs
    while (cursor < gap.endMs) {
      const ymd = zonedCalendarDateFromUtc(cursor, tz)
      const dayStart = utcMillisAtZonedWallClock(tz, ymd, 0, 0) ?? cursor
      const dayEnd = exclusiveEndOfZonedCalendarDayMs(tz, ymd)
      const clipStart = Math.max(gap.startMs, dayStart)
      const clipEnd = Math.min(gap.endMs, dayEnd)
      if (clipEnd - clipStart >= minWindowMs) {
        const list = byDay.get(ymd) ?? []
        list.push({ startMs: clipStart, endMs: clipEnd })
        byDay.set(ymd, list)
      }
      if (!(dayEnd > cursor)) break
      cursor = dayEnd
    }
  }

  const ymds = [...byDay.keys()].sort()
  const out: DayAvailabilitySummary[] = []

  for (const ymd of ymds) {
    const windows = mergeMsIntervals(byDay.get(ymd) ?? []).map((w) => toDayWindow(w, tz))
    if (windows.length === 0) continue

    const partsSet = new Set<DayPart>()
    for (const w of windows) {
      for (const p of partsTouchedByWindow(w.startMs, w.endMs, tz)) partsSet.add(p)
    }
    const parts = PART_ORDER.filter((p) => partsSet.has(p))
    const largest = [...windows].sort((a, b) => b.durationMs - a.durationMs || a.startMs - b.startMs)[0]!
    const totalFreeMs = windows.reduce((sum, w) => sum + w.durationMs, 0)
    const anchor = new Date(windows[0]!.startMs)

    out.push({
      ymdKey: ymd,
      weekdayLong: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(anchor),
      weekdayShort: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(anchor),
      dayLabel: new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(anchor),
      parts,
      partsLabel: formatPartsLabel(parts),
      largest,
      windows: windows.sort((a, b) => a.startMs - b.startMs),
      totalFreeMs,
    })
  }

  // Prefer days with more free time, then earlier days — keep a short list.
  return out
    .sort((a, b) => b.totalFreeMs - a.totalFreeMs || a.ymdKey.localeCompare(b.ymdKey))
    .slice(0, maxDays)
    .sort((a, b) => a.ymdKey.localeCompare(b.ymdKey))
}
