import type { EckeDancecardSlotPayload } from './ecke-publish-payload.js'

export type DancecardSlotRow = {
  id: string
  event_id: string
  starts_at: string
  ends_at: string
  title: string
  track: string | null
  room: string | null
  location_id: string | null
  description: string | null
  sort_order: number
}

/** Map C2K slot ids (externalKey) to ECKE rows so attendee selections survive republish. */
export function buildDancecardSlotRows(eventId: string, slots: EckeDancecardSlotPayload[]): DancecardSlotRow[] {
  return slots.map((s) => ({
    id: s.externalKey,
    event_id: eventId,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    title: s.title,
    track: s.track ?? null,
    room: s.room ?? null,
    location_id: s.locationId ?? null,
    description: s.description ?? null,
    sort_order: s.sortOrder,
  }))
}

/** PostgREST path to delete slots removed from the published program (not delete-all). */
export function orphanDancecardSlotsDeletePath(eventId: string, keepSlotIds: string[]): string {
  const base = `dancecard_program_slots?event_id=eq.${encodeURIComponent(eventId)}`
  if (keepSlotIds.length === 0) return base
  return `${base}&id=not.in.(${keepSlotIds.map((id) => encodeURIComponent(id)).join(',')})`
}
