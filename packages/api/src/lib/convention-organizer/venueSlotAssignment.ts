import { isProgramSlotScheduled, type ProgramSlotRow } from './organizerProgramSlotDto.js'

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

/** Column id from venue grid: location uuid or legacy `__room_Name`. */
export function slotMatchesVenueColumn(
  slot: Pick<ProgramSlotRow, 'locationId' | 'room'>,
  colId: string,
): boolean {
  if (colId.startsWith('__room_')) {
    const rn = colId.replace('__room_', '')
    return !slot.locationId && (slot.room ?? '').trim() === rn
  }
  return slot.locationId === colId
}

export function venueColumnLabel(
  colId: string,
  locationNames: Record<string, string>,
): string {
  if (colId.startsWith('__room_')) return colId.replace('__room_', '')
  return locationNames[colId] ?? 'this room'
}

function slotsTimeOverlap(a: ProgramSlotRow, b: ProgramSlotRow): boolean {
  if (!a.startsAt || !b.startsAt) return false
  if (isProgramSlotScheduled(a) && isProgramSlotScheduled(b)) {
    const a0 = new Date(a.startsAt).getTime()
    const a1 = new Date(a.endsAt!).getTime()
    const b0 = new Date(b.startsAt).getTime()
    const b1 = new Date(b.endsAt!).getTime()
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(b0) || !Number.isFinite(b1)) return false
    return intervalsOverlap(a0, a1, b0, b1)
  }
  return a.startsAt === b.startsAt
}

/** Other slots that would double-book the target room/location with `slotId`. */
export function findVenueLocationConflicts(
  slots: ProgramSlotRow[],
  slotId: string,
  targetColId: string,
): ProgramSlotRow[] {
  const moving = slots.find((s) => s.id === slotId)
  if (!moving) return []

  return slots.filter((s) => {
    if (s.id === slotId) return false
    if (!slotMatchesVenueColumn(s, targetColId)) return false
    return slotsTimeOverlap(moving, s)
  })
}

export type VenueAutoAssignRow = { slotId: string; colId: string }

/**
 * Greedy auto-assign: unchanged existing locations; each unassigned scheduled slot
 * goes to the first leaf column with no time conflict (including prior auto picks).
 */
export function buildVenueAutoAssignments(
  slots: ProgramSlotRow[],
  leafColumnIds: string[],
  opts?: { onlyUnassigned?: boolean; candidateSlots?: ProgramSlotRow[] },
): VenueAutoAssignRow[] {
  const onlyUnassigned = opts?.onlyUnassigned !== false
  const assigned = new Map<string, string>()

  for (const s of slots) {
    if (!s.startsAt) continue
    if (s.locationId) {
      assigned.set(s.id, s.locationId)
      continue
    }
    const room = (s.room ?? '').trim()
    if (room) assigned.set(s.id, `__room_${room}`)
  }

  const candidatePool = opts?.candidateSlots ?? slots
  const candidates = candidatePool
    .filter((s) => {
      if (!isProgramSlotScheduled(s)) return false
      if (onlyUnassigned && (s.locationId || (s.room ?? '').trim())) return false
      return true
    })
    .sort((a, b) => {
      const t = new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime()
      if (t !== 0) return t
      return a.title.localeCompare(b.title)
    })

  const picks: VenueAutoAssignRow[] = []

  for (const slot of candidates) {
    if (assigned.has(slot.id)) continue
    for (const colId of leafColumnIds) {
      const virtualSlots: ProgramSlotRow[] = slots.map((s) => {
        const pickCol = assigned.get(s.id)
        if (!pickCol) return s
        if (pickCol.startsWith('__room_')) {
          return { ...s, locationId: null, room: pickCol.replace('__room_', '') }
        }
        return { ...s, locationId: pickCol, room: null }
      })
      const conflicts = findVenueLocationConflicts(virtualSlots, slot.id, colId)
      if (conflicts.length === 0) {
        assigned.set(slot.id, colId)
        picks.push({ slotId: slot.id, colId })
        break
      }
    }
  }

  return picks
}

export function formatVenueConflictMessage(
  moving: ProgramSlotRow,
  conflicts: ProgramSlotRow[],
  colId: string,
  locationNames: Record<string, string>,
): string {
  const room = venueColumnLabel(colId, locationNames)
  const others = conflicts.map((c) => `“${c.title}”`).join(', ')
  return `“${moving.title}” overlaps in time with ${others} in ${room}. Assign both to the same room anyway?`
}
