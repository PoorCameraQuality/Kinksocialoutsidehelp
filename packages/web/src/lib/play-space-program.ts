import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { ProgramSlot } from '@/hooks/usePlaySpaceDancecard'
import { timezoneLabel } from '@/lib/guest-dancecard-share'

export type ProgramSession = ProgramSlot & {
  isOnMyDancecard?: boolean
  personalEntryId?: string | null
}

export type ProgramDay = {
  dayKey: string
  label: string
  shortLabel: string
  isToday: boolean
  sessions: ProgramSession[]
}

export function eventDayKey(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, 'yyyy-MM-dd')
}

export function todayDayKey(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, 'yyyy-MM-dd')
}

export function humanTimezone(timeZone: string): string {
  return timezoneLabel(timeZone)
}

export function formatProgramTime(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, 'h:mm a')
}

export function formatProgramDayHeading(dayKey: string, timeZone: string): string {
  const noon = fromDayKeyNoon(dayKey, timeZone)
  return formatInTimeZone(noon, timeZone, 'EEEE, MMMM d')
}

export function formatProgramDayChip(dayKey: string, timeZone: string, isToday: boolean): string {
  const noon = fromDayKeyNoon(dayKey, timeZone)
  const short = formatInTimeZone(noon, timeZone, 'EEE d')
  return isToday ? `Today · ${short}` : short
}

function fromDayKeyNoon(dayKey: string, timeZone: string): Date {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10))
  return fromZonedTime(new Date(y, m - 1, d, 12, 0, 0, 0), timeZone)
}

export function formatSessionTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const startDay = eventDayKey(startsAt, timeZone)
  const endDay = eventDayKey(endsAt, timeZone)
  const startT = formatProgramTime(startsAt, timeZone)
  const endT = formatProgramTime(endsAt, timeZone)
  if (startDay !== endDay) {
    const startD = formatInTimeZone(new Date(startsAt), timeZone, 'EEE')
    const endD = formatInTimeZone(new Date(endsAt), timeZone, 'EEE')
    return `${startD}, ${startT} – ${endD}, ${endT}`
  }
  return `${startT} – ${endT}`
}

export function formatDurationHuman(startsAt: string, endsAt: string): string {
  const ms = Date.parse(endsAt) - Date.parse(startsAt)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60_000)
  if (min >= 20 * 60) return 'All day'
  if (min >= 12 * 60) return 'Overnight'
  if (min >= 120) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} hr ${m} min` : `${h} hr`
  }
  if (min >= 60) {
    const m = min - 60
    return m ? `1 hr ${m} min` : '1 hr'
  }
  return `${min} min`
}

export function buildProgramDays(sessions: ProgramSession[], timeZone: string, now = new Date()): ProgramDay[] {
  const today = todayDayKey(timeZone, now)
  const map = new Map<string, ProgramSession[]>()
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  for (const s of sorted) {
    const key = eventDayKey(s.startsAt, timeZone)
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, daySessions]) => ({
      dayKey,
      label: formatProgramDayHeading(dayKey, timeZone),
      shortLabel: formatProgramDayChip(dayKey, timeZone, dayKey === today),
      isToday: dayKey === today,
      sessions: daySessions,
    }))
}

export function defaultProgramDayKey(days: ProgramDay[], timeZone: string, now = new Date()): string | null {
  if (days.length === 0) return null
  const today = todayDayKey(timeZone, now)
  const todayDay = days.find((d) => d.dayKey === today)
  if (todayDay) return todayDay.dayKey
  const upcoming = days.find((d) => d.dayKey > today)
  if (upcoming) return upcoming.dayKey
  return days[days.length - 1]?.dayKey ?? null
}

export function partitionDaySessions(
  sessions: ProgramSession[],
  now = new Date(),
): {
  happeningNow: ProgramSession[]
  upNext: ProgramSession[]
  later: ProgramSession[]
  earlier: ProgramSession[]
} {
  const t = now.getTime()
  const happeningNow: ProgramSession[] = []
  const upcoming: ProgramSession[] = []
  const earlier: ProgramSession[] = []

  for (const s of sessions) {
    const start = Date.parse(s.startsAt)
    const end = Date.parse(s.endsAt)
    if (start <= t && t < end) happeningNow.push(s)
    else if (end <= t) earlier.push(s)
    else upcoming.push(s)
  }

  upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const nextStart = upcoming[0] ? Date.parse(upcoming[0].startsAt) : null
  const upNext =
    nextStart == null ? [] : upcoming.filter((s) => Date.parse(s.startsAt) === nextStart)
  const later = nextStart == null ? [] : upcoming.filter((s) => Date.parse(s.startsAt) !== nextStart)

  return { happeningNow, upNext, later, earlier }
}

export function groupByStartTime(sessions: ProgramSession[]): { startIso: string; sessions: ProgramSession[] }[] {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const out: { startIso: string; sessions: ProgramSession[] }[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && last.startIso === s.startsAt) last.sessions.push(s)
    else out.push({ startIso: s.startsAt, sessions: [s] })
  }
  return out
}
