import type { MockEvent } from '@/data/types'
import { mediaDisplayUrl } from '@/lib/media-display-url'

function parseEventDate(dateStr: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr) || dateStr.includes('T')) {
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) return d
  }
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  }
  // Prefer an explicit year so past festivals (e.g. "Thu, Sep 21, 2023") are not
  // reinterpreted as the current year and wrongly treated as upcoming.
  const withYear = dateStr.match(
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\w{3})\s+(\d{1,2}),?\s+(\d{4})/i,
  )
  if (withYear) {
    const mo = monthMap[withYear[1]!.slice(0, 3)]
    if (mo != null) return new Date(Number(withYear[3]), mo, Number(withYear[2]))
  }
  const short = dateStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\w{3})\s+(\d{1,2})/i)
  if (short) {
    const mo = monthMap[short[2]!.slice(0, 3)]
    if (mo != null) {
      const y = new Date().getFullYear()
      return new Date(y, mo, Number(short[3]))
    }
  }
  return null
}

export function eventStartDate(event: MockEvent): Date | null {
  return parseEventDate(event.startsAt ?? event.date)
}

/**
 * True when the event has not started yet.
 * Unknown / unparseable dates are treated as not upcoming so discovery rails
 * ("Upcoming near you") never advertise past or undated seed rows.
 */
export function isUpcomingEvent(event: MockEvent, now = Date.now()): boolean {
  const d = eventStartDate(event)
  return d ? d.getTime() >= now : false
}

/** Left column date block: FRI / MAY 15 */
const INTERNAL_EVENT_TAG_RE = /^(c2k-seed|preview-rich|gated-program-demo)$/i

export function filterPublicEventTags(tags: string[] | undefined | null): string[] {
  return (tags ?? []).filter((t) => t.trim() && !INTERNAL_EVENT_TAG_RE.test(t.trim()))
}

export function formatEventLocationForDisplay(location: string, isVirtual: boolean): string {
  const trimmed = location.trim()
  if (isVirtual && /^https?:\/\//i.test(trimmed)) return 'Online · details after RSVP'
  if (isVirtual && (!trimmed || trimmed === 'TBA')) return 'Online event'
  return location
}

export function formatEventListDateBlock(event: MockEvent): { weekday: string; monthDay: string } {
  const d = eventStartDate(event)
  if (d) {
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      monthDay: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase(),
    }
  }
  const parts = event.date.split(/[,\s]+/).filter(Boolean)
  return {
    weekday: (parts[0] ?? 'TBD').toUpperCase().slice(0, 3),
    monthDay: (parts.slice(1).join(' ') || event.date).toUpperCase(),
  }
}

export type EventsScopeTab = 'all' | 'for-you' | 'weekend' | 'next7' | 'month'

export function filterEventsByScope(events: MockEvent[], scope: EventsScopeTab): MockEvent[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (scope === 'all') return events
  if (scope === 'for-you') {
    return [...events].sort((a, b) => {
      const mf = (b.mutualGoingCount ?? 0) - (a.mutualGoingCount ?? 0)
      if (mf !== 0) return mf
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
    })
  }

  return events.filter((e) => {
    const d = eventStartDate(e)
    if (!d) return false
    const t = d.getTime()

    if (scope === 'next7') {
      const end = new Date(now)
      end.setDate(end.getDate() + 7)
      return t >= now.getTime() && t <= end.getTime()
    }

    if (scope === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t >= now.getTime()
    }

    if (scope === 'weekend') {
      const day = now.getDay()
      const daysUntilSat = (6 - day + 7) % 7 || 7
      const sat = new Date(now)
      sat.setDate(sat.getDate() + daysUntilSat)
      const sun = new Date(sat)
      sun.setDate(sun.getDate() + 1)
      sun.setHours(23, 59, 59, 999)
      sat.setHours(0, 0, 0, 0)
      return t >= sat.getTime() && t <= sun.getTime()
    }

    return true
  })
}

export function countEventsByCategory(events: MockEvent[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of events) {
    const cat = e.category ?? 'Social'
    m.set(cat, (m.get(cat) ?? 0) + 1)
  }
  return m
}

export const EVENTS_PAGE_SIZE = 8

export function paginateEvents<T>(items: T[], page: number, pageSize = EVENTS_PAGE_SIZE): { slice: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return { slice: items.slice(start, start + pageSize), totalPages }
}

/** Cover photo for cards/lists — resolves uploaded `/uploads/…` paths via API base URL. */
export function resolveEventHeroUrl(event: {
  imageUrl?: string | null
  bannerUrl?: string | null
}): string | undefined {
  return mediaDisplayUrl(event.imageUrl ?? event.bannerUrl ?? undefined)
}
