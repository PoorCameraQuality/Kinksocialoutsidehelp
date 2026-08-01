import { formatInTimeZone } from 'date-fns-tz'
import type { BookingParty, BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import { formatProgramTime, humanTimezone } from '@/lib/play-space-program'

export { humanTimezone }

export function partyDisplayName(party: BookingParty | null | undefined, fallback: string): string {
  return party?.displayName?.trim() || party?.username?.trim() || fallback
}

export function counterpartName(booking: BookingRequest, role: 'host' | 'guest'): string {
  if (role === 'host') {
    return (
      booking.counterpart?.displayName?.trim() ||
      booking.guest?.displayName?.trim() ||
      booking.guestDisplayName?.trim() ||
      booking.guest?.username?.trim() ||
      'Guest'
    )
  }
  return (
    booking.counterpart?.displayName?.trim() ||
    booking.host?.displayName?.trim() ||
    booking.host?.username?.trim() ||
    'Host'
  )
}

export function counterpartUsername(booking: BookingRequest, role: 'host' | 'guest'): string | null {
  if (role === 'host') {
    return booking.counterpart?.username?.trim() || booking.guest?.username?.trim() || null
  }
  return booking.counterpart?.username?.trim() || booking.host?.username?.trim() || null
}

export function counterpartAvatar(booking: BookingRequest, role: 'host' | 'guest'): string | null {
  if (role === 'host') {
    return booking.counterpart?.avatarUrl?.trim() || booking.guest?.avatarUrl?.trim() || null
  }
  return booking.counterpart?.avatarUrl?.trim() || booking.host?.avatarUrl?.trim() || null
}

export function isAnonymousGuest(booking: BookingRequest): boolean {
  return !booking.guestUserId
}

export function formatReservationDay(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, 'EEE, MMM d')
}

export function formatReservationDayLong(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, 'EEEE, MMMM d')
}

export function formatReservationTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatProgramTime(startsAt, timeZone)}–${formatProgramTime(endsAt, timeZone)}`
}

export function formatReservationWhen(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatReservationDay(startsAt, timeZone)} · ${formatReservationTimeRange(startsAt, endsAt, timeZone)}`
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function partitionBookings(incoming: BookingRequest[], outgoing: BookingRequest[]) {
  const needsResponse = incoming
    .filter((b) => b.status === 'PENDING')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const confirmed = [...incoming, ...outgoing]
    .filter((b) => b.status === 'ACCEPTED')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const yourRequests = outgoing
    .filter((b) => b.status === 'PENDING')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  return { needsResponse, confirmed, yourRequests }
}

export function groupConfirmedByDay(items: BookingRequest[], timeZone: string) {
  const map = new Map<string, BookingRequest[]>()
  for (const b of items) {
    const key = formatInTimeZone(new Date(b.startsAt), timeZone, 'yyyy-MM-dd')
    const list = map.get(key) ?? []
    list.push(b)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, dayItems]) => ({
      dayKey,
      label: formatInTimeZone(new Date(dayItems[0]!.startsAt), timeZone, 'EEEE').toUpperCase(),
      items: dayItems,
    }))
}
