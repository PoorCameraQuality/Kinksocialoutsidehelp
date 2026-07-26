import { and, eq } from 'drizzle-orm'
import type { ColumnMapping, ImportKind, ParsedImportRow } from '@c2k/shared'
import { matchRoomLabel, type RoomMatchCandidate } from '@c2k/shared'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'

export type InsertImportBatchInput = {
  conventionId: string
  organizerUserId: string
  kind: ImportKind
  sourceFilename: string
  sheetName?: string | null
  columnMapping: ColumnMapping
  importFormat: string
  headerRowIndex: number
  mappingProfileId?: string | null
  rows: ParsedImportRow[]
}

function rowToApiPayload(r: ParsedImportRow, kind: ImportKind) {
  return {
    rowKey: r.rowKey,
    title: r.title,
    personName: r.personName,
    role: r.role,
    track: r.track,
    room: r.room,
    locationId: r.locationId,
    description: r.description,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    importKey: r.importKey,
    presenterUsernames: r.presenterUsernames,
    linkUrl: r.linkUrl,
    validationErrors: r.validationErrors,
    kind,
    raw: r.raw,
  }
}

export function applyRoomMatchesToParsedRows(
  rows: ParsedImportRow[],
  locations: RoomMatchCandidate[],
): ParsedImportRow[] {
  if (!locations.length) return rows
  return rows.map((r) => {
    if (r.locationId || !r.room?.trim()) return r
    const match = matchRoomLabel(r.room, locations)
    if (match.status === 'exact' || match.status === 'fuzzy') {
      return { ...r, locationId: match.locationId }
    }
    const hint =
      match.suggestions.length > 0
        ? `. Did you mean: ${match.suggestions.map((s) => s.name).join(', ')}?`
        : '. Add it in Rooms below'
    return {
      ...r,
      validationErrors: [
        ...r.validationErrors,
        `Unknown room "${r.room}"${hint}`,
      ],
    }
  })
}

export function apiPayloadToParsedRows(
  rows: Array<Record<string, unknown>>,
): ParsedImportRow[] {
  return rows.map((r, i) => {
    const validationErrors = Array.isArray(r.validationErrors)
      ? (r.validationErrors as string[]).filter((e) => typeof e === 'string')
      : []
    const startsAt =
      typeof r.startsAt === 'string'
        ? r.startsAt
        : typeof r.starts_at === 'string'
          ? r.starts_at
          : undefined
    const endsAt =
      typeof r.endsAt === 'string'
        ? r.endsAt
        : typeof r.ends_at === 'string'
          ? r.ends_at
          : undefined
    return {
      rowKey: String(r.rowKey ?? r.row_key ?? r.id ?? i),
      title: typeof r.title === 'string' ? r.title : undefined,
      personName:
        typeof r.personName === 'string'
          ? r.personName
          : typeof r.person_name === 'string'
            ? r.person_name
            : undefined,
      role: typeof r.role === 'string' ? r.role : undefined,
      track: typeof r.track === 'string' ? r.track : undefined,
      room: typeof r.room === 'string' ? r.room : undefined,
      locationId:
        typeof r.locationId === 'string'
          ? r.locationId
          : typeof r.location_id === 'string'
            ? r.location_id
            : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
      startsAt,
      endsAt,
      importKey:
        typeof r.importKey === 'string'
          ? r.importKey
          : typeof r.import_key === 'string'
            ? r.import_key
            : undefined,
      presenterUsernames:
        typeof r.presenterUsernames === 'string'
          ? r.presenterUsernames
          : typeof r.presenter_usernames === 'string'
            ? r.presenter_usernames
            : undefined,
      linkUrl:
        typeof r.linkUrl === 'string'
          ? r.linkUrl
          : typeof r.link_url === 'string'
            ? r.link_url
            : undefined,
      validationErrors,
      raw: (r.raw as Record<string, string>) ?? {},
    }
  })
}

export async function insertImportBatchFromParsed(input: InsertImportBatchInput) {
  const apiRows = input.rows.map((r) => rowToApiPayload(r, input.kind))
  const validCount = apiRows.filter((r) => !r.validationErrors?.length).length
  const [batch] = await db
    .insert(schema.conventionImportBatches)
    .values({
      conventionId: input.conventionId,
      organizerUserId: input.organizerUserId,
      kind: input.kind,
      sourceFilename: input.sourceFilename,
      sheetName: input.sheetName ?? null,
      columnMapping: input.columnMapping ?? {},
      summary: {
        total: apiRows.length,
        valid: validCount,
        invalid: apiRows.length - validCount,
        headerRowIndex: input.headerRowIndex,
        importFormat: input.importFormat,
        mappingProfileId: input.mappingProfileId ?? null,
      },
    })
    .returning()

  const importRows =
    apiRows.length > 0
      ? await db
          .insert(schema.conventionImportRows)
          .values(
            apiRows.map((r, i) => {
              const validationErrors = r.validationErrors ?? []
              let draftStatus: 'unplaced' | 'placed' | 'invalid' = 'unplaced'
              if (validationErrors.length) draftStatus = 'invalid'
              else if (r.startsAt && r.endsAt) draftStatus = 'placed'
              const importKey = typeof r.importKey === 'string' ? r.importKey : undefined
              return {
                batchId: batch!.id,
                conventionId: input.conventionId,
                rowKey: String(r.rowKey ?? i),
                kind: input.kind,
                title: typeof r.title === 'string' ? r.title : undefined,
                personName: typeof r.personName === 'string' ? r.personName : undefined,
                role: typeof r.role === 'string' ? r.role : undefined,
                track: typeof r.track === 'string' ? r.track : undefined,
                room: typeof r.room === 'string' ? r.room : undefined,
                locationId: typeof r.locationId === 'string' ? r.locationId : undefined,
                description: typeof r.description === 'string' ? r.description : undefined,
                startsAt: r.startsAt ? new Date(String(r.startsAt)) : undefined,
                endsAt: r.endsAt ? new Date(String(r.endsAt)) : undefined,
                validationErrors,
                draftStatus,
                rawRow: { ...r, ...(importKey ? { importKey } : {}) },
                sortOrder: i,
              }
            }),
          )
          .returning()
      : []

  return { batch: batch!, rows: importRows }
}

export async function findBestMappingProfile(
  conventionId: string,
  kind: ImportKind,
  spreadsheetId?: string | null,
) {
  const rows = await db
    .select()
    .from(schema.conventionImportMappingProfiles)
    .where(
      and(
        eq(schema.conventionImportMappingProfiles.conventionId, conventionId),
        eq(schema.conventionImportMappingProfiles.kind, kind),
      ),
    )
  if (!spreadsheetId) return rows[0] ?? null
  const exact = rows.find((r) => r.spreadsheetId === spreadsheetId)
  if (exact) return exact
  return rows[0] ?? null
}
