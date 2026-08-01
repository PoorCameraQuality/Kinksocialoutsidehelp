import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '@/hooks/useConfirm'
import {
  acceptBooking,
  cancelBooking,
  declineBooking,
  listBookings,
  patchBooking,
  type BookingRequest,
} from '@/hooks/usePlaySpaceDancecard'
import { fetchPlaySpace } from '@/hooks/useApiPlaySpaces'
import PlaySpaceConfirmedSceneCard from '@/components/play/reservations/PlaySpaceConfirmedSceneCard'
import PlaySpaceIncomingRequestCard from '@/components/play/reservations/PlaySpaceIncomingRequestCard'
import PlaySpaceOutgoingRequestCard from '@/components/play/reservations/PlaySpaceOutgoingRequestCard'
import PlaySpaceReservationDetail from '@/components/play/reservations/PlaySpaceReservationDetail'
import {
  counterpartName,
  groupConfirmedByDay,
  humanTimezone,
  partitionBookings,
} from '@/lib/play-space-reservations'

export default function PlaySpaceReservations({
  slug,
  timezone,
  selectedId,
  onPendingCount,
  onMutated,
  embedded = false,
}: {
  slug: string
  timezone: string
  /** When set, show detail for this booking id. */
  selectedId?: string | null
  onPendingCount?: (n: number) => void
  onMutated?: () => void
  /** When true, stay in hub (use callbacks via navigate to routes for detail). */
  embedded?: boolean
}) {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [incoming, setIncoming] = useState<BookingRequest[]>([])
  const [outgoing, setOutgoing] = useState<BookingRequest[]>([])
  const [windowStart, setWindowStart] = useState<string | null>(null)
  const [windowEnd, setWindowEnd] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(selectedId ?? null)

  useEffect(() => {
    setDetailId(selectedId ?? null)
  }, [selectedId])

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [bookings, space] = await Promise.all([listBookings(slug), fetchPlaySpace(slug).catch(() => null)])
      setIncoming(bookings.incoming ?? [])
      setOutgoing(bookings.outgoing ?? [])
      if (space) {
        setWindowStart(space.startsAt)
        setWindowEnd(space.endsAt)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reservations')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void reload()
  }, [reload])

  const parts = useMemo(() => partitionBookings(incoming, outgoing), [incoming, outgoing])

  useEffect(() => {
    onPendingCount?.(parts.needsResponse.length)
  }, [parts.needsResponse.length, onPendingCount])

  const confirmedRole = useCallback(
    (b: BookingRequest): 'host' | 'guest' => {
      if (incoming.some((i) => i.id === b.id)) return 'host'
      return 'guest'
    },
    [incoming],
  )

  function openDetail(id: string) {
    navigate(`/play/${encodeURIComponent(slug)}/reservations/${encodeURIComponent(id)}`)
  }

  function closeDetail() {
    setDetailId(null)
    navigate(`/play/${encodeURIComponent(slug)}/reservations`)
  }

  const all = useMemo(() => [...incoming, ...outgoing], [incoming, outgoing])
  const selected = detailId ? all.find((b) => b.id === detailId) ?? null : null
  const detailMissing = Boolean(detailId && !loading && !selected)

  async function doAccept(b: BookingRequest) {
    setBusyId(b.id)
    setError(null)
    try {
      await acceptBooking(slug, b.id)
      const name = counterpartName(b, 'host')
      setNotice(`Scene confirmed with ${name}. It has been added to My Plan.`)
      await reload()
      onMutated?.()
      if (detailId === b.id) closeDetail()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'This request could not be accepted. The time may no longer be available.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function doDecline(b: BookingRequest) {
    const ok = await confirm(
      `Decline ${counterpartName(b, 'host')}’s request?`,
      'They will no longer be waiting for your response. This does not block the requested time.',
      { destructive: true, confirmLabel: 'Decline request' },
    )
    if (!ok) return
    setBusyId(b.id)
    try {
      await declineBooking(slug, b.id)
      setNotice('Request declined.')
      await reload()
      onMutated?.()
      if (detailId === b.id) closeDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decline request')
    } finally {
      setBusyId(null)
    }
  }

  async function doWithdraw(b: BookingRequest) {
    const name = counterpartName(b, 'guest')
    const ok = await confirm(
      `Withdraw your request to ${name}?`,
      `${name} will no longer see it as waiting for a response.`,
      { destructive: true, confirmLabel: 'Withdraw request' },
    )
    if (!ok) return
    setBusyId(b.id)
    try {
      await cancelBooking(slug, b.id)
      setNotice('Request withdrawn.')
      await reload()
      onMutated?.()
      if (detailId === b.id) closeDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw request')
    } finally {
      setBusyId(null)
    }
  }

  async function doCancelScene(b: BookingRequest) {
    const role = confirmedRole(b)
    const name = counterpartName(b, role)
    const ok = await confirm(
      `Cancel your scene with ${name}?`,
      'The scene will be cancelled for both of you and removed from My Plan.',
      { destructive: true, confirmLabel: 'Cancel scene' },
    )
    if (!ok) return
    setBusyId(b.id)
    try {
      await cancelBooking(slug, b.id)
      setNotice('Scene cancelled and removed from My Plan.')
      await reload()
      onMutated?.()
      if (detailId === b.id) closeDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel scene')
    } finally {
      setBusyId(null)
    }
  }

  if (detailMissing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <p className="text-[17px] font-semibold text-dc-text">Reservation not available</p>
        <p className="mt-1 text-[14px] text-dc-text-muted">
          It may have been declined, cancelled, or is no longer active.
        </p>
        <button type="button" onClick={closeDetail} className="mt-4 min-h-11 text-sm font-medium text-dc-accent">
          Back to Reservations
        </button>
      </div>
    )
  }

  if (selected) {
    const role = incoming.some((i) => i.id === selected.id) ? 'host' : 'guest'
    return (
      <>
        {confirmDialog}
        <PlaySpaceReservationDetail
          booking={selected}
          role={role}
          timezone={timezone}
          slug={slug}
          spaceStartsAt={windowStart}
          spaceEndsAt={windowEnd}
          busy={busyId === selected.id}
          onBack={closeDetail}
          onAccept={() => void doAccept(selected)}
          onDecline={() => void doDecline(selected)}
          onWithdraw={() => void doWithdraw(selected)}
          onCancelScene={() => void doCancelScene(selected)}
          onSaveNotes={async (notes) => {
            await patchBooking(slug, selected.id, { description: notes })
            await reload()
            onMutated?.()
          }}
          onChangeTime={async (payload) => {
            await patchBooking(slug, selected.id, payload)
            setNotice('Scene time updated.')
            await reload()
            onMutated?.()
          }}
        />
      </>
    )
  }

  const emptyAll =
    parts.needsResponse.length === 0 && parts.confirmed.length === 0 && parts.yourRequests.length === 0
  const confirmedGroups = groupConfirmedByDay(parts.confirmed, timezone)
  const tzLabel = humanTimezone(timezone)

  return (
    <div className="mx-auto w-full max-w-[760px] min-w-0">
      {confirmDialog}
      <header>
        <h2 className="text-[20px] font-semibold text-dc-text">Reservations</h2>
        <p className="mt-0.5 text-[14px] text-dc-muted">Scene requests and confirmed plans</p>
        <p className="mt-1 text-[13px] text-dc-muted">Event time · {tzLabel}</p>
      </header>

      {error ? (
        <p className="mt-3 text-sm text-[var(--dc-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-sm text-dc-muted" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-dc-muted">Loading reservations…</p>
      ) : emptyAll ? (
        <div className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-6">
          <p className="text-[17px] font-semibold text-dc-text">No reservations yet</p>
          <p className="mt-1 text-[14px] text-dc-text-muted">
            Requests sent through your shared Dancecard will appear here. Confirmed scenes will also be added
            to My Plan.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/play/${encodeURIComponent(slug)}?tab=plan&share=1`)}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
          >
            Share my free time
          </button>
          <p className="mt-5 text-[14px] text-dc-muted">Looking for someone else’s open time?</p>
          <button
            type="button"
            className="mt-2 min-h-11 text-sm font-medium text-dc-accent"
            onClick={() => navigate(`/play/${encodeURIComponent(slug)}`)}
          >
            Open Compare
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {parts.needsResponse.length > 0 ? (
            <section>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-muted">
                Needs your response · {parts.needsResponse.length}
              </p>
              <div className="mt-3 space-y-3">
                {parts.needsResponse.map((b) => (
                  <PlaySpaceIncomingRequestCard
                    key={b.id}
                    booking={b}
                    timezone={timezone}
                    busy={busyId === b.id}
                    onAccept={() => void doAccept(b)}
                    onDecline={() => void doDecline(b)}
                    onOpen={() => openDetail(b.id)}
                  />
                ))}
              </div>
            </section>
          ) : parts.confirmed.length > 0 || parts.yourRequests.length > 0 ? (
            <p className="text-[14px] text-dc-muted">No requests need your response</p>
          ) : null}

          {parts.confirmed.length > 0 ? (
            <section>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-muted">
                Upcoming confirmed
              </p>
              <div className="mt-3 space-y-4">
                {confirmedGroups.map((g) => (
                  <div key={g.dayKey}>
                    {confirmedGroups.length > 1 ? (
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-dc-muted">
                        {g.label}
                      </p>
                    ) : null}
                    <div className="space-y-3">
                      {g.items.map((b) => (
                        <PlaySpaceConfirmedSceneCard
                          key={b.id}
                          booking={b}
                          timezone={timezone}
                          role={confirmedRole(b)}
                          onOpen={() => openDetail(b.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-dc-muted">Confirmed scenes also appear on My Plan.</p>
              {embedded ? (
                <button
                  type="button"
                  className="mt-1 min-h-11 text-sm font-medium text-dc-accent"
                  onClick={() => navigate(`/play/${encodeURIComponent(slug)}`)}
                >
                  Open My Plan
                </button>
              ) : (
                <Link
                  to={`/play/${encodeURIComponent(slug)}`}
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-dc-accent"
                >
                  Open My Plan
                </Link>
              )}
            </section>
          ) : null}

          {parts.yourRequests.length > 0 ? (
            <section>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-muted">Your requests</p>
              <div className="mt-3 space-y-3">
                {parts.yourRequests.map((b) => (
                  <PlaySpaceOutgoingRequestCard
                    key={b.id}
                    booking={b}
                    timezone={timezone}
                    busy={busyId === b.id}
                    onOpen={() => openDetail(b.id)}
                    onWithdraw={() => void doWithdraw(b)}
                  />
                ))}
              </div>
              <p className="mt-3 text-[13px] text-dc-muted">
                These times are not confirmed yet. Pending requests do not appear on My Plan until accepted.
              </p>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
