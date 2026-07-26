/** Value for `<input type="datetime-local" />` in the browser's local timezone. */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatRange(isoStart: string, isoEnd: string, tz: string): string {
  const s = new Date(isoStart)
  const e = new Date(isoEnd)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const t1 = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${dtf.format(s)} · ${t1.format(e)}`
}

export function dayLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export function groupSlotsByDay<T extends { startsAt: string }>(
  slots: T[],
  tz: string
): { day: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const s of slots) {
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(s.startsAt))
    const arr = map.get(key) ?? []
    arr.push(s)
    map.set(key, arr)
  }
  const keys = Array.from(map.keys()).sort()
  return keys.map((k) => {
    const items = (map.get(k) ?? []).sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    const label = items[0] ? dayLabel(items[0].startsAt, tz) : k
    return { day: label, items }
  })
}

export function discordLine(args: { displayName: string; eventTitle: string; url: string }): string {
  return `I'm **${args.displayName}** · East Coast Kink Events dancecard for **${args.eventTitle}**: ${args.url}`
}

/**
 * Normalize pasted mutual/share input to the bare token.
 * Accepts a raw token, a path like `/dancecard/paf26/s/abc`, or a full URL containing `/dancecard/.../s/{token}`.
 */
export function extractDancecardShareToken(input: string): string {
  const raw = input.trim()
  const fromDancecardPath = raw.match(/\/dancecard\/[^/]+\/s\/([^/?#]+)/i)
  if (fromDancecardPath) return fromDancecardPath[1].trim()
  const fromSPath = raw.match(/\/s\/([^/?#]+)/i)
  if (fromSPath) return fromSPath[1].trim()
  return raw.replace(/^\/+/, '').replace(/^s\//i, '').trim()
}

type WallParts = { y: number; m: number; d: number; h: number; min: number }

const wallPartsFmtByTz = new Map<string, Intl.DateTimeFormat>()
const ymdFmtByTz = new Map<string, Intl.DateTimeFormat>()

function wallPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = wallPartsFmtByTz.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    wallPartsFmtByTz.set(timeZone, f)
  }
  return f
}

function ymdFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = ymdFmtByTz.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    ymdFmtByTz.set(timeZone, f)
  }
  return f
}

function readWallPartsWith(dtf: Intl.DateTimeFormat, utcMs: number): WallParts {
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 'NaN')
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

function cmpWallToTarget(p: WallParts, y: number, m: number, d: number, h: number, min: number): number {
  if (p.y !== y) return p.y < y ? -1 : 1
  if (p.m !== m) return p.m < m ? -1 : 1
  if (p.d !== d) return p.d < d ? -1 : 1
  if (p.h !== h) return p.h < h ? -1 : 1
  if (p.min !== min) return p.min < min ? -1 : 1
  return 0
}

const WALL_MS_CACHE_MAX = 400
const wallMsCache = new Map<string, number | null>()
const dayEndMsCache = new Map<string, number>()

function wallMsCacheKey(timeZone: string, calendarYmd: string, hour24: number, minute: number) {
  return `${timeZone}\u0000${calendarYmd}\u0000${hour24}\u0000${minute}`
}

function touchWallMsCache(key: string, value: number | null) {
  wallMsCache.delete(key)
  wallMsCache.set(key, value)
  while (wallMsCache.size > WALL_MS_CACHE_MAX) {
    const first = wallMsCache.keys().next().value as string
    wallMsCache.delete(first)
  }
}

/** `YYYY-MM-DD` for the calendar day of `utcMs` in `timeZone`. */
export function zonedCalendarDateFromUtc(utcMs: number, timeZone: string): string {
  return ymdFormatter(timeZone).format(new Date(utcMs))
}

/**
 * UTC instant for a wall-clock time on a given calendar day in `timeZone`.
 * Bracket with 30-minute strides then minute scan (avoids thousands of Intl calls per lookup).
 * Returns first match (e.g. DST fall-back hour).
 */
export function utcMillisAtZonedWallClock(
  timeZone: string,
  calendarYmd: string,
  hour24: number,
  minute: number
): number | null {
  const [y0, m0, d0] = calendarYmd.split('-').map(Number)
  if (!Number.isFinite(y0) || !Number.isFinite(m0) || !Number.isFinite(d0)) return null

  const ck = wallMsCacheKey(timeZone, calendarYmd, hour24, minute)
  if (wallMsCache.has(ck)) return wallMsCache.get(ck) ?? null

  const dtf = wallPartsFormatter(timeZone)
  const read = (ms: number) => readWallPartsWith(dtf, ms)
  const stride = 30 * 60 * 1000
  const minuteMs = 60 * 1000
  let lo = Date.UTC(y0, m0 - 1, d0, 0, 0, 0) - 12 * 60 * 60 * 1000
  const horizon = lo + 72 * 60 * 60 * 1000

  if (cmpWallToTarget(read(lo), y0, m0, d0, hour24, minute) > 0) {
    for (let u = lo - minuteMs; u >= lo - 14 * 60 * 60 * 1000; u -= minuteMs) {
      if (cmpWallToTarget(read(u), y0, m0, d0, hour24, minute) === 0) {
        touchWallMsCache(ck, u)
        return u
      }
    }
    touchWallMsCache(ck, null)
    return null
  }

  let prevT: number | null = null
  let prevCmp: number | null = null

  for (let t = lo; t <= horizon; t += stride) {
    const c = cmpWallToTarget(read(t), y0, m0, d0, hour24, minute)
    if (c === 0) {
      touchWallMsCache(ck, t)
      return t
    }
    if (c > 0 && prevT !== null && prevCmp !== null && prevCmp < 0) {
      for (let u = prevT; u <= t; u += minuteMs) {
        if (cmpWallToTarget(read(u), y0, m0, d0, hour24, minute) === 0) {
          touchWallMsCache(ck, u)
          return u
        }
      }
      touchWallMsCache(ck, null)
      return null
    }
    prevT = t
    prevCmp = c
  }

  touchWallMsCache(ck, null)
  return null
}

/** First instant of the next calendar day after `calendarYmd` in `timeZone` (exclusive end for that day). */
export function exclusiveEndOfZonedCalendarDayMs(timeZone: string, calendarYmd: string): number {
  const dk = `${timeZone}\u0000${calendarYmd}`
  const cached = dayEndMsCache.get(dk)
  if (cached !== undefined) return cached

  const anchor = utcMillisAtZonedWallClock(timeZone, calendarYmd, 12, 0)
  if (anchor == null) {
    const [y0, m0, d0] = calendarYmd.split('-').map(Number)
    const fb = Date.UTC(y0, m0 - 1, d0 + 1, 5, 0, 0)
    dayEndMsCache.set(dk, fb)
    return fb
  }

  const ymdAt = (ms: number) => ymdFormatter(timeZone).format(new Date(ms))
  if (ymdAt(anchor) !== calendarYmd) {
    dayEndMsCache.set(dk, anchor)
    return anchor
  }

  let hi = anchor + 26 * 60 * 60 * 1000
  let widen = 0
  while (ymdAt(hi) === calendarYmd && hi < anchor + 72 * 60 * 60 * 1000 && widen++ < 48) {
    hi += 60 * 60 * 1000
  }
  if (ymdAt(hi) === calendarYmd) {
    const fb = anchor + 24 * 60 * 60 * 1000
    dayEndMsCache.set(dk, fb)
    return fb
  }

  let lo = anchor
  while (hi - lo > 60 * 1000) {
    const mid = Math.floor((lo + hi) / 2)
    if (ymdAt(mid) === calendarYmd) lo = mid
    else hi = mid
  }

  for (let t = lo + 60 * 1000; t <= hi; t += 60 * 1000) {
    if (ymdAt(t) !== calendarYmd) {
      dayEndMsCache.set(dk, t)
      return t
    }
  }

  dayEndMsCache.set(dk, hi)
  return hi
}

/**
 * Format an instant as `YYYY-MM-DDTHH:mm` for `<input type="datetime-local" />`-style values,
 * using the **event** `timeZone` wall clock (not the browser's local zone).
 */
export function formatUtcMsAsDatetimeLocalInZone(utcMs: number, timeZone: string): string {
  const dtf = wallPartsFormatter(timeZone)
  const p = readWallPartsWith(dtf, utcMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`
}

/**
 * Parse `YYYY-MM-DDTHH:mm` (optional seconds) as a wall time in `timeZone`, returning UTC epoch ms.
 * Use for manual unavailable times so they align with the event-tz day grid.
 */
export function parseDatetimeLocalInZone(value: string, timeZone: string): number | null {
  const trimmed = value.trim()
  const [datePart, rest = ''] = trimmed.split('T')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const timePart = rest.replace(/Z$/i, '').trim()
  const hm = timePart.match(/^(\d{1,2}):(\d{2})/)
  const hour24 = hm ? Number(hm[1]) : 0
  const minute = hm ? Number(hm[2].slice(0, 2)) : 0
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return null
  return utcMillisAtZonedWallClock(timeZone, datePart, hour24, minute)
}

/** Short label like `6 AM` for dancecard hour ticks (12-hour clock). */
export function formatHourTickLabel(hour24: number): string {
  if (hour24 === 0 || hour24 === 24) return '12 AM'
  if (hour24 === 12) return '12 PM'
  if (hour24 > 12) return `${hour24 - 12} PM`
  return `${hour24} AM`
}
