import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ScenePartyProfile = {
  userId?: string
  username?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

export type SceneReservationBooking = {
  id: string
  hostUserId: string
  guestUserId: string | null
  guestDisplayName?: string | null
  guestContact?: string | null
  startsAt: string
  endsAt: string
  location?: string | null
  description: string
  status: string
  proposedStartsAt?: string | null
  proposedEndsAt?: string | null
  proposedByUserId?: string | null
  counterpart?: ScenePartyProfile | null
  host?: ScenePartyProfile | null
  guest?: ScenePartyProfile | null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function statusTone(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'bg-dc-accent/20 text-dc-accent ring-dc-accent-border'
    case 'PENDING':
      return 'bg-[color-mix(in_srgb,var(--dc-text-subtle)_18%,transparent)] text-[var(--dc-text-subtle)] ring-[color-mix(in_srgb,var(--dc-text-subtle)_45%,transparent)]'
    case 'RESCHEDULE_PENDING':
      return 'bg-dc-accent-muted text-dc-accent-hover ring-dc-accent/40'
    default:
      return 'bg-dc-elevated-muted text-dc-muted ring-dc-border'
  }
}

function artfulWhen(startsAt: string, endsAt: string, timeZone: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(start)
  const month = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short' }).format(start)
  const day = new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(start)
  const startTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(start)
  const endTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(end)
  const tzShort =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(start)
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  return { weekday, month, day, startTime, endTime, tzShort }
}

export default function SceneReservationCard({
  booking,
  role,
  timezone,
  apiBase,
  allowDirectReschedule,
  allowNotesEdit,
  proposeRescheduleSlot,
  onAccept,
  onDecline,
  onCancel,
  onAcceptReschedule,
  onDeclineReschedule,
  onDone,
}: {
  booking: SceneReservationBooking
  role: 'host' | 'guest'
  timezone: string
  apiBase: string
  /** Play-space style: PATCH times immediately. */
  allowDirectReschedule?: boolean
  /** Play-space style: PATCH description. */
  allowNotesEdit?: boolean
  /** Convention-style propose form (already mounted by parent when needed). */
  proposeRescheduleSlot?: ReactNode
  onAccept?: () => void
  onDecline?: () => void
  onCancel?: () => void
  onAcceptReschedule?: () => void
  onDeclineReschedule?: () => void
  onDone: () => void
}) {
  const [panel, setPanel] = useState<'none' | 'reschedule' | 'notes'>('none')
  const [notes, setNotes] = useState(booking.description ?? '')
  const [start, setStart] = useState(() => toDatetimeLocalValue(booking.startsAt))
  const [end, setEnd] = useState(() => toDatetimeLocalValue(booking.endsAt))
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  useEffect(() => {
    setNotes(booking.description ?? '')
    setStart(toDatetimeLocalValue(booking.startsAt))
    setEnd(toDatetimeLocalValue(booking.endsAt))
  }, [booking.id, booking.description, booking.startsAt, booking.endsAt])

  const party = useMemo(() => {
    const c = booking.counterpart
    const fallbackName =
      role === 'host' ?
        booking.guestDisplayName?.trim() || booking.guest?.displayName?.trim() || 'Guest'
      : booking.host?.displayName?.trim() || 'Host'
    const displayName = c?.displayName?.trim() || fallbackName
    const username = c?.username?.trim() || ''
    const avatarUrl = c?.avatarUrl?.trim() || null
    return { displayName, username, avatarUrl }
  }, [booking, role])

  const when = artfulWhen(booking.startsAt, booking.endsAt, timezone)
  const sceneTitle =
    booking.description?.trim().split(/[—–\n]/)[0]?.trim() ||
    (role === 'host' ? `Scene with ${party.displayName}` : `Scene with ${party.displayName}`)

  const guestProposedReschedule =
    booking.status === 'RESCHEDULE_PENDING' && booking.proposedByUserId === booking.guestUserId
  const hostProposedReschedule =
    booking.status === 'RESCHEDULE_PENDING' && booking.proposedByUserId === booking.hostUserId

  async function saveNotes() {
    setBusy(true)
    setLocalErr(null)
    try {
      const r = await fetch(
        `${apiBase}/dancecard/booking-requests/${encodeURIComponent(booking.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: notes }),
        },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLocalErr(typeof j.error === 'string' ? j.error : 'Could not save notes')
        return
      }
      setPanel('none')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  async function saveReschedule() {
    setBusy(true)
    setLocalErr(null)
    try {
      const r = await fetch(
        `${apiBase}/dancecard/booking-requests/${encodeURIComponent(booking.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
          }),
        },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLocalErr(typeof j.error === 'string' ? j.error : 'Could not reschedule')
        return
      }
      setPanel('none')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const profileHref = party.username ? `/profile/${encodeURIComponent(party.username)}` : null
  const canManageAccepted = booking.status === 'ACCEPTED' || booking.status === 'RESCHEDULE_PENDING'

  const avatarFill = party.avatarUrl ?
    // eslint-disable-next-line @next/next/no-img-element
    <img src={party.avatarUrl} alt="" className="h-full w-full object-cover" />
  : <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-dc-accent/40 to-dc-accent/10 text-base font-semibold text-dc-accent"
      aria-hidden
    >
      {initials(party.displayName)}
    </div>

  const mobileAvatar = profileHref ?
    <Link
      to={profileHref}
      className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-[1.5px] ring-dc-accent/45 sm:hidden"
      aria-label={`@${party.username} profile`}
    >
      {avatarFill}
    </Link>
  : <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-[1.5px] ring-dc-accent/45 sm:hidden">
      {avatarFill}
    </div>

  const desktopAvatar = profileHref ?
    <Link
      to={profileHref}
      className="relative hidden min-h-[8.5rem] w-[7rem] shrink-0 self-stretch overflow-hidden sm:block"
      aria-label={`@${party.username} profile`}
    >
      {avatarFill}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-dc-elevated/50" />
    </Link>
  : <div className="relative hidden min-h-[8.5rem] w-[7rem] shrink-0 self-stretch overflow-hidden sm:block">
      {avatarFill}
    </div>

  return (
    <li className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated shadow-[var(--dc-shadow-soft)]">
      <div className="flex items-stretch">
        {desktopAvatar}

        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            {mobileAvatar}
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-dc-muted">
                  {role === 'host' ? 'Hosting with' : 'Scene with'}
                </p>
                <h3 className="truncate font-serif text-lg leading-tight text-dc-text sm:text-xl">
                  {profileHref ?
                    <Link to={profileHref} className="hover:text-dc-accent">
                      {party.displayName}
                    </Link>
                  : party.displayName}
                </h3>
                {party.username ?
                  <p className="text-xs text-dc-muted">@{party.username}</p>
                : booking.guestContact && role === 'host' ?
                  <p className="text-xs text-dc-muted">{booking.guestContact}</p>
                : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusTone(booking.status)}`}
              >
                {booking.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-dc-border/80 bg-dc-surface-muted/70 px-3 py-2.5">
            <div className="min-w-[2.75rem] text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dc-accent">
                {when.weekday}
              </p>
              <p className="font-serif text-2xl leading-none text-dc-text">{when.day}</p>
              <p className="text-[10px] uppercase tracking-wide text-dc-muted">{when.month}</p>
            </div>
            <div className="h-10 w-px bg-dc-accent/35" aria-hidden />
            <div className="min-w-0">
              <p className="font-serif text-lg leading-tight text-dc-text sm:text-xl">
                {when.startTime}
                <span className="mx-1 text-dc-muted">–</span>
                {when.endTime}
              </p>
              <p className="mt-0.5 text-[11px] text-dc-muted">{when.tzShort || timezone}</p>
            </div>
          </div>

          <p className="mt-2.5 line-clamp-2 text-sm leading-snug text-dc-text-muted">{sceneTitle}</p>
          {booking.location?.trim() ?
            <p className="mt-1 text-xs text-dc-muted">
              <span className="text-[var(--dc-text-subtle)]">At </span>
              <span className="font-medium text-dc-text">{booking.location.trim()}</span>
            </p>
          : null}

          {booking.status === 'RESCHEDULE_PENDING' && booking.proposedStartsAt ?
            <p className="mt-1.5 text-xs text-dc-accent-hover">
              Proposed:{' '}
              {new Date(booking.proposedStartsAt).toLocaleString([], { timeZone: timezone })} –{' '}
              {booking.proposedEndsAt ?
                new Date(booking.proposedEndsAt).toLocaleTimeString([], { timeZone: timezone })
              : ''}
            </p>
          : null}

          <div className="mt-3 flex flex-col gap-2 border-t border-dc-border/60 pt-3">
            {booking.status === 'PENDING' && role === 'host' ?
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground"
                  onClick={onAccept}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                  onClick={onDecline}
                >
                  Decline
                </button>
              </div>
            : null}
            {booking.status === 'PENDING' && role === 'guest' ?
              <button
                type="button"
                className="min-h-11 w-full rounded-xl border border-dc-danger-border bg-dc-danger-muted px-3 text-sm text-dc-danger hover:bg-dc-danger/15"
                onClick={onCancel}
              >
                Withdraw request
              </button>
            : null}
            {guestProposedReschedule && role === 'host' ?
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground"
                  onClick={onAcceptReschedule}
                >
                  Accept new time
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                  onClick={onDeclineReschedule}
                >
                  Decline
                </button>
              </div>
            : null}
            {hostProposedReschedule && role === 'guest' ?
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground"
                  onClick={onAcceptReschedule}
                >
                  Accept new time
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                  onClick={onDeclineReschedule}
                >
                  Decline
                </button>
              </div>
            : null}
            {hostProposedReschedule && role === 'host' ?
              <p className="text-xs text-dc-muted">Waiting for the guest to confirm your proposed time.</p>
            : null}
            {guestProposedReschedule && role === 'guest' ?
              <p className="text-xs text-dc-muted">Waiting for the host to confirm your proposed time.</p>
            : null}

            {canManageAccepted ?
              <>
                <div
                  className={
                    (allowDirectReschedule || proposeRescheduleSlot) && booking.status === 'ACCEPTED' ?
                      'grid grid-cols-2 gap-2'
                    : 'grid grid-cols-1 gap-2'
                  }
                >
                  {(allowDirectReschedule || proposeRescheduleSlot) && booking.status === 'ACCEPTED' ?
                    <button
                      type="button"
                      className={`min-h-11 rounded-xl px-3 text-sm font-medium ${
                        panel === 'reschedule' ?
                          'bg-dc-accent/25 text-dc-accent'
                        : 'bg-white/[0.06] text-dc-text hover:bg-white/[0.1]'
                      }`}
                      onClick={() => setPanel((p) => (p === 'reschedule' ? 'none' : 'reschedule'))}
                    >
                      Reschedule
                    </button>
                  : null}
                  <button
                    type="button"
                    className={`min-h-11 rounded-xl px-3 text-sm font-medium ${
                      panel === 'notes' ?
                        'bg-dc-accent/25 text-dc-accent'
                      : 'bg-white/[0.06] text-dc-text hover:bg-white/[0.1]'
                    }`}
                    onClick={() => setPanel((p) => (p === 'notes' ? 'none' : 'notes'))}
                  >
                    Notes
                  </button>
                </div>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-xl border border-dc-accent-border/70 bg-transparent px-3 text-sm font-medium text-dc-accent-hover hover:bg-dc-accent-muted"
                  onClick={onCancel}
                >
                  Cancel scene
                </button>
              </>
            : null}
          </div>

          {localErr ?
            <p className="mt-2 text-xs text-dc-danger" role="alert">
              {localErr}
            </p>
          : null}

          {panel === 'notes' ?
            <div className="mt-3 space-y-2 rounded-xl border border-dc-border-subtle bg-dc-surface/60 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">Scene notes</p>
              {allowNotesEdit ?
                <textarea
                  className="min-h-[5.5rem] w-full resize-y rounded-lg border border-dc-border bg-dc-surface-muted px-2.5 py-2 text-sm text-dc-text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                />
              : <p className="whitespace-pre-wrap text-sm text-dc-text-muted">
                  {booking.description?.trim() || 'No notes yet.'}
                </p>
              }
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {allowNotesEdit ?
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
                    onClick={() => void saveNotes()}
                  >
                    {busy ? 'Saving…' : 'Save notes'}
                  </button>
                : null}
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-dc-border px-4 text-sm text-dc-muted hover:text-dc-text"
                  onClick={() => {
                    setNotes(booking.description ?? '')
                    setPanel('none')
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          : null}

          {panel === 'reschedule' && allowDirectReschedule ?
            <div className="mt-3 space-y-2 rounded-xl border border-dc-border-subtle bg-dc-surface/60 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">
                Reschedule scene
              </p>
              <label className="block text-xs text-dc-muted">
                Start
                <input
                  type="datetime-local"
                  className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="block text-xs text-dc-muted">
                End
                <input
                  type="datetime-local"
                  className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
                  onClick={() => void saveReschedule()}
                >
                  {busy ? 'Saving…' : 'Save new time'}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-dc-border px-4 text-sm text-dc-muted hover:text-dc-text"
                  onClick={() => setPanel('none')}
                >
                  Close
                </button>
              </div>
            </div>
          : null}

          {panel === 'reschedule' && !allowDirectReschedule && proposeRescheduleSlot ?
            <div className="mt-3">{proposeRescheduleSlot}</div>
          : null}
        </div>
      </div>
    </li>
  )
}
