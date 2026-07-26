import { formatInTimeZone } from 'date-fns-tz'

export type BadgePrintRegistrant = {
  id: string
  registrationNumber: string
  sceneDisplayName: string
  pronouns: string | null
  packageName: string | null
  categoryId: string | null
  badgeTagline: string | null
  shifts: string[]
}

export type BadgePrintCategory = {
  id: string
  name: string
  count: number
}

export function formatBadgeShiftLine(
  startsAt: string,
  endsAt: string,
  role: string,
  timezone: string,
): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime())) return role.trim() || 'Shift'
  const day = formatInTimeZone(start, timezone, 'EEE')
  const t0 = formatInTimeZone(start, timezone, 'h:mm a').replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')
  const t1 = formatInTimeZone(end, timezone, 'h:mm a').replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')
  const r = role.trim() || 'Staff'
  return `${day} ${t0}–${t1} ${r}`
}

export function registrationNumberFromIndex(index: number): string {
  return String(index + 1).padStart(4, '0')
}
