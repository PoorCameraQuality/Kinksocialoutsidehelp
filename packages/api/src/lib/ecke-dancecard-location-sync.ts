export type EckeDancecardLocationPayload = {
  externalKey: string
  name: string
  shortName?: string | null
  capacity?: number | null
  sortOrder: number
  parentId?: string | null
}

export type DancecardLocationRow = {
  id: string
  event_id: string
  name: string
  short_name: string | null
  capacity: number | null
  sort_order: number
  parent_id: string | null
}

/** Map C2K convention_locations ids to ECKE dancecard_locations rows. */
export function buildDancecardLocationRows(
  eventId: string,
  locations: EckeDancecardLocationPayload[],
): DancecardLocationRow[] {
  return locations.map((loc) => ({
    id: loc.externalKey,
    event_id: eventId,
    name: loc.name,
    short_name: loc.shortName ?? null,
    capacity: loc.capacity ?? null,
    sort_order: loc.sortOrder,
    parent_id: loc.parentId ?? null,
  }))
}

/** PostgREST path to delete locations removed from the published event. */
export function orphanDancecardLocationsDeletePath(eventId: string, keepLocationIds: string[]): string {
  const base = `dancecard_locations?event_id=eq.${encodeURIComponent(eventId)}`
  if (keepLocationIds.length === 0) return base
  return `${base}&id=not.in.(${keepLocationIds.map((id) => encodeURIComponent(id)).join(',')})`
}
