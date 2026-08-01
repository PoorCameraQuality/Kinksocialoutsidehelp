import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'
import ReservationAvatar from '@/components/play/reservations/ReservationAvatar'
import PlaySpaceChangeSceneTimeSheet from '@/components/play/reservations/PlaySpaceChangeSceneTimeSheet'
import {
  counterpartName,
  counterpartUsername,
  formatReservationDayLong,
  formatReservationTimeRange,
  humanTimezone,
  isAnonymousGuest,
} from '@/lib/play-space-reservations'

export default function PlaySpaceReservationDetail({
  booking,
  role,
  timezone,
  slug,
  spaceStartsAt,
  spaceEndsAt,
  busy,
  onBack,
  onAccept,
  onDecline,
  onWithdraw,
  onCancelScene,
  onSaveNotes,
  onChangeTime,
}: {
  booking: BookingRequest
  role: 'host' | 'guest'
  timezone: string
  slug: string
  spaceStartsAt?: string | null
  spaceEndsAt?: string | null
  busy?: boolean
  onBack: () => void
  onAccept?: () => void
  onDecline?: () => void
  onWithdraw?: () => void
  onCancelScene?: () => void
  onSaveNotes: (notes: string) => Promise<void>
  onChangeTime: (payload: {
    startsAt: string
    endsAt: string
    location?: string
  }) => Promise<void>
}) {
  const name = counterpartName(booking, role)
  const username = counterpartUsername(booking, role)
  const pending = booking.status === 'PENDING'
  const accepted = booking.status === 'ACCEPTED'
  const anon = role === 'host' && isAnonymousGuest(booking)
  const [notes, setNotes] = useState(booking.description ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesBusy, setNotesBusy] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [timeBusy, setTimeBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusLabel =
    pending && role === 'host'
      ? 'Waiting for you'
      : pending && role === 'guest'
        ? `Waiting for ${name}`
        : 'Confirmed scene'

  const title =
    pending && role === 'host'
      ? 'Request details'
      : pending
        ? 'Request details'
        : 'Scene details'

  return (
    <div className="mx-auto w-full max-w-xl min-w-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="min-h-11 text-sm font-medium text-dc-text-muted">
          ‹ Reservations
        </button>
        <p className="text-sm font-semibold text-dc-text">{title}</p>
        <span className="w-16" />
      </header>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">{statusLabel}</p>

      <div className="mt-3 flex items-center gap-3">
        <ReservationAvatar booking={booking} role={role} />
        <div className="min-w-0">
          <p className="text-[20px] font-semibold text-dc-text">
            {accepted ? `Scene with ${name}` : name}
          </p>
          {username ? <p className="text-[14px] text-dc-muted">@{username}</p> : null}
          {anon ? <p className="text-[14px] text-dc-muted">Guest request</p> : null}
        </div>
      </div>

      <section className="mt-6">
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">
          {pending ? 'Requested time' : 'When'}
        </p>
        <p className="mt-1 text-[16px] font-medium text-dc-text">
          {formatReservationDayLong(booking.startsAt, timezone)}
        </p>
        <p className="text-[16px] text-dc-text">
          {formatReservationTimeRange(booking.startsAt, booking.endsAt, timezone)}
        </p>
        <p className="mt-0.5 text-[13px] text-dc-muted">{humanTimezone(timezone)}</p>
      </section>

      {booking.location?.trim() ? (
        <section className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Location</p>
          <p className="mt-1 text-[15px] text-dc-text">{booking.location.trim()}</p>
        </section>
      ) : null}

      {booking.description?.trim() && !editingNotes ? (
        <section className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">
            {pending ? 'Request' : 'Details'}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-dc-text-muted whitespace-pre-wrap">
            {booking.description.trim()}
          </p>
        </section>
      ) : null}

      {(booking.guestContact?.trim() || username) && role === 'host' ? (
        <section className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Contact</p>
          <p className="mt-1 text-[15px] text-dc-text">
            {booking.guestContact?.trim() || (username ? `@${username}` : '')}
          </p>
          {booking.guestContact?.trim() ? (
            <button
              type="button"
              className="mt-2 min-h-11 text-sm font-medium text-dc-accent"
              onClick={() => void navigator.clipboard.writeText(booking.guestContact!.trim())}
            >
              Copy contact
            </button>
          ) : null}
        </section>
      ) : null}

      {accepted ? (
        <p className="mt-5 text-[14px] text-dc-muted">
          This scene is on My Plan.{' '}
          <Link to={`/play/${encodeURIComponent(slug)}`} className="font-medium text-dc-accent">
            View on My Plan
          </Link>
        </p>
      ) : null}

      <section className="mt-6">
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Notes</p>
        {editingNotes ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-[15px] text-dc-text"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={notesBusy}
                className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
                onClick={() => {
                  setNotesBusy(true)
                  setError(null)
                  void onSaveNotes(notes)
                    .then(() => setEditingNotes(false))
                    .catch((e) => setError(e instanceof Error ? e.message : 'Could not save notes'))
                    .finally(() => setNotesBusy(false))
                }}
              >
                {notesBusy ? 'Saving…' : 'Save notes'}
              </button>
              <button
                type="button"
                className="min-h-11 px-3 text-sm text-dc-text-muted"
                onClick={() => {
                  setNotes(booking.description ?? '')
                  setEditingNotes(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-dc-text-muted">
              {booking.description?.trim() || 'No notes yet.'}
            </p>
            <button
              type="button"
              className="mt-2 min-h-11 text-sm font-medium text-dc-accent"
              onClick={() => setEditingNotes(true)}
            >
              {booking.description?.trim() ? 'Edit notes' : 'Add note'}
            </button>
          </>
        )}
      </section>

      {error ? (
        <p className="mt-4 text-sm text-[var(--dc-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 space-y-2">
        {pending && role === 'host' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
            >
              {busy ? 'Accepting…' : 'Accept request'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text-muted disabled:opacity-50"
            >
              Decline request
            </button>
          </>
        ) : null}

        {pending && role === 'guest' ? (
          <button
            type="button"
            disabled={busy}
            onClick={onWithdraw}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--dc-danger-border)] text-sm font-semibold text-[var(--dc-danger)] disabled:opacity-50"
          >
            {busy ? 'Withdrawing…' : 'Withdraw request'}
          </button>
        ) : null}

        {accepted ? (
          <>
            <button
              type="button"
              onClick={() => setTimeOpen(true)}
              className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text"
            >
              Change time
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelScene}
              className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-[var(--dc-danger)] disabled:opacity-50"
            >
              Cancel scene
            </button>
          </>
        ) : null}
      </div>

      {timeOpen ? (
        <PlaySpaceChangeSceneTimeSheet
          booking={booking}
          timezone={timezone}
          spaceStartsAt={spaceStartsAt}
          spaceEndsAt={spaceEndsAt}
          counterpartLabel={name}
          busy={timeBusy}
          onCancel={() => setTimeOpen(false)}
          onSave={async (payload) => {
            setTimeBusy(true)
            setError(null)
            try {
              await onChangeTime(payload)
              setTimeOpen(false)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not change time')
            } finally {
              setTimeBusy(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}
