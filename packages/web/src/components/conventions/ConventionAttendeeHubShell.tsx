import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import ConventionDancecardPanel from '@/components/conventions/ConventionDancecardPanel'
import ConventionScheduleAgenda, { type ScheduleLayout } from '@/components/conventions/ConventionScheduleAgenda'
import ConventionAttendeeGroupsPanel from '@/components/conventions/ConventionAttendeeGroupsPanel'
import VenueMapsList from '@/components/conventions/VenueMapsList'
import ConventionAttendeeProfilePanel from '@/components/conventions/ConventionAttendeeProfilePanel'
import ConventionAttendeeComparePanel from '@/components/conventions/ConventionAttendeeComparePanel'
import ConventionAttendeeIsoMiniPanel from '@/components/conventions/ConventionAttendeeIsoMiniPanel'
import PlaySpaceIsoBoardPanel from '@/components/play/PlaySpaceIsoBoardPanel'
import PlaySpaceMyIsoPanel from '@/components/play/PlaySpaceMyIsoPanel'
import PlaySpaceMatchmakerPanel from '@/components/play/PlaySpaceMatchmakerPanel'
import PlaySpaceMyPlan from '@/components/play/my-plan/PlaySpaceMyPlan'
import PlaySpaceReservations from '@/components/play/reservations/PlaySpaceReservations'
import { listBookings } from '@/hooks/usePlaySpaceDancecard'
import type { DancecardApiKind } from '@/lib/dancecard/dancecardApiScope'

export type AttendeeHubView =
  | 'program'
  | 'dancecard'
  | 'profile'
  | 'compare'
  | 'reservations'
  | 'iso'
  | 'my-iso'
  | 'matchmaker'
  | 'groups'
  | 'maps'

const CARDS: Array<{ key: AttendeeHubView; label: string; shortLabel: string; blurb: string }> = [
  { key: 'program', label: 'Program', shortLabel: 'Program', blurb: 'Official schedule' },
  {
    key: 'dancecard',
    label: 'My availability',
    shortLabel: 'Avail',
    blurb: 'Blocks & share link',
  },
  { key: 'compare', label: 'Compare', shortLabel: 'Compare', blurb: 'Find mutual free time' },
  {
    key: 'reservations',
    label: 'Reservations',
    shortLabel: 'Reserve',
    blurb: 'Scene requests and confirmed plans',
  },
  { key: 'my-iso', label: 'My ISO', shortLabel: 'My ISO', blurb: 'Build your scene card' },
  { key: 'iso', label: 'ISO board', shortLabel: 'Board', blurb: 'Browse approachable scene cards' },
  { key: 'matchmaker', label: 'Matchmaker', shortLabel: 'Match', blurb: 'Private pickup-play matching' },
  { key: 'profile', label: 'Profile', shortLabel: 'Profile', blurb: 'Your KS card' },
  { key: 'maps', label: 'Venue map', shortLabel: 'Map', blurb: 'Floor plans' },
  { key: 'groups', label: 'Attendee groups', shortLabel: 'Groups', blurb: 'Room blocks & lists' },
]

type SlotDay = Parameters<typeof ConventionScheduleAgenda>[0]['slotsByDay']

type Props = {
  slug: string
  timezone: string
  reloadKey?: number
  slotsByDay: SlotDay
  programLayout?: ScheduleLayout
  onProgramLayoutChange?: (layout: ScheduleLayout) => void
  onAddToDancecard: (slotId: string) => void | Promise<void>
  isoContent?: ReactNode
  showGroups?: boolean
  /** When false, hides ISO board card. */
  showIso?: boolean
  /** When false, hides Matchmaker card. */
  showMatchmaker?: boolean
  /** conventions (default) or play-spaces API + chrome. */
  apiKind?: DancecardApiKind
  /** Owner of the play space (matchmaker settings). */
  isSpaceOwner?: boolean
  /** Owner-only light program/map editors rendered under Program / Map. */
  ownerExtras?: { program?: ReactNode; map?: ReactNode }
  /** When set, replaces the default convention agenda on the Program tab. */
  programPanel?: ReactNode
  actionNotice?: { type: 'success' | 'error'; text: string } | null
  onDismissActionNotice?: () => void
  onOpenIsoTab?: () => void
  /** Switch to the convention hub Schedule tab (Q11 cross-link). */
  onOpenScheduleTab?: () => void
  /** Called when My Plan mutates personal calendar items (keeps Program in sync). */
  onPlanMutated?: () => void
  introCopy?: string
  /** Play Space / event display name for My ISO listing copy. */
  eventTitle?: string
}

const PLAY_PRIMARY_KEYS: AttendeeHubView[] = ['program', 'dancecard', 'compare']

