import type { MockEvent } from '@/data/types'
import { eventStartDate } from '@/lib/events-page-utils'

export type EventDateTile = {
  weekday: string
  day: string
  month: string
  /** Local time label (e.g. "7:00 PM") when a precise start time is known. */
  time: string | null
}

/**
 * Date-first tile parts for an event. Falls back to the human `date` string
 * when no parseable date exists (keeps "Date TBA"-style cards honest).
 */
export function formatEventDateTile(event: MockEvent): EventDateTile {
  const d = eventStartDate(event)
  if (d) {
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      day: d.toLocaleDateString(undefined, { day: 'numeric' }),
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      time: hasExplicitTime(event) ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null,
    }
  }
  const parts = event.date.split(/[,\s]+/).filter(Boolean)
  return {
    weekday: (parts[0] ?? 'TBD').toUpperCase().slice(0, 3),
    day: parts.find((p) => /^\d{1,2}$/.test(p)) ?? '',
    month: (parts.find((p) => /^[A-Za-z]{3,}$/.test(p)) ?? '').toUpperCase().slice(0, 3),
    time: null,
  }
}

/** True only when the ISO start time carries a real clock time (not midnight-only). */
function hasExplicitTime(event: MockEvent): boolean {
  const iso = event.startsAt
  if (!iso || !iso.includes('T')) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

export type AgendaPeriodKey = 'today' | 'this-week' | 'next-week' | 'this-month' | 'later' | 'tba'

export type AgendaGroup = {
  key: AgendaPeriodKey
  label: string
  events: MockEvent[]
}

const PERIOD_ORDER: { key: AgendaPeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This week' },
  { key: 'next-week', label: 'Next week' },
  { key: 'this-month', label: 'Later this month' },
  { key: 'later', label: 'Later' },
  { key: 'tba', label: 'Date to be announced' },
]

function periodBoundaries(now = new Date()) {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  const day = todayStart.getDay() // 0 Sun … 6 Sat
  const daysUntilSunday = (7 - day) % 7
  const thisWeekEnd = new Date(todayStart)
  thisWeekEnd.setDate(thisWeekEnd.getDate() + daysUntilSunday)
  thisWeekEnd.setHours(23, 59, 59, 999)

  const nextWeekEnd = new Date(thisWeekEnd)
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999)

  return { todayEnd, thisWeekEnd, nextWeekEnd, monthEnd }
}

function periodForEvent(event: MockEvent, bounds: ReturnType<typeof periodBoundaries>): AgendaPeriodKey {
  const d = eventStartDate(event)
  if (!d) return 'tba'
  const t = d.getTime()
  if (t <= bounds.todayEnd.getTime()) return 'today'
  if (t <= bounds.thisWeekEnd.getTime()) return 'this-week'
  if (t <= bounds.nextWeekEnd.getTime()) return 'next-week'
  if (t <= bounds.monthEnd.getTime()) return 'this-month'
  return 'later'
}

/**
 * Group an already-sorted (soonest-first) list of events into agenda periods.
 * Preserves input order within each group and only returns non-empty groups.
 */
export function groupEventsByPeriod(events: MockEvent[]): AgendaGroup[] {
  const bounds = periodBoundaries()
  const buckets = new Map<AgendaPeriodKey, MockEvent[]>()
  for (const event of events) {
    const key = periodForEvent(event, bounds)
    const list = buckets.get(key)
    if (list) list.push(event)
    else buckets.set(key, [event])
  }
  return PERIOD_ORDER.map(({ key, label }) => ({ key, label, events: buckets.get(key) ?? [] })).filter(
    (g) => g.events.length > 0,
  )
}

/** Privacy-safe "who is going" summary for cards/rows. */
export function eventGoingSummary(event: MockEvent): { count: string; mutual: string | null } {
  const rsvp = event.rsvpCount ?? 0
  const mutual = event.mutualGoingCount ?? 0
  return {
    count: rsvp > 0 ? `${rsvp} going` : 'Be the first to RSVP',
    mutual: mutual > 0 ? `${mutual} connection${mutual === 1 ? '' : 's'} going` : null,
  }
}
