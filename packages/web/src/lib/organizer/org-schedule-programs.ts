import { visibilityLabel } from '@/lib/organizer/build-org-checklist'

export type OrgScheduleConvention = {
  id: string
  slug: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  slotCount?: number
}

export type OrgScheduleEvent = {
  id: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  location?: string | null
  visibility?: string | null
  rsvpCount?: number | null
  conventionSlug?: string | null
}

export type ProgramStatusTone = 'success' | 'warning' | 'neutral' | 'accent' | 'danger'

export type OrgProgramRow = {
  id: string
  kind: 'convention' | 'event'
  title: string
  slugOrId: string
  startsAt?: string | null
  endsAt?: string | null
  location?: string | null
  visibility?: string | null
  attendeeCount?: number | null
  statusLabel: string
  statusTone: ProgramStatusTone
  incomplete: boolean
  sortTime: number
}

function parseTime(iso?: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

function eventStatus(ev: OrgScheduleEvent, now: number): { label: string; tone: ProgramStatusTone; incomplete: boolean } {
  const start = ev.startsAt ? new Date(ev.startsAt).getTime() : NaN
  if (!ev.startsAt || Number.isNaN(start)) {
    return { label: 'Needs dates', tone: 'warning', incomplete: true }
  }
  if (start >= now) return { label: 'Upcoming', tone: 'accent', incomplete: false }
  return { label: 'Past', tone: 'neutral', incomplete: false }
}

function conventionStatus(conv: OrgScheduleConvention, now: number): { label: string; tone: ProgramStatusTone; incomplete: boolean } {
  const slots = conv.slotCount ?? 0
  const start = conv.startsAt ? new Date(conv.startsAt).getTime() : NaN
  if (!conv.startsAt || Number.isNaN(start)) {
    return { label: slots > 0 ? 'Needs dates' : 'Needs setup', tone: 'warning', incomplete: true }
  }
  if (slots === 0) {
    return { label: 'Needs schedule', tone: 'warning', incomplete: true }
  }
  if (start >= now) return { label: 'Upcoming', tone: 'accent', incomplete: false }
  return { label: 'Past', tone: 'neutral', incomplete: false }
}

export function buildOrgProgramRows(
  conventions: OrgScheduleConvention[],
  events: OrgScheduleEvent[],
): OrgProgramRow[] {
  const now = Date.now()
  const standalone = events.filter((e) => !e.conventionSlug)
  const rows: OrgProgramRow[] = [
    ...conventions.map((c) => {
      const st = conventionStatus(c, now)
      return {
        id: `conv-${c.slug}`,
        kind: 'convention' as const,
        title: c.title,
        slugOrId: c.slug,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        location: null,
        visibility: null,
        attendeeCount: null,
        statusLabel: st.label,
        statusTone: st.tone,
        incomplete: st.incomplete,
        sortTime: parseTime(c.startsAt),
      }
    }),
    ...standalone.map((ev) => {
      const st = eventStatus(ev, now)
      return {
        id: `ev-${ev.id}`,
        kind: 'event' as const,
        title: ev.title,
        slugOrId: ev.id,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        location: ev.location ?? null,
        visibility: ev.visibility ?? null,
        attendeeCount: ev.rsvpCount ?? null,
        statusLabel: st.label,
        statusTone: st.tone,
        incomplete: st.incomplete,
        sortTime: parseTime(ev.startsAt),
      }
    }),
  ]
  return rows.sort((a, b) => a.sortTime - b.sortTime)
}

export function countUpcomingPrograms(rows: OrgProgramRow[], withinDays = 30): number {
  const now = Date.now()
  const horizon = now + withinDays * 24 * 60 * 60 * 1000
  return rows.filter((r) => {
    if (!r.startsAt) return false
    const t = new Date(r.startsAt).getTime()
    return !Number.isNaN(t) && t >= now && t <= horizon
  }).length
}

export function upcomingProgramRows(rows: OrgProgramRow[], limit = 8): OrgProgramRow[] {
  const now = Date.now()
  return rows
    .filter((r) => r.startsAt && new Date(r.startsAt).getTime() >= now)
    .slice(0, limit)
}

export function formatProgramWhen(startsAt?: string | null, endsAt?: string | null): string {
  if (!startsAt) return 'Date TBD'
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return 'Date TBD'
  const startStr = start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  if (!endsAt) return startStr
  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return startStr
  if (start.toDateString() === end.toDateString()) {
    return `${startStr} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  return `${startStr} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export function formatProgramVisibility(visibility?: string | null): string {
  if (!visibility) return '-'
  const v = visibility.toLowerCase()
  if (v === 'public') return 'Public'
  if (v === 'private') return 'Private'
  if (v === 'members' || v === 'unlisted') return 'Members'
  return visibility
}

export function orgCalendarVisibilityLabel(orgVisibility: string, calendarEnabled: boolean): string {
  if (!calendarEnabled) return 'Disabled'
  return visibilityLabel(orgVisibility)
}