function isCardSelected(
  cardKey: AttendeeHubView,
  view: AttendeeHubView,
  reservationsOnly: boolean,
  playSpace: boolean,
): boolean {
  if (playSpace) {
    if (cardKey === 'reservations') return view === 'reservations'
    return view === cardKey
  }
  if (cardKey === 'reservations') return view === 'dancecard' && reservationsOnly
  if (cardKey === 'dancecard') return view === 'dancecard' && !reservationsOnly
  return view === cardKey
}

export default function ConventionAttendeeHubShell({
  slug,
  timezone,
  reloadKey = 0,
  slotsByDay,
  programLayout,
  onProgramLayoutChange,
  onAddToDancecard,
  isoContent,
  showGroups = true,
  showIso = true,
  showMatchmaker = false,
  apiKind = 'convention',
  isSpaceOwner = false,
  ownerExtras,
  programPanel,
  actionNotice = null,
  onDismissActionNotice,
  onOpenIsoTab,
  onOpenScheduleTab,
  onPlanMutated,
  introCopy,
  eventTitle,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<AttendeeHubView>('program')
  const [reservationsOnly, setReservationsOnly] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingReservationCount, setPendingReservationCount] = useState(0)
  const [openShareOnPlan, setOpenShareOnPlan] = useState(false)
  const tabStripRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const compactChrome = apiKind === 'play-space'

  // Deep links: ?tab=plan&share=1 → My Plan with share sheet
  useEffect(() => {
    if (!compactChrome) return
    const tab = searchParams.get('tab')
    const share = searchParams.get('share')
    if (tab === 'plan' || tab === 'dancecard' || share === '1') {
      setView('dancecard')
      setReservationsOnly(false)
    }
    if (share === '1') setOpenShareOnPlan(true)
    if (tab || share) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      next.delete('share')
      setSearchParams(next, { replace: true })
    }
  }, [compactChrome, searchParams, setSearchParams])

  const visibleCards = useMemo(
    () =>
      CARDS.filter((c) => {
        if (c.key === 'groups') return showGroups
        if (c.key === 'iso' || c.key === 'my-iso') return showIso
        if (c.key === 'matchmaker') return showMatchmaker
        return true
      }).map((c) => {
        if (compactChrome && c.key === 'dancecard') {
          return { ...c, label: 'My Plan', shortLabel: 'Plan', blurb: 'Share free time' }
        }
        return c
      }),
    [showGroups, showIso, showMatchmaker, compactChrome],
  )
  const primaryCards = useMemo(() => {
    if (!compactChrome) return visibleCards
    return visibleCards.filter((c) => PLAY_PRIMARY_KEYS.includes(c.key))
  }, [compactChrome, visibleCards])
  const moreCards = useMemo(() => {
    if (!compactChrome) return []
    return visibleCards.filter((c) => !PLAY_PRIMARY_KEYS.includes(c.key))
  }, [compactChrome, visibleCards])

  const activeKey: AttendeeHubView =
    compactChrome
      ? view
      : view === 'dancecard' && reservationsOnly
        ? 'reservations'
        : view
  const active = visibleCards.find((c) => c.key === activeKey) ?? visibleCards[0]
  const activeHeading =
    compactChrome && activeKey === 'dancecard'
      ? 'My Plan'
      : compactChrome && activeKey === 'reservations'
        ? 'Reservations'
        : active?.label
  const useFlushPanel =
    (view === 'program' && Boolean(programPanel)) ||
    (compactChrome &&
      (view === 'dancecard' ||
        view === 'reservations' ||
        view === 'my-iso' ||
        view === 'iso' ||
        view === 'matchmaker'))

  const openView = useCallback(
    (key: AttendeeHubView) => {
      if (compactChrome) {
        setReservationsOnly(false)
        setView(key)
        return
      }
      if (key === 'reservations') {
        setReservationsOnly(true)
        setView('dancecard')
        return
      }
      setReservationsOnly(false)
      setView(key)
    },
    [compactChrome],
  )

  useEffect(() => {
    if (!compactChrome) return
    let cancelled = false
    void listBookings(slug)
      .then((d) => {
        if (cancelled) return
        const n = (d.incoming ?? []).filter((b) => b.status === 'PENDING').length
        setPendingReservationCount(n)
      })
      .catch(() => {
        if (!cancelled) setPendingReservationCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [compactChrome, slug, reloadKey, view])

  useEffect(() => {
    const el = tabBtnRefs.current.get(activeKey)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeKey])

  const defaultIntro = compactChrome
    ? null
    : 'Your weekend command center. Program, availability, compare, and groups stay in sync with what organizers publish.'

  const intro = introCopy ?? defaultIntro

  return (
    <div className="dc-attendee-hub space-y-4 md:space-y-6">
      {intro || onOpenScheduleTab ?
        <p className="hidden text-sm text-dc-text-muted md:block">
          {intro}
          {onOpenScheduleTab ?
            <>
              {intro ? ' ' : null}
              The full multi-day program is on the{' '}
              <button type="button" className="text-dc-accent hover:underline" onClick={onOpenScheduleTab}>
                Schedule
              </button>{' '}
              tab.
            </>
          : null}
        </p>
      : null}

      {actionNotice ?
        <div
          role={actionNotice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-3 py-2 text-sm ${
            actionNotice.type === 'error'
              ? 'border-red-500/30 bg-red-950/25 text-red-200'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{actionNotice.text}</p>
            {onDismissActionNotice ?
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg border border-dc-border px-3 text-xs text-dc-text hover:bg-dc-elevated-muted"
                onClick={onDismissActionNotice}
              >
                Dismiss
              </button>
            : null}
          </div>
        </div>
      : null}

      {/* Mobile: sticky section tabs */}
      <div
        ref={tabStripRef}
        className="sticky top-0 z-20 -mx-4 border-b border-dc-border bg-dc-elevated/98 px-3 py-2 shadow-[var(--dc-shadow-soft)] backdrop-blur-md md:hidden"
        role="tablist"
        aria-label="Dancecard sections"
      >
        <div className={`grid gap-1.5 ${compactChrome ? 'grid-cols-4' : visibleCards.length > 6 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {(compactChrome ? primaryCards : visibleCards).map((card) => {
            const selected = isCardSelected(card.key, view, reservationsOnly, compactChrome)
            return (
              <button
                key={card.key}
                ref={(el) => {
                  if (el) tabBtnRefs.current.set(card.key, el)
                  else tabBtnRefs.current.delete(card.key)
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setMoreOpen(false)
                  openView(card.key)
                }}
                className={`min-h-11 rounded-xl px-1.5 py-2 text-center text-xs font-semibold leading-tight transition ${
                  selected
                    ? 'border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_14%,var(--dc-elevated))] text-dc-text'
                    : 'border border-dc-border bg-dc-elevated/90 text-dc-text hover:border-dc-accent/40'
                }`}
              >
                {card.key === 'dancecard' && compactChrome ? 'My plan' : card.shortLabel}
              </button>
            )
          })}
          {compactChrome && moreCards.length > 0 ? (
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={`min-h-11 rounded-xl border px-1.5 py-2 text-center text-xs font-semibold leading-tight ${
                moreOpen || moreCards.some((c) => isCardSelected(c.key, view, reservationsOnly, true))
                  ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_14%,var(--dc-elevated))] text-dc-text'
                  : 'border-dc-border bg-dc-elevated/90 text-dc-text'
              }`}
            >
              {pendingReservationCount > 0 ? `More · ${pendingReservationCount}` : 'More'}
            </button>
          ) : null}
        </div>
        {compactChrome && moreOpen ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {moreCards.map((card) => {
              const selected = isCardSelected(card.key, view, reservationsOnly, true)
              const label =
                card.key === 'reservations' && pendingReservationCount > 0
                  ? `${card.shortLabel} · ${pendingReservationCount}`
                  : card.shortLabel
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    openView(card.key)
                    setMoreOpen(false)
                  }}
                  className={`min-h-11 rounded-xl border px-1.5 py-2 text-center text-xs font-semibold ${
                    selected
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_14%,var(--dc-elevated))] text-dc-text'
                      : 'border-dc-border bg-dc-elevated/90 text-dc-text'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* Desktop / tablet: card grid */}
      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCards.map((card) => {
          const selected = isCardSelected(card.key, view, reservationsOnly, compactChrome)
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => openView(card.key)}
              className={`rounded-2xl border text-left transition ${
                compactChrome ? 'px-4 py-3' : 'p-4'
              } ${
                selected
                  ? compactChrome
                    ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_14%,var(--dc-elevated))]'
                    : 'border-dc-accent bg-dc-accent text-dc-accent-foreground shadow-[0_0_0_1px_rgba(212,175,55,0.35)]'
                  : 'border-dc-border bg-dc-elevated/95 hover:border-dc-accent-border/30'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  selected && !compactChrome ? 'text-dc-accent-foreground' : 'text-dc-text'
                }`}
              >
                {compactChrome && card.key === 'dancecard'
                  ? 'My plan'
                  : compactChrome && card.key === 'reservations' && pendingReservationCount > 0
                    ? `Reservations · ${pendingReservationCount}`
                    : card.label}
              </p>
              {!compactChrome ?
                <p className={`mt-1 text-xs line-clamp-2 ${selected ? 'text-dc-accent-foreground/80' : 'text-dc-muted'}`}>
                  {card.blurb}
                </p>
              : (
                <p className="mt-0.5 text-xs text-dc-muted line-clamp-1">{card.blurb}</p>
              )}
            </button>
          )
        })}
      </div>

      <div
        className={
          useFlushPanel
            ? 'min-w-0'
            : 'rounded-2xl border border-dc-border bg-dc-elevated/80 p-3 sm:p-4 md:p-6'
        }
      >
        {useFlushPanel ? null : (
          <>
            <h2 className="font-serif text-xl text-dc-text md:text-xl">
              <span className="md:hidden">{activeHeading}</span>
              <span className="hidden md:inline">{activeHeading}</span>
            </h2>
            {!compactChrome && active?.blurb ? (
              <p className="mt-1 hidden text-sm text-dc-muted md:block">{active.blurb}</p>
            ) : null}
          </>
        )}

        <div className={useFlushPanel ? '' : compactChrome ? 'mt-3 md:mt-4' : 'mt-4 md:mt-6'}>
          {view === 'program' ?
            <>
              {programPanel ? (
                programPanel
              ) : (
                <>
                  {slotsByDay.length === 0 ?
                    <p className="text-sm text-dc-muted">No schedule slots yet.</p>
                  : <ConventionScheduleAgenda
                      slotsByDay={slotsByDay}
                      timezone={timezone}
                      onAddToDancecard={onAddToDancecard}
                      programLayout={programLayout ?? 'cards'}
                      onProgramLayoutChange={onProgramLayoutChange ?? (() => {})}
                    />
                  }
                  {ownerExtras?.program}
                </>
              )}
            </>

          : view === 'reservations' && compactChrome ?
            <PlaySpaceReservations
              slug={slug}
              timezone={timezone}
              embedded
              onPendingCount={setPendingReservationCount}
              onMutated={onPlanMutated}
            />

          : view === 'dancecard' ?
            compactChrome ? (
              <PlaySpaceMyPlan
                slug={slug}
                timezone={timezone}
                reloadKey={reloadKey}
                onOpenReservations={() => openView('reservations')}
                onBrowseProgram={() => openView('program')}
                onPlanChanged={onPlanMutated}
                openShareRequest={openShareOnPlan}
                onOpenShareRequestHandled={() => setOpenShareOnPlan(false)}
              />
            ) : (
            <div className="md:max-h-[min(72rem,calc(100vh-12rem))] md:overflow-y-auto md:overscroll-contain md:pr-1 md:[-webkit-overflow-scrolling:touch]">
              {onOpenScheduleTab ?
                <p className="mb-3 hidden text-xs text-dc-muted md:block">
                  Official program grid:{' '}
                  <button type="button" className="text-dc-accent hover:underline" onClick={onOpenScheduleTab}>
                    Schedule tab
                  </button>
                  . Add sessions from there or from Program below.
                </p>
              : null}
              {reservationsOnly ?
                <p className="mb-3">
                  <button
                    type="button"
                    className="min-h-11 text-sm font-medium text-dc-accent-hover underline-offset-2 hover:underline"
                    onClick={() => setReservationsOnly(false)}
                  >
                    Show full availability
                  </button>
                </p>
              : null}
              <ConventionDancecardPanel
                slug={slug}
                timezone={timezone}
                reloadKey={reloadKey}
                focusReservations={reservationsOnly}
                apiKind={apiKind}
              />
            </div>
            )

          : view === 'profile' ?
            <ConventionAttendeeProfilePanel variant={apiKind === 'play-space' ? 'play-space' : 'convention'} />

          : view === 'compare' ?
            <ConventionAttendeeComparePanel conventionKey={slug} apiKind={apiKind} />

          : view === 'my-iso' ?
            <PlaySpaceMyIsoPanel
              slug={slug}
              eventTitle={eventTitle}
              onOpenBoard={apiKind === 'play-space' ? () => openView('iso') : undefined}
            />

          : view === 'iso' ?
            isoContent ??
            (apiKind === 'play-space' ?
              <PlaySpaceIsoBoardPanel
                slug={slug}
                eventTitle={eventTitle}
                onEditIso={() => openView('my-iso')}
              />
            : <ConventionAttendeeIsoMiniPanel conventionKey={slug} onOpenFullTab={onOpenIsoTab} />)

          : view === 'matchmaker' ?
            <PlaySpaceMatchmakerPanel slug={slug} isOwner={isSpaceOwner} eventTitle={eventTitle} />

          : view === 'groups' ?
            <ConventionAttendeeGroupsPanel conventionKey={slug} />

          : view === 'maps' ?
            <>
              <VenueMapsList conventionKey={slug} apiKind={apiKind} />
              {ownerExtras?.map}
            </>

          : null}
        </div>
      </div>
    </div>
  )
}
