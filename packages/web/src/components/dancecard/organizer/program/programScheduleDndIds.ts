export const PROGRAM_UNASSIGNED_POOL_ID = 'program-unassigned-pool'

export function programSlotDragId(slotId: string) {
  return `program-slot:${slotId}`
}

export function programCellDropId(day: string, row: number) {
  return `program-cell:${day}:${row}`
}

export function parseProgramSlotDragId(id: string): string | null {
  const prefix = 'program-slot:'
  return id.startsWith(prefix) ? id.slice(prefix.length) : null
}

export function parseProgramCellDropId(id: string): { day: string; row: number } | null {
  const prefix = 'program-cell:'
  if (!id.startsWith(prefix)) return null
  const rest = id.slice(prefix.length)
  const lastColon = rest.lastIndexOf(':')
  if (lastColon < 0) return null
  const day = rest.slice(0, lastColon)
  const row = Number(rest.slice(lastColon + 1))
  if (!day || !Number.isFinite(row)) return null
  return { day, row }
}
