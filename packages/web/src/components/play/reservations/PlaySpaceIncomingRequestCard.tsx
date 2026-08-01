import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import ReservationAvatar from '@/components/play/reservations/ReservationAvatar'
import {
  counterpartName,
  counterpartUsername,
  formatReservationWhen,
  isAnonymousGuest,
} from '@/lib/play-space-reservations'

export default function PlaySpaceIncomingRequestCard({
  booking,
  timezone,
  busy,
  onAccept,
  onDecline,
  onOpen,
}: {
  booking: BookingRequest
  timezone: string
  busy?: boolean
  onAccept: () => void
  onDecline: () => void
  onOpen: () => void
}) {
  const name = counterpartName(booking, 'host')
  const username = counterpartUsername(booking, 'host')
  const anon = isAnonymousGuest(booking)
  const note = booking.description?.trim()
  const contact = booking.guestContact?.trim()

  return (
    <article className="rounded-2xl border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_8%,var(--dc-elevated))] px-4 py-4">
      <div className="flex gap-3">
        <ReservationAvatar booking={booking} role="host" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-dc-text">{name}</p>
          <p className="text-[13px] text-dc-muted">
            {anon ? 'Guest request' : `${name} requested time with you`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[15px] font-medium text-dc-text">
        {formatReservationWhen(booking.startsAt, booking.endsAt, timezone)}
      </p>
      {booking.location?.trim() ? (
        <p className="mt-0.5 text-[14px] text-dc-text-muted">{booking.location.trim()}</p>
      ) : null}

      {note ? (
        <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-dc-text-muted">“{note}”</p>
      ) : null}

      {(contact || username) ? (
        <p className="mt-2 text-[13px] text-dc-muted">
          Contact: {contact || (username ? `@${username}` : '')}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
        Waiting for you
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
        >
          {busy ? 'Accepting…' : 'Accept request'}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="min-h-11 text-sm font-medium text-dc-text-muted"
          >
            Decline
          </button>
          <button type="button" onClick={onOpen} className="min-h-11 text-sm font-medium text-dc-accent">
            View details ›
          </button>
        </div>
      </div>
    </article>
  )
}
