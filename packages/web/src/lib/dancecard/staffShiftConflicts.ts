import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'

export type StaffShiftConflict = {
  shiftId: string
  personName: string
  role: string
  locationId: string | null
  startsAt: string
  endsAt: string
}

export function staffShiftPersonKey(s: Pick<OrganizerStaffShiftDto, 'personId' | 'personName'>) {
  return s.personId ?? `name:${s.personName}`
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

export function findStaffShiftConflicts(
  existing: OrganizerStaffShiftDto[],
  candidate: {
    personId: string | null
    personName: string
    startsAt: string
    endsAt: string
    excludeShiftId?: string
    claimedByAccountId?: string | null
  },
): StaffShiftConflict[] {
  const key = candidate.personId ? candidate.personId : `name:${candidate.personName}`
  const c0 = new Date(candidate.startsAt).getTime()
  const c1 = new Date(candidate.endsAt).getTime()
  if (!Number.isFinite(c0) || !Number.isFinite(c1) || c1 <= c0) return []

  const out: StaffShiftConflict[] = []
  for (const s of existing) {
    if (candidate.excludeShiftId && s.id === candidate.excludeShiftId) continue
    if (s.shiftStatus === 'draft' || s.shiftStatus === 'dropped') continue
    const sKey = staffShiftPersonKey(s)
    const match = candidate.claimedByAccountId
      ? s.claimedByAccountId === candidate.claimedByAccountId
      : candidate.personId
        ? s.personId === candidate.personId
        : sKey === key
    if (!match) continue
    const a0 = new Date(s.startsAt).getTime()
    const a1 = new Date(s.endsAt).getTime()
    if (!Number.isFinite(a0) || !Number.isFinite(a1)) continue
    if (!intervalsOverlap(a0, a1, c0, c1)) continue
    out.push({
      shiftId: s.id,
      personName: s.personName,
      role: s.role,
      locationId: s.locationId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    })
  }
  return out
}

export function formatStaffShiftConflictList(conflicts: StaffShiftConflict[], timezone: string): string {
  if (!conflicts.length) return ''
  return conflicts
    .map((c) => {
      const start = new Date(c.startsAt).toLocaleString('en-US', { timeZone: timezone, weekday: 'short', hour: 'numeric' })
      const end = new Date(c.endsAt).toLocaleString('en-US', { timeZone: timezone, hour: 'numeric' })
      return `${c.role.replace(/_/g, ' ')} (${start} – ${end})`
    })
    .join('\n')
}
