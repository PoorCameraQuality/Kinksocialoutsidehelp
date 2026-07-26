/** Parse time × room matrix schedules (rows = times, columns = rooms). */

import type { ParsedImportRow } from './organizer-import.js'
import { resolveImportKey } from './organizer-import-publish.js'

const DAY_LINE =
  /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun).*?(\d{1,2})(?:st|nd|rd|th)?\b/i
const MONTH_LINE =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i

export type GridParseContext = {
  /** Convention IANA timezone, e.g. America/New_York */
  timezone: string
  /** Event window start ISO - used for default year/month when sheet omits them */
  windowStartsAt: string
  sourceId: string
  sheetName?: string
}

function parseDayOfMonth(cell: string): number | null {
  const m = String(cell ?? '').match(DAY_LINE)
  if (!m) return null
  return parseInt(m[1]!, 10)
}

function parseMonthIndex(cell: string, fallback: number): number {
  const s = String(cell ?? '')
  const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const lower = s.toLowerCase()
  for (let i = 0; i < names.length; i++) {
    if (lower.includes(names[i]!)) return i + 1
  }
  return fallback
}

function normalizeTimeToken(t: string) {
  return String(t ?? '')
    .trim()
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
}

function parseClock(str: string, defaultMeridiem: 'am' | 'pm') {
  const raw = String(str ?? '').trim()
  const hadMer = /\b(am|pm)\b/i.test(raw)
  let s = normalizeTimeToken(str).toLowerCase()
  if (!s) return null
  let mer: 'am' | 'pm' = s.includes('pm') ? 'pm' : s.includes('am') ? 'am' : defaultMeridiem
  s = s.replace(/\s*(am|pm)\s*$/i, '').trim()
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  let h = parseInt(m[1]!, 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  if (!hadMer && defaultMeridiem === 'pm' && h < 12) h += 12
  return { h, m: min }
}

function wallToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tzOffsetMinutes: number,
): string {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - tzOffsetMinutes * 60_000
  return new Date(utcMs).toISOString()
}

/** Rough offset minutes west of UTC for common US zones at import time (DST not perfect). */
function guessOffsetMinutes(timezone: string, ref: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(ref)
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const m = tz.match(/GMT([+-]\d+)/)
    if (m) return -parseInt(m[1]!, 10) * 60
  } catch {
    /* ignore */
  }
  return 300
}

function parseTimeCell(
  timeCell: string,
  dayOfMonth: number,
  year: number,
  month: number,
  tzOffsetMinutes: number,
): { start: string; end: string } | null {
  let raw = normalizeTimeToken(timeCell)
  if (!raw || /midnight/i.test(raw)) return null
  const parts = raw
    .split(/\s+to\s+/i)
    .flatMap((x) => x.split(/\s*-\s*/))
    .map((x) => x.trim())
    .filter(Boolean)
  if (!parts.length) return null
  if (parts.length === 1) {
    const c = parseClock(parts[0]!, 'am')
    if (!c) return null
    let endH = Math.min(c.h + 1, 23)
    return {
      start: wallToIso(year, month, dayOfMonth, c.h, c.m, tzOffsetMinutes),
      end: wallToIso(year, month, dayOfMonth, endH, c.m, tzOffsetMinutes),
    }
  }
  let startMer: 'am' | 'pm' | null = /pm/i.test(parts[0]!) ? 'pm' : /am/i.test(parts[0]!) ? 'am' : null
  let c1 = parseClock(parts[0]!, startMer ?? 'am')
  if (!c1) return null
  if (startMer == null && parts[1] && /\bpm\b/i.test(parts[1]) && !/\bam\b/i.test(parts[1])) {
    c1 = parseClock(parts[0]!, 'pm')
  }
  const endDefault: 'am' | 'pm' = /pm/i.test(parts[1] ?? '')
    ? 'pm'
    : /am/i.test(parts[1] ?? '')
      ? 'am'
      : startMer === 'pm' || (c1?.h ?? 0) >= 12
        ? 'pm'
        : 'am'
  let c2 = parseClock(parts[1]!, endDefault)
  if (!c1 || !c2) return null
  let sh = c1.h
  let sm = c1.m
  let eh = c2.h
  let em = c2.m
  if (eh < sh || (eh === sh && em <= sm)) eh += 12
  return {
    start: wallToIso(year, month, dayOfMonth, sh, sm, tzOffsetMinutes),
    end: wallToIso(year, month, dayOfMonth, eh, em, tzOffsetMinutes),
  }
}

function cleanTitle(s: string) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export function parseProgramGridRows(rawRows: string[][], ctx: GridParseContext): ParsedImportRow[] {
  const ref = new Date(ctx.windowStartsAt)
  const defaultYear = ref.getUTCFullYear()
  const defaultMonth = ref.getUTCMonth() + 1
  const tzOff = guessOffsetMinutes(ctx.timezone, ref)
  let dayOfMonth: number | null = null
  let month = defaultMonth
  let year = defaultYear
  let headers: string[] = []
  const rows: ParsedImportRow[] = []
  let sortOrder = 0

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i] ?? []
    const c0 = String(row[0] ?? '')

    const d = parseDayOfMonth(c0)
    if (d) {
      dayOfMonth = d
      if (MONTH_LINE.test(c0)) month = parseMonthIndex(c0, defaultMonth)
      headers = []
      continue
    }

    const t0 = c0.trim().toLowerCase()
    if (t0.startsWith('time') && row.length > 2) {
      headers = row.map((h, idx) => {
        if (idx === 0) return 'Time'
        const t = cleanTitle(String(h ?? ''))
        return t || `Col${idx}`
      })
      continue
    }

    if (dayOfMonth == null || headers.length < 2) continue
    const tr = parseTimeCell(c0, dayOfMonth, year, month, tzOff)
    if (!tr) continue

    for (let j = 1; j < headers.length; j++) {
      const title = cleanTitle(String(row[j] ?? ''))
      if (!title || title.length < 2) continue
      const room = headers[j] ?? 'Room'
      if (/^time$/i.test(room)) continue
      const rowKey = `grid-${i}-${j}`
      const importKey = resolveImportKey(undefined, {
        sourceId: ctx.sourceId,
        rowKey,
        title,
        startsAt: tr.start,
        endsAt: tr.end,
        room,
        sheetName: ctx.sheetName,
      })
      rows.push({
        rowKey,
        title,
        room,
        startsAt: tr.start,
        endsAt: tr.end,
        importKey,
        validationErrors: [],
        raw: { time: c0, room, title, gridRow: String(i), gridCol: String(j) },
      })
      sortOrder++
    }
  }

  return rows
}
