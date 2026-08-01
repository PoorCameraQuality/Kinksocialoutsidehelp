import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import {
  counterpartAvatar,
  counterpartName,
  initialsFromName,
  isAnonymousGuest,
} from '@/lib/play-space-reservations'

export default function ReservationAvatar({
  booking,
  role,
}: {
  booking: BookingRequest
  role: 'host' | 'guest'
}) {
  const name = counterpartName(booking, role)
  const avatar = counterpartAvatar(booking, role)
  const anon = role === 'host' && isAnonymousGuest(booking)

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dc-border bg-dc-elevated-muted text-xs font-semibold text-dc-muted"
      aria-hidden
    >
      {anon ? '?' : initialsFromName(name)}
    </span>
  )
}
