import type { ProgramSlotRow } from '@/lib/organizer/conventionProgramApi'

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

export type VenueColumn = { id: string; name: string }

/** Column id uses `__room_<name>` to match ECKE venue grid conventions. */
export function roomColumnId(name: string): string {
  return `__room_${name.trim()}`
}

export function columnRoomName(colId: string): string {
  return colId.startsWith('__room_') ? colId.slice('__room_'.length) : colId
}

export function slotMatchesVenueColumn(slot: Pick<ProgramSlotRow, 'room'>, colId: string): boolean {
  const rn = columnRoomName(colId)
  return (slot.room ?? '').trim() === rn
}

function slotsTimeOverlap(a: ProgramSlotRow, b: ProgramSlotRow): boolean {
  const a0 = new Date(a.startsAt).getTime()
  const a1 = new Date(a.endsAt).getTime()
  const b0 = new Date(b.startsAt).getTime()
  const b1 = new Date(b.endsAt).getTime()
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(b0) || !Number.isFinite(b1)) return false
  return intervalsOverlap(a0, a1, b0, b1)
}

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

export function buildVenueAutoAssignments(
  slots: ProgramSlotRow[],
  leafColumnIds: string[],
  opts?: { candidateSlots?: ProgramSlotRow[] },
): VenueAutoAssignRow[] {
  const assigned = new Map<string, string>()
  for (const s of slots) {
    const room = (s.room ?? '').trim()
    if (room) assigned.set(s.id, roomColumnId(room))
  }

  const candidatePool = opts?.candidateSlots ?? slots
  const candidates = candidatePool
    .filter((s) => !(s.room ?? '').trim())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() || a.title.localeCompare(b.title))

  const picks: VenueAutoAssignRow[] = []

  for (const slot of candidates) {
    if (assigned.has(slot.id)) continue
    for (const colId of leafColumnIds) {
      const virtualSlots: ProgramSlotRow[] = slots.map((s) => {
        const pickCol = assigned.get(s.id)
        if (!pickCol) return s
        return { ...s, room: columnRoomName(pickCol) }
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

export function formatVenueConflictMessage(moving: ProgramSlotRow, conflicts: ProgramSlotRow[], colId: string): string {
  const room = columnRoomName(colId)
  const others = conflicts.map((c) => `"${c.title}"`).join(', ')
  return `"${moving.title}" overlaps in time with ${others} in ${room}. Assign both to the same room anyway?`
}

export function buildLeafColumns(slots: ProgramSlotRow[], venueRooms: string[]): VenueColumn[] {
  const names = new Set<string>()
  for (const r of venueRooms) {
    const t = r.trim()
    if (t) names.add(t)
  }
  for (const s of slots) {
    const t = (s.room ?? '').trim()
    if (t) names.add(t)
  }
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ id: roomColumnId(name), name }))
}

export function slotsForVenueCell(
  daySlots: ProgramSlotRow[],
  colId: string,
  rowLabel: string,
  day: string,
  timezone: string,
): ProgramSlotRow[] {
  if (!day) return []
  return daySlots.filter((s) => {
    const st = formatHmInTz(s.startsAt, timezone)
    if (st !== rowLabel) return false
    return slotMatchesVenueColumn(s, colId)
  })
}

function formatHmInTz(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso))
}

export function buildVenueTimeRows(daySlots: ProgramSlotRow[], timezone: string, day: string) {
  const occupied = new Set<string>()
  for (const s of daySlots) {
    const d = formatDayInTz(s.startsAt, timezone)
    if (d !== day) continue
    occupied.add(formatHmInTz(s.startsAt, timezone))
  }

  if (occupied.size === 0) {
    const rows: { key: string; label: string }[] = []
    for (let h = 8; h < 22; h++) {
      for (const m of [0, 30]) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        rows.push({ key: `${day}-${label}`, label })
      }
    }
    return rows
  }

  let minM = 24 * 60
  let maxM = 0
  for (const label of occupied) {
    const m = parseHm(label)
    minM = Math.min(minM, m)
    maxM = Math.max(maxM, m)
  }
  minM = Math.max(0, minM - 30)
  maxM = Math.min(24 * 60 - 30, maxM + 60)

  const step = occupied.size > 24 ? 60 : 30
  const rows: { key: string; label: string }[] = []
  for (let t = minM; t <= maxM; t += step) {
    const label = formatHm(t)
    rows.push({ key: `${day}-${label}`, label })
  }
  return rows
}

function parseHm(label: string) {
  const [h, m] = label.split(':').map((x) => Number(x))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function formatHm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatDayInTz(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
}
