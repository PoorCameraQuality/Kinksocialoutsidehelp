/** Normalize import API responses (camelCase) for UI types (snake_case). */

export type ApiImportBatch = {
  id: string
  kind: string
  status: string
  sourceFilename?: string | null
  source_filename?: string | null
  sheetName?: string | null
  sheet_name?: string | null
  summary?: { total?: number; valid?: number; invalid?: number }
  columnMapping?: Record<string, string>
}

export type ApiImportRow = {
  id: string
  rowKey?: string
  row_key?: string
  kind: string
  action?: string
  draftStatus?: string
  draft_status?: string
  title?: string | null
  personName?: string | null
  person_name?: string | null
  role?: string | null
  track?: string | null
  room?: string | null
  locationId?: string | null
  location_id?: string | null
  startsAt?: string | null
  starts_at?: string | null
  endsAt?: string | null
  ends_at?: string | null
  description?: string | null
  sortOrder?: number
  sort_order?: number
  validationErrors?: string[]
  validation_errors?: string[]
}

export function normalizeImportBatch(batch: ApiImportBatch) {
  return {
    id: batch.id,
    kind: batch.kind as 'program' | 'staff' | 'event',
    status: batch.status,
    source_filename: batch.sourceFilename ?? batch.source_filename ?? null,
    sheet_name: batch.sheetName ?? batch.sheet_name ?? null,
    summary: batch.summary ?? {},
  }
}

export function normalizeImportRow(row: ApiImportRow) {
  const errors = row.validationErrors ?? row.validation_errors ?? []
  const startsAt = row.startsAt ?? row.starts_at ?? null
  const endsAt = row.endsAt ?? row.ends_at ?? null
  let draftStatus = (row.draftStatus ?? row.draft_status ?? 'unplaced') as
    | 'unplaced'
    | 'placed'
    | 'invalid'
    | 'ignored'
  if (errors.length && draftStatus === 'unplaced') draftStatus = 'invalid'
  if (startsAt && endsAt && draftStatus === 'unplaced') draftStatus = 'placed'

  return {
    id: row.id,
    row_key: row.rowKey ?? row.row_key ?? row.id,
    kind: row.kind as 'program' | 'staff',
    action: row.action ?? 'add',
    draft_status: draftStatus,
    title: row.title ?? null,
    person_name: row.personName ?? row.person_name ?? null,
    role: row.role ?? null,
    track: row.track ?? null,
    room: row.room ?? null,
    location_id: row.locationId ?? row.location_id ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    duration_minutes: null as number | null,
    description: row.description ?? null,
    validation_errors: errors,
    sort_order: row.sortOrder ?? row.sort_order ?? 0,
  }
}
