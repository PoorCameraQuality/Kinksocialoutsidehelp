import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import {
  counterpartName,
  formatReservationWhen,
} from '@/lib/play-space-reservations'

export default function PlaySpaceOutgoingRequestCard({
  booking,
  timezone,
  busy,
  onOpen,
  onWithdraw,
}: {
  booking: BookingRequest
  timezone: string
  busy?: boolean
  onOpen: () => void
  onWithdraw: () => void
}) {
  const name = counterpartName(booking, 'guest')

  return (
    <article className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4">
      <p className="text-[16px] font-semibold text-dc-text">You requested time with {name}</p>
      <p className="mt-2 text-[15px] font-medium text-dc-text">
        {formatReservationWhen(booking.startsAt, booking.endsAt, timezone)}
      </p>
      {booking.location?.trim() ? (
        <p className="mt-0.5 text-[14px] text-dc-text-muted">{booking.location.trim()}</p>
      ) : null}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">
        Waiting for {name}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
        >
          View request
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onWithdraw}
          className="min-h-11 text-sm font-medium text-[var(--dc-danger)] disabled:opacity-50"
        >
          {busy ? 'Withdrawing…' : 'Withdraw request'}
        </button>
      </div>
    </article>
  )
}
