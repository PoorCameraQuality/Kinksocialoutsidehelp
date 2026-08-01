import { formatInTimeZone } from 'date-fns-tz'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'
import type { CalendarItem } from '@/hooks/usePlaySpaceDancecard'
import {
  defaultProgramDayKey,
  eventDayKey,
  formatProgramDayChip,
  formatProgramDayHeading,
  formatProgramTime,
  formatSessionTimeRange,
  humanTimezone,
  todayDayKey,
  type ProgramDay,
} from '@/lib/play-space-program'

export type PlanItemKind = 'program' | 'scene' | 'block' | 'other'

export type PlanItem = CalendarItem & {
  planKind: PlanItemKind
  overlaps?: boolean
}

export type PlanDay = ProgramDay & { items: PlanItem[]; count: number }

export { eventDayKey, formatProgramTime, formatSessionTimeRange, humanTimezone }

export function groupPlanByStartTime(items: PlanItem[]): { startIso: string; sessions: PlanItem[] }[] {
  const sorted = [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const out: { startIso: string; sessions: PlanItem[] }[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && last.startIso === s.startsAt) last.sessions.push(s)
    else out.push({ startIso: s.startsAt, sessions: [s] })
  }
  return out
}

export function planKindFromCalendar(kind: string): PlanItemKind {
  if (kind === 'dancecard_slot_signup') return 'program'
  if (kind === 'dancecard_scene_booking') return 'scene'
  if (kind === 'dancecard_manual') return 'block'
  return 'other'
}

export function planSourceLabel(kind: PlanItemKind): string {
  switch (kind) {
    case 'program':
      return 'PROGRAM'
    case 'scene':
      return 'SCENE · CONFIRMED'
    case 'block':
      return 'BLOCK'
    default:
      return 'PLAN'
  }
}

export function displayPlanTitle(item: PlanItem): string {
  const t = item.title?.trim()
  return t || 'Busy'
}

export function markOverlaps(items: PlanItem[]): PlanItem[] {
  return items.map((item) => {
    const a0 = Date.parse(item.startsAt)
    const a1 = Date.parse(item.endsAt)
    const overlaps = items.some((other) => {
      if (other.id === item.id) return false
      const b0 = Date.parse(other.startsAt)
      const b1 = Date.parse(other.endsAt)
      return a0 < b1 && b0 < a1
    })
    return { ...item, overlaps }
  })
}

export function toPlanItems(items: CalendarItem[]): PlanItem[] {
  const mapped = items.map((it) => ({
    ...it,
    planKind: planKindFromCalendar(it.kind),
  }))
  return markOverlaps(mapped)
}

export function buildPlanDays(
  items: PlanItem[],
  timeZone: string,
  windowStartsAt?: string | null,
  windowEndsAt?: string | null,
  now = new Date(),
): PlanDay[] {
  const today = todayDayKey(timeZone, now)
  const byDay = new Map<string, PlanItem[]>()
  for (const it of [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const key = eventDayKey(it.startsAt, timeZone)
    const list = byDay.get(key) ?? []
    list.push(it)
    byDay.set(key, list)
  }

  let keys =
    windowStartsAt && windowEndsAt
      ? dayKeysInWindow(windowStartsAt, windowEndsAt, timeZone)
      : [...byDay.keys()].sort()

  for (const k of byDay.keys()) {
    if (!keys.includes(k)) keys = [...keys, k].sort()
  }

  if (keys.length === 0) keys = [today]

  return keys.map((dayKey) => {
    const dayItems = byDay.get(dayKey) ?? []
    const count = dayItems.length
    const baseChip = formatProgramDayChip(dayKey, timeZone, dayKey === today)
    return {
      dayKey,
      label: formatProgramDayHeading(dayKey, timeZone),
      shortLabel: count > 0 ? `${baseChip} · ${count}` : baseChip,
      isToday: dayKey === today,
      sessions: [],
      items: dayItems,
      count,
    }
  })
}

export function defaultPlanDayKey(days: PlanDay[], timeZone: string, now = new Date()): string | null {
  if (days.length === 0) return null
  const today = todayDayKey(timeZone, now)
  const todayDay = days.find((d) => d.dayKey === today)
  if (todayDay) return todayDay.dayKey

  const withItems = days.filter((d) => d.count > 0)
  if (withItems.length === 0) {
    return defaultProgramDayKey(
      days.map((d) => ({ ...d, sessions: [] })),
      timeZone,
      now,
    )
  }

  const upcoming = withItems.find((d) => d.dayKey >= today)
  if (upcoming) return upcoming.dayKey
  return withItems[withItems.length - 1]?.dayKey ?? days[0]?.dayKey ?? null
}

export function formatUntilLabel(endsAt: string, timeZone: string, startsAt?: string): string {
  const endDay = eventDayKey(endsAt, timeZone)
  const startDay = startsAt ? eventDayKey(startsAt, timeZone) : endDay
  const endT = formatProgramTime(endsAt, timeZone)
  if (startsAt && startDay !== endDay) {
    const endD = formatInTimeZone(new Date(endsAt), timeZone, 'EEE')
    return `Until ${endD}, ${endT}`
  }
  return `Until ${endT}`
}

export function startsInMinutes(startsAt: string, now = new Date()): number | null {
  const ms = Date.parse(startsAt) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.round(ms / 60_000)
}

export function partitionPlanDay(
  items: PlanItem[],
  now = new Date(),
): {
  happeningNow: PlanItem[]
  upNext: PlanItem[]
  later: PlanItem[]
  earlier: PlanItem[]
} {
  const t = now.getTime()
  const happeningNow: PlanItem[] = []
  const upcoming: PlanItem[] = []
  const earlier: PlanItem[] = []
  for (const s of items) {
    const start = Date.parse(s.startsAt)
    const end = Date.parse(s.endsAt)
    if (start <= t && t < end) happeningNow.push(s)
    else if (end <= t) earlier.push(s)
    else upcoming.push(s)
  }
  upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const nextStart = upcoming[0] ? Date.parse(upcoming[0].startsAt) : null
  const upNext = nextStart == null ? [] : upcoming.filter((s) => Date.parse(s.startsAt) === nextStart)
  const later = nextStart == null ? [] : upcoming.filter((s) => Date.parse(s.startsAt) !== nextStart)
  return { happeningNow, upNext, later, earlier }
}
