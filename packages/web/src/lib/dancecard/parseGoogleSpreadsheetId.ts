/** Extract spreadsheet ID from a Google Sheets URL or raw ID string. */
export function parseGoogleSpreadsheetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (fromUrl?.[1]) return fromUrl[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  return null
}

export const DEFAULT_GOOGLE_SHEET_RANGE = 'Sheet1!A1:Z500'
