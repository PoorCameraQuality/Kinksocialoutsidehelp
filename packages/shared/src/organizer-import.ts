/** Deterministic spreadsheet import - column mapping + header aliases (no AI). */

export type ImportKind = 'program' | 'staff'

export type ImportFormat = 'flat_rows' | 'program_grid'

export type CanonicalField =
  | 'title'
  | 'startsAt'
  | 'endsAt'
  | 'room'
  | 'track'
  | 'description'
  | 'personName'
  | 'role'
  | 'importKey'
  | 'presenterUsernames'
  | 'linkUrl'

export type ColumnMapping = Partial<Record<CanonicalField, string>>

export const PROGRAM_FIELDS: CanonicalField[] = [
  'title',
  'startsAt',
  'endsAt',
  'room',
  'track',
  'description',
  'presenterUsernames',
  'linkUrl',
  'importKey',
]

export const STAFF_FIELDS: CanonicalField[] = ['personName', 'role', 'startsAt', 'endsAt', 'room', 'importKey']

export const FIELD_LABELS: Record<CanonicalField, string> = {
  title: 'Class / session title',
  startsAt: 'Start date & time',
  endsAt: 'End date & time',
  room: 'Room / location',
  track: 'Track',
  description: 'Description',
  personName: 'Person name',
  role: 'Role / duty',
  importKey: 'Stable ID (optional)',
  presenterUsernames: 'Presenter usernames',
  linkUrl: 'Link URL',
}

/** Normalized header → canonical field. First match wins per column. */
export const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  title: ['title', 'session', 'class', 'class name', 'name', 'event', 'activity', 'workshop'],
  startsAt: ['starts_at', 'starts at', 'start', 'start time', 'begin', 'starts', 'from', 'start datetime'],
  endsAt: ['ends_at', 'ends at', 'end', 'end time', 'finish', 'ends', 'to', 'end datetime'],
  room: ['room', 'location', 'space', 'venue', 'room name', 'play space'],
  track: ['track', 'track name', 'series', 'category', 'type'],
  description: ['description', 'details', 'summary', 'notes', 'abstract'],
  personName: ['person', 'person name', 'name', 'volunteer', 'staff', 'scene name', 'display name'],
  role: ['role', 'duty', 'shift', 'assignment', 'position', 'job'],
  importKey: ['import_key', 'import key', 'id', 'key', 'external id', 'slot id'],
  presenterUsernames: ['presenter', 'presenters', 'presenter usernames', 'instructor', 'teachers', 'facilitator'],
  linkUrl: ['link', 'link url', 'url', 'website'],
}

export type ParsedImportRow = {
  rowKey: string
  title?: string
  personName?: string
  role?: string
  track?: string
  room?: string
  locationId?: string
  description?: string
  startsAt?: string
  endsAt?: string
  importKey?: string
  presenterUsernames?: string
  linkUrl?: string
  validationErrors: string[]
  raw: Record<string, string>
}

function normHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function fieldsForKind(kind: ImportKind): CanonicalField[] {
  return kind === 'staff' ? STAFF_FIELDS : PROGRAM_FIELDS
}

export function detectHeaderRowIndex(rawRows: string[][], maxScan = 8): number {
  if (!rawRows.length) return 0
  let bestIdx = 0
  let bestScore = -1
  const limit = Math.min(maxScan, rawRows.length)
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i] ?? []
    const nonEmpty = row.filter((c) => String(c).trim()).length
    if (nonEmpty < 2) continue
    let aliasHits = 0
    for (const cell of row) {
      const n = normHeader(cell)
      for (const aliases of Object.values(HEADER_ALIASES)) {
        if (aliases.some((a) => normHeader(a) === n)) {
          aliasHits++
          break
        }
      }
    }
    const score = aliasHits * 10 + nonEmpty
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

export function headerLabelsFromRow(rawRows: string[][], headerRowIndex: number): string[] {
  const row = rawRows[headerRowIndex] ?? []
  const labels: string[] = []
  for (let i = 0; i < row.length; i++) {
    const label = String(row[i] ?? '').trim()
    labels.push(label || `Column ${columnLetter(i)}`)
  }
  return labels
}

