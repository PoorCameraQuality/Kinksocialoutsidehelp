import { detectImportFormat, type DetectedImportFormat } from './organizer-import-detect.js'
import { parseProgramGridRows, type GridParseContext } from './organizer-import-grid.js'
import { appendWindowValidationErrors } from './organizer-import-validate.js'
import {
  parseFlatRowsWithMapping,
  type ColumnMapping,
  type ImportKind,
  type ParsedImportRow,
} from './organizer-import.js'

export type SpreadsheetParseOptions = {
  kind: ImportKind
  importFormat?: DetectedImportFormat | 'flat_rows' | 'program_grid'
  headerRowIndex?: number
  columnMapping?: ColumnMapping
  timezone?: string
  windowStartsAt?: string
  windowEndsAt?: string
  sourceId?: string
  sheetName?: string
}

export type SpreadsheetParseResult = {
  importFormat: DetectedImportFormat | 'flat_rows' | 'program_grid'
  headerRowIndex: number
  headers: string[]
  columnMapping: ColumnMapping
  rows: ParsedImportRow[]
  unmappedHeaders: string[]
}

export function parseSpreadsheetImport(
  rawRows: string[][],
  opts: SpreadsheetParseOptions,
): SpreadsheetParseResult {
  const detected = opts.importFormat ?? detectImportFormat(rawRows)
  const format = detected === 'unknown' ? 'flat_rows' : detected

  if (format === 'program_grid' && opts.kind === 'program') {
    const ctx: GridParseContext = {
      timezone: opts.timezone ?? 'America/New_York',
      windowStartsAt: opts.windowStartsAt ?? new Date().toISOString(),
      sourceId: opts.sourceId ?? 'sheet',
      sheetName: opts.sheetName,
    }
    let rows = parseProgramGridRows(rawRows, ctx)
    if (opts.windowStartsAt && opts.windowEndsAt) {
      rows = rows.map((r) => ({
        ...r,
        validationErrors: appendWindowValidationErrors(
          r.startsAt,
          r.endsAt,
          opts.windowStartsAt,
          opts.windowEndsAt,
          r.validationErrors,
        ),
      }))
    }
    return {
      importFormat: 'program_grid',
      headerRowIndex: 0,
      headers: [],
      columnMapping: {},
      rows,
      unmappedHeaders: [],
    }
  }

  const flat = parseFlatRowsWithMapping(rawRows, opts.kind, {
    headerRowIndex: opts.headerRowIndex,
    columnMapping: opts.columnMapping,
  })
  let rows = flat.rows
  if (opts.windowStartsAt && opts.windowEndsAt) {
    rows = rows.map((r) => ({
      ...r,
      validationErrors: appendWindowValidationErrors(
        r.startsAt,
        r.endsAt,
        opts.windowStartsAt,
        opts.windowEndsAt,
        r.validationErrors,
      ),
    }))
  }
  return {
    importFormat: 'flat_rows',
    headerRowIndex: flat.headerRowIndex,
    headers: flat.headers,
    columnMapping: flat.columnMapping,
    rows,
    unmappedHeaders: flat.unmappedHeaders,
  }
}