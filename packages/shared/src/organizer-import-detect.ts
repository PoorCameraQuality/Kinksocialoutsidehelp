import { detectHeaderRowIndex, suggestColumnMapping, type ImportKind } from './organizer-import.js'

export type DetectedImportFormat = 'flat_rows' | 'program_grid' | 'unknown'

const TIME_CELL =
  /^(\d{1,2}(:\d{2})?\s*(am|pm)?|\d{1,2}:\d{2}\s*-\s*\d{1,2}(:\d{2})?\s*(am|pm)?)/i
const DAY_LINE =
  /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i

export function detectImportFormat(rawRows: string[][]): DetectedImportFormat {
  if (!rawRows.length) return 'unknown'
  let timeColHits = 0
  let dayLineHits = 0
  let headerRowHits = 0
  for (let i = 0; i < Math.min(rawRows.length, 40); i++) {
    const row = rawRows[i] ?? []
    const c0 = String(row[0] ?? '').trim()
    if (DAY_LINE.test(c0)) dayLineHits++
    if (TIME_CELL.test(c0)) timeColHits++
    if (c0.toLowerCase().startsWith('time') && row.length > 2) headerRowHits++
  }
  if (headerRowHits >= 1 && timeColHits >= 2 && dayLineHits >= 0) return 'program_grid'
  const headerIdx = detectHeaderRowIndex(rawRows)
  const headers = rawRows[headerIdx] ?? []
  const mapping = suggestColumnMapping(
    headers.map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`),
    'program',
  )
  if (Object.keys(mapping).length >= 2) return 'flat_rows'
  return 'unknown'
}

export function formatDetectionLabel(format: DetectedImportFormat, kind: ImportKind): string {
  if (format === 'program_grid') return 'Time × room grid (sessions in cells)'
  if (format === 'flat_rows') return kind === 'staff' ? 'Flat staff table' : 'Flat schedule table'
  return 'Unrecognized layout. Map columns manually'
}
