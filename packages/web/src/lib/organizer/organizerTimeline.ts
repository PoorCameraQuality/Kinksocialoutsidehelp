import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const STEP_MS = 30 * 60 * 1000

/** Collect calendar day keys (yyyy-MM-dd) that intersect the event window in `timeZone`. */
export function dayKeysInWindow(windowStartsAt: string, windowEndsAt: string, timeZone: string): string[] {
  const start = new Date(windowStartsAt).getTime()
  const end = new Date(windowEndsAt).getTime()
  const seen = new Set<string>()
  const keys: string[] = []
  for (let t = start; t <= end; t += STEP_MS) {
    const k = formatInTimeZone(new Date(t), timeZone, 'yyyy-MM-dd')
    if (!seen.has(k)) {
      seen.add(k)
      keys.push(k)
    }
  }
  return keys
}

export function zonedWallDateFromParts(
  y: number,
  monthIndex0: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = new Date(y, monthIndex0, day, hour, minute, 0, 0)
  return fromZonedTime(wall, timeZone)
}

/** Row index from midnight in TZ for `instant` on calendar `dayKey` (yyyy-MM-dd). */
export function rowIndexForInstant(
  instantIso: string,
  dayKey: string,
  timeZone: string,
  gridStartHour: number,
  slotStepMinutes: number,
): number {
  const [ys, mo, ds] = dayKey.split('-').map((x) => parseInt(x, 10))
  const dayStart = zonedWallDateFromParts(ys, mo - 1, ds, gridStartHour, 0, timeZone).getTime()
  const t = new Date(instantIso).getTime()
  const minutesFromGridStart = (t - dayStart) / 60000
  return Math.round(minutesFromGridStart / slotStepMinutes)
}

export function instantFromRow(
  dayKey: string,
  rowIndex: number,
  timeZone: string,
  gridStartHour: number,
  slotStepMinutes: number,
): Date {
  const [ys, mo, ds] = dayKey.split('-').map((x) => parseInt(x, 10))
  const base = zonedWallDateFromParts(ys, mo - 1, ds, gridStartHour, 0, timeZone).getTime()
  return new Date(base + rowIndex * slotStepMinutes * 60000)
}

export function formatDayHeader(dayKey: string, timeZone: string): string {
  const [y, m, d] = dayKey.split('-').map((x) => parseInt(x, 10))
  const dt = zonedWallDateFromParts(y, m - 1, d, 12, 0, timeZone)
  return formatInTimeZone(dt, timeZone, 'EEE M/d')
}

export function formatTimeLabel(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, 'h:mm a')
}
