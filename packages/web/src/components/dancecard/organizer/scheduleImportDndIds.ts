export const DND_STAFF = 'dnd-import-staff--'
export const DND_DUTY = 'dnd-import-duty--'
export const DND_ROW = 'dnd-import-row--'
export const DND_LOC = 'dnd-import-loc--'
export const DND_CELL = 'dnd-import-cell--'
export const DND_LIBROW = 'dnd-import-librow--'
export const DND_BOARDROW = 'dnd-import-boardrow--'

export function staffDragId(name: string) {
  return `${DND_STAFF}${encodeURIComponent(name)}`
}
export function parseStaffDragId(id: string): string | null {
  if (!id.startsWith(DND_STAFF)) return null
  return decodeURIComponent(id.slice(DND_STAFF.length))
}
export function dutyDragId(dutyId: string) {
  return `${DND_DUTY}${dutyId}`
}
export function parseDutyDragId(id: string): string | null {
  if (!id.startsWith(DND_DUTY)) return null
  return id.slice(DND_DUTY.length)
}
export function rowDragId(rowId: string) {
  return `${DND_ROW}${rowId}`
}
export function parseRowDragId(id: string): string | null {
  if (!id.startsWith(DND_ROW)) return null
  return id.slice(DND_ROW.length)
}
export function locDragId(locationName: string) {
  return `${DND_LOC}${encodeURIComponent(locationName)}`
}
export function parseLocDragId(id: string): string | null {
  if (!id.startsWith(DND_LOC)) return null
  return decodeURIComponent(id.slice(DND_LOC.length))
}
export function cellDropId(day: string, hour: number, room: string) {
  return `${DND_CELL}${day}|${hour}|${encodeURIComponent(room)}`
}
export function parseCellDropId(id: string): { day: string; hour: number; room: string } | null {
  if (!id.startsWith(DND_CELL)) return null
  const rest = id.slice(DND_CELL.length)
  const i = rest.indexOf('|')
  const j = rest.indexOf('|', i + 1)
  if (i <= 0 || j <= i) return null
  const day = rest.slice(0, i)
  const hour = Number(rest.slice(i + 1, j))
  const encRoom = rest.slice(j + 1)
  if (!day || !Number.isFinite(hour)) return null
  return { day, hour, room: decodeURIComponent(encRoom) }
}
export function libRowDropId(rowId: string) {
  return `${DND_LIBROW}${rowId}`
}
export function parseLibRowDropId(id: string): string | null {
  if (!id.startsWith(DND_LIBROW)) return null
  return id.slice(DND_LIBROW.length)
}
export function boardSlotDropId(rowId: string) {
  return `${DND_BOARDROW}drop--${rowId}`
}
export function parseBoardSlotDropId(id: string): string | null {
  const p = `${DND_BOARDROW}drop--`
  if (!id.startsWith(p)) return null
  return id.slice(p.length)
}

export function boardRowDragId(rowId: string) {
  return `${DND_BOARDROW}${rowId}`
}
export function parseBoardRowDragId(id: string): string | null {
  if (!id.startsWith(DND_BOARDROW)) return null
  const rest = id.slice(DND_BOARDROW.length)
  if (rest.startsWith('drop--')) return null
  return rest
}

export function activeDragFromDndId(activeId: string):
  | { type: 'row'; rowId: string }
  | { type: 'staff'; staffName: string }
  | { type: 'location'; locationName: string }
  | { type: 'duty'; dutyId: string }
  | null {
  const s = parseStaffDragId(activeId)
  if (s) return { type: 'staff', staffName: s }
  const d = parseDutyDragId(activeId)
  if (d) return { type: 'duty', dutyId: d }
  const r = parseRowDragId(activeId)
  if (r) return { type: 'row', rowId: r }
  const b = parseBoardRowDragId(activeId)
  if (b) return { type: 'row', rowId: b }
  const l = parseLocDragId(activeId)
  if (l) return { type: 'location', locationName: l }
  return null
}
