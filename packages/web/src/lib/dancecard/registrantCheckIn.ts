import { formatInTimeZone } from 'date-fns-tz'
import { zonedCalendarDateFromUtc } from '@/components/dancecard/time'

export type CheckInTiming = 'on_time' | 'late' | 'early_override'
export type CheckInEligibility = 'on_time' | 'late' | 'early' | 'unknown'

export type AccessWindow = { validFrom: string; validThrough: string }

/** Calendar date `yyyy-MM-dd` in the event timezone. */
export function todayInEventTimezone(timezone: string, now = new Date()): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd')
}

export function eventWindowAsCalendarDates(
  windowStartsAt: string | null | undefined,
  windowEndsAt: string | null | undefined,
  timezone: string,
): AccessWindow | null {
  if (!windowStartsAt?.trim() || !windowEndsAt?.trim()) return null
  const startMs = Date.parse(windowStartsAt)
  const endMs = Date.parse(windowEndsAt)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  return {
    validFrom: zonedCalendarDateFromUtc(startMs, timezone),
    validThrough: zonedCalendarDateFromUtc(endMs, timezone),
  }
}

export function resolveRegistrantAccessWindow(input: {
  categoryValidFrom: string | null | undefined
  categoryValidThrough: string | null | undefined
  eventWindowStartsAt: string | null | undefined
  eventWindowEndsAt: string | null | undefined
  timezone: string
}): AccessWindow | null {
  const from = input.categoryValidFrom?.trim() || null
  const through = input.categoryValidThrough?.trim() || null
  if (from && through) return { validFrom: from, validThrough: through }
  if (from) {
    const eventWin = eventWindowAsCalendarDates(input.eventWindowStartsAt, input.eventWindowEndsAt, input.timezone)
    return { validFrom: from, validThrough: through ?? eventWin?.validThrough ?? from }
  }
  if (through) {
    const eventWin = eventWindowAsCalendarDates(input.eventWindowStartsAt, input.eventWindowEndsAt, input.timezone)
    return { validFrom: eventWin?.validFrom ?? through, validThrough: through }
  }
  return eventWindowAsCalendarDates(input.eventWindowStartsAt, input.eventWindowEndsAt, input.timezone)
}

export function evaluateCheckInEligibility(todayYmd: string, window: AccessWindow | null): CheckInEligibility {
  if (!window) return 'unknown'
  if (todayYmd < window.validFrom) return 'early'
  if (todayYmd > window.validThrough) return 'late'
  return 'on_time'
}

export function timingFromEligibility(
  eligibility: CheckInEligibility,
  earlyOverride: boolean,
): CheckInTiming {
  if (eligibility === 'early') {
    return earlyOverride ? 'early_override' : 'on_time'
  }
  if (eligibility === 'late') return 'late'
  return 'on_time'
}

export function checkInTimingLabel(timing: CheckInTiming | null | undefined): string {
  switch (timing) {
    case 'late':
      return 'On-site (late)'
    case 'early_override':
      return 'On-site (early)'
    case 'on_time':
    default:
      return 'On-site'
  }
}
