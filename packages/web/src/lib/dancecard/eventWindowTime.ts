import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'

/** datetime-local value interpreted in the convention IANA timezone (not browser local). */
export function toConventionDatetimeInput(iso: string, timeZone: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatInTimeZone(d, timeZone, "yyyy-MM-dd'T'HH:mm")
}

/** Parse datetime-local wall clock in convention timezone → UTC ISO. */
export function fromConventionDatetimeInput(local: string, timeZone: string): string | null {
  if (!local.trim()) return null
  const [datePart, timePart] = local.split('T')
  if (!datePart || !timePart) return null
  const [y, mo, d] = datePart.split('-').map((x) => parseInt(x, 10))
  const [h, mi] = timePart.split(':').map((x) => parseInt(x, 10))
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null
  const utc = fromZonedTime(new Date(y, mo - 1, d, h, mi, 0, 0), timeZone)
  return Number.isNaN(utc.getTime()) ? null : utc.toISOString()
}

/** Human date range for organizers, e.g. "Jun 11–14, 2026". */
export function formatConventionDateRange(
  windowStartsAt: string,
  windowEndsAt: string,
  timeZone: string,
): string | null {
  if (!windowStartsAt || !windowEndsAt) return null
  const start = new Date(windowStartsAt)
  const end = new Date(windowEndsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  const startY = formatInTimeZone(start, timeZone, 'yyyy')
  const endY = formatInTimeZone(end, timeZone, 'yyyy')
  const startMonth = formatInTimeZone(start, timeZone, 'MMM')
  const endMonth = formatInTimeZone(end, timeZone, 'MMM')
  const startDay = formatInTimeZone(start, timeZone, 'd')
  const endDay = formatInTimeZone(end, timeZone, 'd')

  if (startY === endY && startMonth === endMonth && startDay === endDay) {
    return `${startMonth} ${startDay}, ${startY}`
  }
  if (startY === endY && startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${startY}`
  }
  if (startY === endY) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startY}`
  }
  return `${formatInTimeZone(start, timeZone, 'MMM d, yyyy')} – ${formatInTimeZone(end, timeZone, 'MMM d, yyyy')}`
}

export function countScheduleDays(windowStartsAt: string, windowEndsAt: string, timeZone: string): number {
  if (!windowStartsAt || !windowEndsAt) return 0
  return dayKeysInWindow(windowStartsAt, windowEndsAt, timeZone).length
}

/** Flag windows that look like datetime-local / browser-local save mistakes. */
export function isSuspiciousEventWindow(windowStartsAt: string, windowEndsAt: string, timeZone: string): boolean {
  if (!windowStartsAt || !windowEndsAt) return true
  const start = new Date(windowStartsAt)
  const end = new Date(windowEndsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return true

  const days = countScheduleDays(windowStartsAt, windowEndsAt, timeZone)
  if (days > 21) return true

  const startClock = formatInTimeZone(start, timeZone, 'HH:mm')
  const endClock = formatInTimeZone(end, timeZone, 'HH:mm')
  if (days >= 2 && startClock === endClock && startClock !== '00:00') return true

  return false
}

export function formatDailyGridWindow(startHour: number, endHourExcl: number, timeZone: string, dayKey: string): string {
  const [y, mo, d] = dayKey.split('-').map((x) => parseInt(x, 10))
  const start = fromZonedTime(new Date(y, mo - 1, d, startHour, 0, 0, 0), timeZone)
  const end = fromZonedTime(new Date(y, mo - 1, d, endHourExcl, 0, 0, 0), timeZone)
  return `${formatInTimeZone(start, timeZone, 'h:mm a')} – ${formatInTimeZone(end, timeZone, 'h:mm a')}`
}