export function columnLetter(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

export function suggestColumnMapping(
  headers: string[],
  kind: ImportKind,
): ColumnMapping {
  const mapping: ColumnMapping = {}
  const normToHeader = new Map(headers.map((h) => [normHeader(h), h]))
  for (const field of fieldsForKind(kind)) {
    for (const alias of HEADER_ALIASES[field]) {
      const hit = normToHeader.get(normHeader(alias))
      if (hit) {
        mapping[field] = hit
        break
      }
    }
  }
  return mapping
}

function pickCell(row: Record<string, string>, header: string | undefined): string {
  if (!header) return ''
  return String(row[header] ?? '').trim()
}

function parseDateValue(raw: string): string | null {
  if (!raw) return null
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return null
}

function validateParsedRow(row: ParsedImportRow, kind: ImportKind): string[] {
  const errors = [...row.validationErrors]
  if (kind === 'program') {
    if (!row.title) errors.push('Missing title')
    if (row.startsAt && !row.endsAt) errors.push('Missing end time')
    if (!row.startsAt && row.endsAt) errors.push('Missing start time')
    if (row.startsAt && row.endsAt && new Date(row.endsAt) <= new Date(row.startsAt)) {
      errors.push('End must be after start')
    }
  } else {
    if (!row.personName && !row.role && !row.startsAt) {
      errors.push('Need person, role, or scheduled time')
    }
    if (row.startsAt && row.endsAt && new Date(row.endsAt) <= new Date(row.startsAt)) {
      errors.push('End must be after start')
    }
  }
  return Array.from(new Set(errors))
}

export function parseFlatRowsWithMapping(
  rawRows: string[][],
  kind: ImportKind,
  opts?: { headerRowIndex?: number; columnMapping?: ColumnMapping },
): {
  headerRowIndex: number
  headers: string[]
  columnMapping: ColumnMapping
  rows: ParsedImportRow[]
  unmappedHeaders: string[]
} {
  const headerRowIndex = opts?.headerRowIndex ?? detectHeaderRowIndex(rawRows)
  const headers = headerLabelsFromRow(rawRows, headerRowIndex)
  const columnMapping = opts?.columnMapping ?? suggestColumnMapping(headers, kind)
  const mappedHeaders = new Set(Object.values(columnMapping).filter(Boolean))
  const unmappedHeaders = headers.filter((h) => !mappedHeaders.has(h))

  const rows: ParsedImportRow[] = []
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const line = rawRows[i] ?? []
    if (!line.some((c) => String(c).trim())) continue
    const record: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]!] = String(line[c] ?? '').trim()
    }
    const title = pickCell(record, columnMapping.title)
    const startsRaw = pickCell(record, columnMapping.startsAt)
    const endsRaw = pickCell(record, columnMapping.endsAt)
    const parsed: ParsedImportRow = {
      rowKey: `row-${i}`,
      title: title || undefined,
      personName: pickCell(record, columnMapping.personName) || undefined,
      role: pickCell(record, columnMapping.role) || undefined,
      track: pickCell(record, columnMapping.track) || undefined,
      room: pickCell(record, columnMapping.room) || undefined,
      description: pickCell(record, columnMapping.description) || undefined,
      importKey: pickCell(record, columnMapping.importKey) || undefined,
      presenterUsernames: pickCell(record, columnMapping.presenterUsernames) || undefined,
      linkUrl: pickCell(record, columnMapping.linkUrl) || undefined,
      startsAt: parseDateValue(startsRaw) ?? undefined,
      endsAt: parseDateValue(endsRaw) ?? undefined,
      validationErrors: [],
      raw: record,
    }
    if (!title && !parsed.personName && !startsRaw) continue
    if (startsRaw && !parsed.startsAt) parsed.validationErrors.push('Could not parse start time')
    if (endsRaw && !parsed.endsAt) parsed.validationErrors.push('Could not parse end time')
    parsed.validationErrors = validateParsedRow(parsed, kind)
    rows.push(parsed)
  }

  return { headerRowIndex, headers, columnMapping, rows, unmappedHeaders }
}

export function templateCsvHeaders(kind: ImportKind): string[] {
  if (kind === 'staff') {
    return ['personName', 'role', 'startsAt', 'endsAt', 'room', 'importKey']
  }
  return ['title', 'startsAt', 'endsAt', 'room', 'track', 'description', 'presenterUsernames', 'linkUrl', 'importKey']
}

export function templateCsvExampleRow(kind: ImportKind): string[] {
  if (kind === 'staff') {
    return [
      'Alex Volunteer',
      'Door / Check-in',
      '2026-06-12T09:00:00-04:00',
      '2026-06-12T11:00:00-04:00',
      'Lobby',
      'shift-001',
    ]
  }
  return [
    'Rope 101',
    '2026-06-12T10:00:00-04:00',
    '2026-06-12T11:30:00-04:00',
    'Main Hall',
    'Classes',
    'Introductory rope bondage',
    'class-001',
  ]
}

export function buildTemplateCsv(kind: ImportKind): string {
  const headers = templateCsvHeaders(kind)
  const example = templateCsvExampleRow(kind)
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return `${headers.join(',')}\n${example.map(esc).join(',')}\n`
}

/** Normalize JSON paste rows (start/end aliases) before API POST. */
export function normalizeJsonImportRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>
    const startsAt =
      o.startsAt ?? o.starts_at ?? o.start ?? o.startTime ?? o.begin
    const endsAt = o.endsAt ?? o.ends_at ?? o.end ?? o.endTime ?? o.finish
    const personName = o.personName ?? o.person_name ?? o.person ?? o.name ?? o.volunteer
    return {
      rowKey: String(o.rowKey ?? o.row_key ?? o.id ?? i),
      title: typeof o.title === 'string' ? o.title : undefined,
      personName: typeof personName === 'string' ? personName : undefined,
      role: typeof o.role === 'string' ? o.role : undefined,
      track: typeof o.track === 'string' ? o.track : undefined,
      room: typeof o.room === 'string' ? o.room : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
      startsAt: typeof startsAt === 'string' ? startsAt : undefined,
      endsAt: typeof endsAt === 'string' ? endsAt : undefined,
      importKey: typeof o.importKey === 'string' ? o.importKey : undefined,
    }
  })
}
