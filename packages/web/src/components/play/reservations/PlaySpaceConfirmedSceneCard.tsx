import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import {
  counterpartName,
  formatReservationWhen,
} from '@/lib/play-space-reservations'

export default function PlaySpaceConfirmedSceneCard({
  booking,
  timezone,
  role,
  onOpen,
}: {
  booking: BookingRequest
  timezone: string
  role: 'host' | 'guest'
  onOpen: () => void
}) {
  const name = counterpartName(booking, role)

  return (
    <article className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4">
      <p className="text-[16px] font-semibold text-dc-text">Scene with {name}</p>
      <p className="mt-2 text-[15px] font-medium text-dc-text">
        {formatReservationWhen(booking.startsAt, booking.endsAt, timezone)}
      </p>
      {booking.location?.trim() ? (
        <p className="mt-0.5 text-[14px] text-dc-text-muted">{booking.location.trim()}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">
          Confirmed scene
        </p>
        <button type="button" onClick={onOpen} className="min-h-11 text-sm font-medium text-dc-accent">
          View details ›
        </button>
      </div>
    </article>
  )
}
