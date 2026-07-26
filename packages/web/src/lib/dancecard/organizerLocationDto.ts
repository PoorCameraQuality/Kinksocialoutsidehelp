export type OrganizerLocationDto = {
  id: string
  name: string
  shortName: string | null
  capacity: number | null
  notes: string | null
  sortOrder: number
  parentId: string | null
  kind: string | null
  accessibilityNotes: string | null
  directionsPublic: string | null
  internalNotes: string | null
}

export function mapDbLocationToDto(row: {
  id: string
  name: string
  short_name?: string | null
  capacity?: number | null
  notes?: string | null
  sort_order?: number | null
  parent_id?: string | null
  kind?: string | null
  accessibility_notes?: string | null
  directions_public?: string | null
  internal_notes?: string | null
}): OrganizerLocationDto {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? null,
    capacity: row.capacity ?? null,
    notes: row.notes ?? null,
    sortOrder: row.sort_order ?? 0,
    parentId: row.parent_id ?? null,
    kind: row.kind ?? null,
    accessibilityNotes: row.accessibility_notes ?? null,
    directionsPublic: row.directions_public ?? null,
    internalNotes: row.internal_notes ?? null,
  }
}
