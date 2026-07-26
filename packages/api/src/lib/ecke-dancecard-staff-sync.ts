import type { EckeDancecardStaffShiftPayload } from './ecke-publish-payload.js'

const STAFF_TITLE_SEP = ' | '

export function parseVolunteerShiftTitle(title: string): { personName: string; role: string } {
  const trimmed = title.trim()
  const idx = trimmed.indexOf(STAFF_TITLE_SEP)
  if (idx >= 0) {
    const personName = trimmed.slice(0, idx).trim()
    const role = trimmed.slice(idx + STAFF_TITLE_SEP.length).trim()
    return {
      personName: personName || trimmed,
      role: role || 'Staff',
    }
  }
  return { personName: trimmed, role: 'Volunteer' }
}

export type DancecardStaffShiftRow = {
  id: string
  event_id: string
  person_name: string
  role: string
  starts_at: string
  ends_at: string
  location_id: string | null
  sort_order: number
}

export function buildDancecardStaffShiftRows(
  eventId: string,
  shifts: EckeDancecardStaffShiftPayload[],
): DancecardStaffShiftRow[] {
  return shifts.map((s) => ({
    id: s.externalKey,
    event_id: eventId,
    person_name: s.personName,
    role: s.role,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    location_id: s.locationId ?? null,
    sort_order: s.sortOrder,
  }))
}

/** PostgREST path to delete staff shifts removed from the published roster. */
export function orphanDancecardStaffShiftsDeletePath(eventId: string, keepShiftIds: string[]): string {
  const base = `dancecard_staff_shifts?event_id=eq.${encodeURIComponent(eventId)}`
  if (keepShiftIds.length === 0) return base
  return `${base}&id=not.in.(${keepShiftIds.map((id) => encodeURIComponent(id)).join(',')})`
}
