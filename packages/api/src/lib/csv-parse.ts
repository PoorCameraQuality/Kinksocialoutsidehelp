/** Minimal RFC-style CSV parse (quoted fields, commas). */
export function parseCsvRows(text: string): string[][] {
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
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row)
  }
  return rows
}

export function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
