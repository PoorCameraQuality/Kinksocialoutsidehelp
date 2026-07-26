/** Organizer program grid row (API shape). */
export type OrganizerProgramSlotDto = {
  id: string
  startsAt: string | null
  endsAt: string | null
  title: string
  track: string | null
  trackId: string | null
  trackName: string | null
  trackColor: string | null
  room: string | null
  locationId: string | null
  locationName: string | null
  description: string | null
  sortOrder: number
  isPublished: boolean
  visibility: 'public' | 'staff_only' | 'secret'
  isFrozen: boolean
  updatedAt: string | null
  photoPolicy: 'allowed' | 'restricted' | 'none'
  organizerNotesInternal: string | null
  tagIds: string[]
  tagNames: string[]
}

export type ProgramSlotRow = OrganizerProgramSlotDto

export function isProgramSlotScheduled(slot: Pick<ProgramSlotRow, 'startsAt' | 'endsAt'>): boolean {
  return slot.startsAt != null && slot.endsAt != null
}

export function programSlotRoomLabel(slot: Pick<ProgramSlotRow, 'locationName' | 'room'>): string {
  return (slot.locationName ?? slot.room ?? '').trim()
}

export function mapProgramSlotRow(
  row: Record<string, unknown>,
  tags?: { tagId: string; name: string }[]
): OrganizerProgramSlotDto {
  const tr = row.track_row as { name?: string; color?: string } | null | undefined
  const loc = row.location_row as { name?: string } | null | undefined
  const tagList = tags ?? []
  const rawVis = String(row.visibility ?? 'public')
  const vis: OrganizerProgramSlotDto['visibility'] =
    rawVis === 'staff_only' || rawVis === 'secret' ? rawVis : 'public'
  const rawPhoto = String(row.photo_policy ?? 'allowed')
  const photoPolicy: OrganizerProgramSlotDto['photoPolicy'] =
    rawPhoto === 'restricted' || rawPhoto === 'none' ? rawPhoto : 'allowed'
  return {
    id: String(row.id),
    startsAt: row.starts_at != null ? String(row.starts_at) : null,
    endsAt: row.ends_at != null ? String(row.ends_at) : null,
    title: String(row.title),
    track: (row.track as string | null) ?? null,
    trackId: (row.track_id as string | null) ?? null,
    trackName: tr?.name ?? null,
    trackColor: tr?.color ?? null,
    room: (row.room as string | null) ?? null,
    locationId: (row.location_id as string | null) ?? null,
    locationName: loc?.name ?? null,
    description: (row.description as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    isPublished: row.is_published !== undefined ? Boolean(row.is_published) : true,
    visibility: vis,
    isFrozen: Boolean(row.is_frozen),
    updatedAt: (row.updated_at as string | null) ?? null,
    photoPolicy,
    organizerNotesInternal: (row.organizer_notes_internal as string | null) ?? null,
    tagIds: tagList.map((t) => t.tagId),
    tagNames: tagList.map((t) => t.name),
  }
}
