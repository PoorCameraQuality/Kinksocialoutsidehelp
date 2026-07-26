import type { ScheduleSlot } from './convention-schedule-types'

export function dayHeading(iso: string, timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function sortSlotsForAgenda(list: ScheduleSlot[]): ScheduleSlot[] {
  return [...list].sort((a, b) => {
    const sa = new Date(a.startsAt).getTime()
    const sb = new Date(b.startsAt).getTime()
    if (sa !== sb) return sa - sb
    const ea = new Date(a.endsAt).getTime()
    const eb = new Date(b.endsAt).getTime()
    if (ea !== eb) return ea - eb
    return a.title.localeCompare(b.title)
  })
}

/** Group sorted slots under long-form day headings in a fixed IANA zone (conventions, imports). */
export function slotsGroupedByDay(slots: ScheduleSlot[], timeZone: string): { day: string; items: ScheduleSlot[] }[] {
  const sorted = sortSlotsForAgenda(slots)
  const map = new Map<string, ScheduleSlot[]>()
  for (const s of sorted) {
    const label = dayHeading(s.startsAt, timeZone)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(s)
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
}
