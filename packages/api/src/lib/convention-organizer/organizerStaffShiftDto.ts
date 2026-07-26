export type OrganizerStaffShiftDto = {
  id: string
  personId: string | null
  personName: string
  role: string
  locationId: string | null
  startsAt: string
  endsAt: string
  sortOrder: number
  shiftStatus: string
  claimedByAccountId: string | null
  organizerNotesStaffOnly: string | null
  droppedAt: string | null
}

export function mapStaffShiftRow(r: Record<string, unknown>): OrganizerStaffShiftDto {
  return {
    id: String(r.id),
    personId: (r.person_id as string | null) ?? null,
    personName: String(r.person_name ?? ''),
    role: String(r.role ?? ''),
    locationId: (r.location_id as string | null) ?? null,
    startsAt: String(r.starts_at ?? ''),
    endsAt: String(r.ends_at ?? ''),
    sortOrder: Number(r.sort_order ?? 0),
    shiftStatus: String(r.shift_status ?? 'assigned'),
    claimedByAccountId: (r.claimed_by_account_id as string | null) ?? null,
    organizerNotesStaffOnly: (r.organizer_notes_staff_only as string | null) ?? null,
    droppedAt: (r.dropped_at as string | null) ?? null,
  }
}
