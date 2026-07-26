/** Read uploaded spreadsheets into raw row matrices (client-side). */

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let i = 0
  let field = ''
  let row: string[] = []
  let inQ = false
  while (i < text.length) {
    const c = text[i]!
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQ = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQ = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  row.push(field)
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

export async function readSpreadsheetFile(file: File): Promise<{ rawRows: string[][]; sheetName: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    return { rawRows: parseCsvRows(text), sheetName: 'CSV' }
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false })
    const sheetName =
      wb.SheetNames.find((n) => /grid|schedule|program|classes/i.test(n)) ?? wb.SheetNames[0]
    if (!sheetName) throw new Error('Workbook has no sheets')
    const sheet = wb.Sheets[sheetName]
    if (!sheet) throw new Error(`Missing sheet ${sheetName}`)
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false })
    const rawRows = matrix.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []))
    return { rawRows, sheetName }
  }
  throw new Error('Use a .csv or .xlsx file (export from Google Sheets if needed)')
}
