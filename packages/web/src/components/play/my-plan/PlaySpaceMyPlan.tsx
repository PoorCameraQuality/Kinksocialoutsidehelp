import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import PlaySpaceBlockComposer from '@/components/play/my-plan/PlaySpaceBlockComposer'
import PlaySpacePlanItemCard from '@/components/play/my-plan/PlaySpacePlanItemCard'
import PlaySpaceShareFreeTimeSheet from '@/components/play/my-plan/PlaySpaceShareFreeTimeSheet'
import PlaySpaceProgramDayNav from '@/components/play/program/PlaySpaceProgramDayNav'
import { dancecardEntryIdForApi, dancecardSharePublicPath, makeDancecardApiScope } from '@/lib/dancecard/dancecardApiScope'
import { fromConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'
import { shareOrCopyUrl } from '@/lib/share-or-copy'
import { useConfirm } from '@/hooks/useConfirm'
import {
  addBusyBlock,
  cancelBooking,
  declineBooking,
  deleteBusyBlock,
  fetchCalendar,
  listBookings,
  listShares,
  mintShareLink,
  patchBusyBlock,
  patchPrefs,
  removeProgramFromDancecard,
  revokeShare,
  type BookingRequest,
  type CalendarItem,
} from '@/hooks/usePlaySpaceDancecard'
import {
  buildPlanDays,
  defaultPlanDayKey,
  eventDayKey,
  formatProgramTime,
  groupPlanByStartTime,
  humanTimezone,
  partitionPlanDay,
  startsInMinutes,
  toPlanItems,
  type PlanItem,
} from '@/lib/play-space-my-plan'

function shiftBlockToDay(
  startsAt: string,
  endsAt: string,
  targetDay: string,
  timezone: string,
): { startsAt: string; endsAt: string } | null {
  const startTime = formatInTimeZone(new Date(startsAt), timezone, 'HH:mm')
  const endTime = formatInTimeZone(new Date(endsAt), timezone, 'HH:mm')
  const startDay = eventDayKey(startsAt, timezone)
  const endDay = eventDayKey(endsAt, timezone)
  const daySpan = Math.round(
    (Date.parse(`${endDay}T12:00:00Z`) - Date.parse(`${startDay}T12:00:00Z`)) / 86_400_000,
  )
  const [y, m, d] = targetDay.split('-').map(Number)
  const endTarget = new Date(Date.UTC(y, m - 1, d + Math.max(0, daySpan))).toISOString().slice(0, 10)
  const s = fromConventionDatetimeInput(`${targetDay}T${startTime}`, timezone)
  const e = fromConventionDatetimeInput(`${endTarget}T${endTime}`, timezone)
  if (!s || !e) return null
  return { startsAt: s, endsAt: e }
}

export default function PlaySpaceMyPlan({
  slug,
  timezone,
  reloadKey = 0,
  onOpenReservations,
  onBrowseProgram,
  onPlanChanged,
  openShareRequest = false,
  onOpenShareRequestHandled,
}: {
  slug: string
  timezone: string
  reloadKey?: number
  onOpenReservations?: () => void
  onBrowseProgram?: () => void
  onPlanChanged?: () => void
  /** Deep-link: open share flow once (e.g. ?share=1). */
  openShareRequest?: boolean
  onOpenShareRequestHandled?: () => void
}) {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [items, setItems] = useState<CalendarItem[]>([])
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [windowStart, setWindowStart] = useState<string | null>(null)
  const [windowEnd, setWindowEnd] = useState<string | null>(null)
  const [shares, setShares] = useState<
    { id: string; token: string; label: string | null; revokedAt: string | null }[]
  >([])
  const [incoming, setIncoming] = useState<BookingRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [autoShareOnOpen, setAutoShareOnOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState<PlanItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [composerBusy, setComposerBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [cal, shareRes, bookings] = await Promise.all([
        fetchCalendar(slug),
        listShares(slug),
        listBookings(slug),
      ])
      setItems(cal.items ?? [])
      setBufferMinutes(cal.bufferMinutes ?? 0)
      setWindowStart(cal.playSpaceStartsAt ?? cal.conventionStartsAt ?? null)
      setWindowEnd(cal.playSpaceEndsAt ?? cal.conventionEndsAt ?? null)
      setShares(shareRes.items ?? [])
      setIncoming(bookings.incoming ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your plan')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void reload()
  }, [reload, reloadKey])

  useEffect(() => {
    if (!openShareRequest || loading) return
    void shareFreeTimeNow().finally(() => onOpenShareRequestHandled?.())
    // shareFreeTimeNow closes over latest state; intentional deep-link once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openShareRequest, loading])

  const planItems = useMemo(() => toPlanItems(items), [items])
  const days = useMemo(
    () => buildPlanDays(planItems, timezone, windowStart, windowEnd, now),
    [planItems, timezone, windowStart, windowEnd, now],
  )

  useEffect(() => {
    if (selectedDay && days.some((d) => d.dayKey === selectedDay)) return
    setSelectedDay(defaultPlanDayKey(days, timezone, now))
  }, [days, timezone, now, selectedDay])

  const active = days.find((d) => d.dayKey === selectedDay) ?? days[0]
  const dayItems = active?.items ?? []
  const typedParts = useMemo(() => partitionPlanDay(dayItems, now), [dayItems, now])

  const pendingIncoming = useMemo(
    () => incoming.filter((b) => b.status === 'PENDING' || b.status === 'RESCHEDULE_PENDING'),
    [incoming],
  )

  const tzLabel = humanTimezone(timezone)
  const hasAnyItems = planItems.length > 0
  const activeShares = shares.filter((s) => !s.revokedAt)
  const shareScope = useMemo(() => makeDancecardApiScope('play-space', slug), [slug])

  async function ensureShareUrl(): Promise<string> {
    const existing = activeShares[0]
    if (existing) {
      return `${window.location.origin}${dancecardSharePublicPath(shareScope, existing.token)}`
    }
    const res = await mintShareLink(slug)
    const url = res.url || `${window.location.origin}${res.path}`
    await reload()
    return url
  }

  /** One tap: create link if needed, then system share (or copy). */
  async function shareFreeTimeNow() {
    setShareBusy(true)
    setError(null)
    try {
      const url = await ensureShareUrl()
      const result = await shareOrCopyUrl({
        url,
        title: 'My free time',
        text: 'Pick a time that works — this link only shows when I am free.',
      })
      if (result === 'shared') setNotice('Share sheet opened')
      else if (result === 'copied') setNotice('Link copied — paste it in a message')
      else if (result === 'failed') {
        setAutoShareOnOpen(false)
        setShareOpen(true)
        setNotice('Copy the link from the sheet below')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a share link')
      setAutoShareOnOpen(false)
      setShareOpen(true)
    } finally {
      setShareBusy(false)
    }
  }

  function openShareSheet(opts?: { autoShare?: boolean }) {
    setAutoShareOnOpen(opts?.autoShare === true)
    setShareOpen(true)
    setMenuOpen(false)
  }

  async function removeProgram(item: PlanItem) {
    if (!item.sourceId) {
      setError('We could not remove this from your plan. Try again.')
      return
    }
    setBusyId(item.id)
    try {
      await removeProgramFromDancecard(slug, item.sourceId)
      setNotice('Removed from your plan')
      await reload()
      onPlanChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not remove this from your plan. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteBlock(item: PlanItem) {
    const ok = await confirm(
      `Delete “${item.title?.trim() || 'Busy'}”?`,
      'This time will become available in Compare and shared free time.',
      { destructive: true },
    )
    if (!ok) return
    setBusyId(item.id)
    try {
      await deleteBusyBlock(slug, dancecardEntryIdForApi(item.id))
      setNotice('Block deleted')
      await reload()
      onPlanChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not remove this from your plan. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelScene(item: PlanItem) {
    if (!item.sourceId) {
      setError('We could not cancel this scene. Try again from Reservations.')
      return
    }
    const ok = await confirm('Cancel this scene?', 'The reservation will be cancelled for both of you.', {
      destructive: true,
    })
    if (!ok) return
    setBusyId(item.id)
    try {
      await cancelBooking(slug, item.sourceId)
      setNotice('Scene cancelled')
      await reload()
      onPlanChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel scene')
    } finally {
      setBusyId(null)
    }
  }

  async function saveBlock(payload: {
    title: string
    startsAt: string
    endsAt: string
    repeatDayKeys?: string[]
  }) {
    setComposerBusy(true)
    setError(null)
    try {
      if (editing) {
        await patchBusyBlock(slug, dancecardEntryIdForApi(editing.id), {
          title: payload.title,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        })
        setNotice('Block updated')
      } else if (payload.repeatDayKeys && payload.repeatDayKeys.length > 0) {
        let ok = 0
        let fail = 0
        for (const dayKey of payload.repeatDayKeys) {
          const shifted = shiftBlockToDay(payload.startsAt, payload.endsAt, dayKey, timezone)
          if (!shifted) {
            fail += 1
            continue
          }
          try {
            await addBusyBlock(slug, { title: payload.title, ...shifted })
            ok += 1
          } catch {
            fail += 1
          }
        }
        if (fail > 0) setError(`Added ${ok} block${ok === 1 ? '' : 's'}; ${fail} failed.`)
        else setNotice(`Added ${ok} block${ok === 1 ? '' : 's'}`)
      } else {
        await addBusyBlock(slug, {
          title: payload.title,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        })
        setNotice('Block added')
      }
      setComposerOpen(false)
      setEditing(null)
      await reload()
      onPlanChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save block')
    } finally {
      setComposerBusy(false)
    }
  }

  function renderItem(item: PlanItem, opts?: { variant?: 'now' | 'default'; hideTime?: boolean }) {
    return (
      <PlaySpacePlanItemCard
        key={item.id}
        item={item}
        timezone={timezone}
        variant={opts?.variant}
        hideTime={opts?.hideTime}
        busy={busyId === item.id}
        onViewProgram={onBrowseProgram}
        onRemoveProgram={() => void removeProgram(item)}
        onEditBlock={() => {
          setEditing(item)
          setComposerOpen(true)
        }}
        onDeleteBlock={() => void deleteBlock(item)}
        onViewScene={() => {
          if (item.sourceId) {
            navigate(
              `/play/${encodeURIComponent(slug)}/reservations/${encodeURIComponent(item.sourceId)}`,
            )
          } else {
            onOpenReservations?.()
          }
        }}
        onCancelScene={() => void cancelScene(item)}
      />
    )
  }

  const reservationsHref = `/play/${encodeURIComponent(slug)}/reservations`

  return (
    <div className="mx-auto w-full max-w-[1120px] min-w-0">
      {confirmDialog}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-dc-text">My Plan</h2>
            <p className="mt-0.5 text-[14px] text-dc-muted">Your schedule — and the easiest way to get booked</p>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setComposerOpen(true)
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-semibold text-dc-text"
            >
              Block time
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-dc-border text-sm text-dc-muted"
              aria-expanded={menuOpen}
              aria-label="Plan menu"
            >
              •••
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-dc-dropdown w-64 rounded-2xl border border-dc-border bg-dc-elevated p-2 shadow-lg">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
                  onClick={() => openShareSheet()}
                >
                  Sharing settings
                </button>
                <Link
                  to="/play/schedule"
                  className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  View all my Play Space schedules
                </Link>
                <Link
                  to={reservationsHref}
                  className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-dc-text hover:bg-dc-elevated-muted"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenReservations?.()
                  }}
                >
                  Reservations
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Primary action — always first, always one tap */}
        <section className="rounded-2xl border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_14%,var(--dc-elevated))] px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-accent">Share my free time</p>
          <p className="mt-1 text-[15px] font-semibold text-dc-text">
            {activeShares.length ? 'Your link is ready' : 'Send a link. They pick a free window.'}
          </p>
          <p className="mt-1 text-[13px] text-dc-text-muted">
            Shows only when you are free. Program, scenes, and blocks stay private.
            {bufferMinutes > 0 ? ` Recovery buffer: ${bufferMinutes} min.` : ''}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void shareFreeTimeNow()}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-dc-accent px-5 text-base font-semibold text-dc-accent-foreground disabled:opacity-50"
            >
              {shareBusy ? 'Working…' : activeShares.length ? 'Share link' : 'Create & share link'}
            </button>
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => openShareSheet()}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-dc-border bg-dc-elevated px-4 text-sm font-medium text-dc-text"
            >
              Recovery & details
            </button>
          </div>
        </section>
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

      <div className="mt-4 lg:flex lg:gap-6 xl:gap-8">
        <PlaySpaceProgramDayNav days={days} selectedKey={selectedDay} onSelect={setSelectedDay} variant="rail" />

        <div className="min-w-0 flex-1 lg:max-w-[680px]">
          <PlaySpaceProgramDayNav days={days} selectedKey={selectedDay} onSelect={setSelectedDay} />
          <p className="mt-1 text-[13px] text-dc-muted">Event time · {tzLabel}</p>

          {pendingIncoming.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-3">
              {pendingIncoming.length <= 2 ? (
                <>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-muted">
                    {pendingIncoming.length} request{pendingIncoming.length === 1 ? '' : 's'} need
                    {pendingIncoming.length === 1 ? 's' : ''} your response
                  </p>
                  <ul className="mt-2 space-y-3">
                    {pendingIncoming.map((b) => (
                      <li key={b.id} className="text-[14px] text-dc-text">
                        <span className="font-medium">
                          {b.guestDisplayName?.trim() || b.guest?.displayName || 'Someone'}
                        </span>{' '}
                        · {formatProgramTime(b.startsAt, timezone)}–{formatProgramTime(b.endsAt, timezone)}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="min-h-11 rounded-full border border-dc-border px-3 text-sm"
                            onClick={() => void declineBooking(slug, b.id).then(() => reload())}
                          >
                            Decline
                          </button>
                          <Link
                            to={`${reservationsHref}/${encodeURIComponent(b.id)}`}
                            className="inline-flex min-h-11 items-center rounded-full border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] px-3 text-sm font-semibold"
                            onClick={() => onOpenReservations?.()}
                          >
                            Review request
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-semibold text-dc-text">
                    {pendingIncoming.length} requests need your response
                  </p>
                  <Link
                    to={reservationsHref}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-dc-accent"
                    onClick={() => onOpenReservations?.()}
                  >
                    Review reservations
                  </Link>
                </>
              )}
            </div>
          ) : null}

          {loading ? (
            <p className="mt-6 text-sm text-dc-muted">Loading your plan…</p>
          ) : dayItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-6">
              <p className="text-[17px] font-semibold text-dc-text">
                {hasAnyItems
                  ? `Nothing planned for ${active?.label.split(',')[0] ?? 'this day'}`
                  : 'Build your weekend plan'}
              </p>
              <p className="mt-1 text-[14px] text-dc-text-muted">
                {hasAnyItems
                  ? 'Add official sessions from Program or block time for meals, rest, travel, and anything else.'
                  : 'Save sessions from Program, accept scene reservations, or block time you want to keep unavailable.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={() => void shareFreeTimeNow()}
                  className="inline-flex min-h-11 items-center rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
                >
                  {shareBusy ? 'Working…' : 'Share my free time'}
                </button>
                {onBrowseProgram ? (
                  <button
                    type="button"
                    onClick={onBrowseProgram}
                    className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-5 text-sm font-semibold text-dc-text"
                  >
                    Browse Program
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setComposerOpen(true)
                  }}
                  className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-5 text-sm font-semibold text-dc-text"
                >
                  Block time
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              <p className="text-[17px] font-semibold text-dc-text">{active?.label}</p>

              {typedParts.earlier.length > 0 ? (
                <div>
                  <button
                    type="button"
                    aria-expanded={showEarlier}
                    onClick={() => setShowEarlier((v) => !v)}
                    className="min-h-11 text-sm font-medium text-dc-muted"
                  >
                    Earlier today · {typedParts.earlier.length} item
                    {typedParts.earlier.length === 1 ? '' : 's'}
                  </button>
                  {showEarlier ? (
                    <div className="mt-2 space-y-4 opacity-70">
                      {groupPlanByStartTime(typedParts.earlier).map((g) => (
                        <div key={g.startIso}>
                          <p className="mb-1.5 text-[13px] font-medium text-dc-muted">
                            {formatProgramTime(g.startIso, timezone)}
                          </p>
                          <div className="space-y-2">
                            {g.sessions.map((s) => renderItem(s, { hideTime: true }))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {typedParts.happeningNow.length > 0 ? (
                <section>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Happening now</p>
                  <div className="mt-2 space-y-2">
                    {typedParts.happeningNow.map((s) => renderItem(s, { variant: 'now' }))}
                  </div>
                </section>
              ) : null}

              {typedParts.upNext.length > 0 ? (
                <section>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Up next</p>
                  <div className="mt-2 space-y-4">
                    {groupPlanByStartTime(typedParts.upNext).map((g) => {
                      const mins = startsInMinutes(g.startIso, now)
                      return (
                        <div key={g.startIso}>
                          <p className="mb-1.5 text-[14px] font-medium text-dc-text">
                            {formatProgramTime(g.startIso, timezone)}
                            {mins != null && mins <= 90 ? (
                              <span className="ml-2 text-[13px] font-normal text-dc-muted">
                                Starts in {mins} minute{mins === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </p>
                          <div className="space-y-2">
                            {g.sessions.map((s) => renderItem(s, { hideTime: true }))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : typedParts.happeningNow.length > 0 && typedParts.later.length === 0 ? (
                <p className="text-[14px] text-dc-muted">Nothing else planned today.</p>
              ) : null}

              {typedParts.later.length > 0 ? (
                <section>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Later today</p>
                  <div className="mt-2 space-y-4">
                    {groupPlanByStartTime(typedParts.later).map((g) => (
                      <div key={g.startIso}>
                        <p className="mb-1.5 text-[14px] font-medium text-dc-text">
                          {formatProgramTime(g.startIso, timezone)}
                        </p>
                        <div className="space-y-2">
                          {g.sessions.map((s) => renderItem(s, { hideTime: true }))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-[13px] text-dc-muted">
                End of {active?.label.split(',')[0] ?? 'today'}’s plan
              </p>
            </div>
          )}

        </div>

        <aside className="mt-8 hidden w-[240px] shrink-0 space-y-4 xl:block">
          <div className="rounded-2xl border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-dc-accent">Share free time</p>
            <p className="mt-2 text-[14px] text-dc-text">
              {activeShares.length ? 'Link is active' : 'Create a private free-time link'}
            </p>
            <p className="mt-1 text-[13px] text-dc-muted">
              Recovery: {bufferMinutes === 0 ? 'None' : `${bufferMinutes} min`}
            </p>
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => void shareFreeTimeNow()}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
            >
              {shareBusy ? 'Working…' : 'Share link'}
            </button>
            <button
              type="button"
              onClick={() => openShareSheet()}
              className="mt-2 min-h-11 w-full text-sm font-medium text-dc-accent"
            >
              Recovery & details
            </button>
          </div>
          {pendingIncoming.length > 0 ? (
            <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Requests</p>
              <p className="mt-2 text-[14px] text-dc-text">{pendingIncoming.length} waiting</p>
              <Link
                to={reservationsHref}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-dc-accent"
                onClick={() => onOpenReservations?.()}
              >
                Review
              </Link>
            </div>
          ) : null}
          <div className="rounded-2xl border border-dc-border bg-dc-elevated px-4 py-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Full schedule</p>
            <Link
              to="/play/schedule"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-dc-accent"
            >
              Open schedule
            </Link>
          </div>
        </aside>
      </div>

      {composerOpen ? (
        <PlaySpaceBlockComposer
          timezone={timezone}
          spaceStartsAt={windowStart}
          spaceEndsAt={windowEnd}
          defaultDayKey={selectedDay}
          initial={editing}
          busy={composerBusy}
          onCancel={() => {
            setComposerOpen(false)
            setEditing(null)
          }}
          onSave={saveBlock}
        />
      ) : null}

      {shareOpen ? (
        <PlaySpaceShareFreeTimeSheet
          slug={slug}
          bufferMinutes={bufferMinutes}
          shares={shares}
          busy={shareBusy}
          autoShareOnOpen={autoShareOnOpen}
          onClose={() => {
            setShareOpen(false)
            setAutoShareOnOpen(false)
          }}
          onSetBuffer={async (m) => {
            setShareBusy(true)
            try {
              await patchPrefs(slug, { bufferMinutes: m })
              setBufferMinutes(m)
            } finally {
              setShareBusy(false)
            }
          }}
          onCreateShare={async () => {
            setShareBusy(true)
            try {
              return await ensureShareUrl()
            } finally {
              setShareBusy(false)
            }
          }}
          onRevoke={async (id) => {
            setShareBusy(true)
            try {
              await revokeShare(slug, id)
              await reload()
            } finally {
              setShareBusy(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}
