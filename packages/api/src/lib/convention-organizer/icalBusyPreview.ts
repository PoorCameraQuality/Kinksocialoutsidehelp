/** Parse ICS text into busy blocks (kit-compatible subset). */
export function parseIcsBusyBlocks(icsText: string): { start: string; end: string; summary?: string }[] {
  const lines = icsText.replace(/\r\n/g, '\n').split('\n')
  const blocks: { start: string; end: string; summary?: string }[] = []
  let inEvent = false
  let dtStart: string | null = null
  let dtEnd: string | null = null
  let summary: string | undefined

  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      dtStart = null
      dtEnd = null
      summary = undefined
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtStart && dtEnd) {
        blocks.push({ start: dtStart, end: dtEnd, summary })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue
    if (line.startsWith('DTSTART')) {
      dtStart = parseIcsDate(line.split(':').slice(1).join(':'))
    } else if (line.startsWith('DTEND')) {
      dtEnd = parseIcsDate(line.split(':').slice(1).join(':'))
    } else if (line.startsWith('SUMMARY:')) {
      summary = line.slice('SUMMARY:'.length)
    }
  }
  return blocks.filter((b) => b.start && b.end)
}

function parseIcsDate(raw: string): string {
  const v = raw.trim()
  if (/^\d{8}T\d{6}Z?$/i.test(v)) {
    const y = v.slice(0, 4)
    const mo = v.slice(4, 6)
    const d = v.slice(6, 8)
    const h = v.slice(9, 11)
    const mi = v.slice(11, 13)
    const s = v.slice(13, 15)
    const utc = v.endsWith('Z')
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${utc ? 'Z' : ''}`
    return new Date(iso).toISOString()
  }
  const parsed = new Date(v)
  return Number.isNaN(parsed.getTime()) ? v : parsed.toISOString()
}
