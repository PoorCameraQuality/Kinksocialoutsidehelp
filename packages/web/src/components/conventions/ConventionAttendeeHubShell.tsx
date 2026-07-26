import { useCallback, useMemo, useState, type ReactNode } from 'react'
import ConventionDancecardPanel from '@/components/conventions/ConventionDancecardPanel'
import ConventionScheduleAgenda, { type ScheduleLayout } from '@/components/conventions/ConventionScheduleAgenda'
import ConventionAttendeeGroupsPanel from '@/components/conventions/ConventionAttendeeGroupsPanel'
import VenueMapsList from '@/components/conventions/VenueMapsList'
import ConventionAttendeeProfilePanel from '@/components/conventions/ConventionAttendeeProfilePanel'
import ConventionAttendeeComparePanel from '@/components/conventions/ConventionAttendeeComparePanel'
import ConventionAttendeeIsoMiniPanel from '@/components/conventions/ConventionAttendeeIsoMiniPanel'

export type AttendeeHubView =
  | 'program'
  | 'dancecard'
  | 'profile'
  | 'compare'
  | 'reservations'
  | 'iso'
  | 'groups'
  | 'maps'

const CARDS: Array<{ key: AttendeeHubView; label: string; blurb: string }> = [
  { key: 'program', label: 'Program', blurb: 'Browse the official schedule and add sessions to your dancecard.' },
  { key: 'dancecard', label: 'My availability', blurb: 'Block off time and share availability with others via a link.' },
  { key: 'profile', label: 'Profile', blurb: 'Photo, bio, contacts, and how others see you on Compare.' },
  { key: 'compare', label: 'Compare', blurb: 'Shared schedules by share link. Find mutual free time.' },
  { key: 'reservations', label: 'Reservations', blurb: 'Track confirmed scenes and pending requests.' },
  { key: 'iso', label: 'ISO board', blurb: 'Connection posts and threaded discussion.' },
  { key: 'groups', label: 'Attendee groups', blurb: 'Tent cities, room blocks, chores, and bring lists.' },
  { key: 'maps', label: 'Venue map', blurb: 'Floor plans and labeled rooms.' },
]

type SlotDay = Parameters<typeof ConventionScheduleAgenda>[0]['slotsByDay']

type Props = {
  slug: string
  timezone: string
  reloadKey?: number
  slotsByDay: SlotDay
  programLayout: ScheduleLayout
  onProgramLayoutChange: (layout: ScheduleLayout) => void
  onAddToDancecard: (slotId: string) => void | Promise<void>
  isoContent?: ReactNode
  showGroups?: boolean
  actionNotice?: { type: 'success' | 'error'; text: string } | null
  onDismissActionNotice?: () => void
  onOpenIsoTab?: () => void
  /** Switch to the convention hub Schedule tab (Q11 cross-link). */
  onOpenScheduleTab?: () => void
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
  actionNotice = null,
  onDismissActionNotice,
  onOpenIsoTab,
  onOpenScheduleTab,
}: Props) {
  const [view, setView] = useState<AttendeeHubView>('program')
  const [reservationsOnly, setReservationsOnly] = useState(false)

  const visibleCards = useMemo(
    () => CARDS.filter((c) => (c.key === 'groups' ? showGroups : true)),
    [showGroups],
  )

  const active = visibleCards.find((c) => c.key === view) ?? visibleCards[0]

  const openView = useCallback((key: AttendeeHubView) => {
    if (key === 'reservations') {
      setReservationsOnly(true)
      setView('dancecard')
      return
    }
    setReservationsOnly(false)
    setView(key)
  }, [])

  return (
    <div className="dc-attendee-hub space-y-6">
      <p className="text-sm text-dc-text-muted">
        Your weekend command center. Program, availability, compare, and groups stay in sync with what organizers
        publish.{' '}
        {onOpenScheduleTab ?
          <>
            The full multi-day program is on the{' '}
            <button type="button" className="text-dc-accent hover:underline" onClick={onOpenScheduleTab}>
              Schedule
            </button>{' '}
            tab.
          </>
        : null}
      </p>

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
                className="min-h-9 shrink-0 rounded-lg border border-dc-border px-3 text-xs text-dc-text hover:bg-dc-elevated-muted"
                onClick={onDismissActionNotice}
              >
                Dismiss
              </button>
            : null}
          </div>
        </div>
      : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCards.map((card) => {
          const selected = view === card.key || (card.key === 'reservations' && view === 'dancecard' && reservationsOnly)
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => openView(card.key)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected
                  ? 'border-dc-accent-border/50 bg-dc-accent/10 ring-1 ring-dc-accent/30'
                  : 'border-dc-border bg-dc-elevated/95 hover:border-dc-accent-border/30'
              }`}
            >
              <p className={`text-sm font-semibold ${selected ? 'text-dc-accent' : 'text-dc-text'}`}>{card.label}</p>
              <p className="mt-1 text-xs text-dc-muted line-clamp-2">{card.blurb}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-dc-border bg-dc-elevated/80 p-4 sm:p-6">
        <h2 className="font-serif text-xl text-dc-text">{active?.label}</h2>
        <p className="mt-1 text-sm text-dc-muted">{active?.blurb}</p>

        <div className="mt-6">
          {view === 'program' ?
            slotsByDay.length === 0 ?
              <p className="text-sm text-dc-muted">No schedule slots yet.</p>
            : <ConventionScheduleAgenda
                slotsByDay={slotsByDay}
                timezone={timezone}
                onAddToDancecard={onAddToDancecard}
                programLayout={programLayout}
                onProgramLayoutChange={onProgramLayoutChange}
              />

          : view === 'dancecard' ?
            <div className="max-h-[min(72rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {onOpenScheduleTab ?
                <p className="mb-3 text-xs text-dc-muted">
                  Official program grid:{' '}
                  <button type="button" className="text-dc-accent hover:underline" onClick={onOpenScheduleTab}>
                    Schedule tab
                  </button>
                  . Add sessions from there or from Program below.
                </p>
              : null}
              {reservationsOnly ?
                <p className="mb-3 text-xs text-dc-muted">
                  Showing reservations and scene requests.{' '}
                  <button type="button" className="text-dc-accent hover:underline" onClick={() => setReservationsOnly(false)}>
                    Show full dancecard
                  </button>
                </p>
              : null}
              <ConventionDancecardPanel
                slug={slug}
                timezone={timezone}
                reloadKey={reloadKey}
                focusReservations={reservationsOnly}
              />
            </div>

          : view === 'profile' ?
            <ConventionAttendeeProfilePanel />

          : view === 'compare' ?
            <ConventionAttendeeComparePanel conventionKey={slug} />

          : view === 'iso' ?
            isoContent ?? <ConventionAttendeeIsoMiniPanel conventionKey={slug} onOpenFullTab={onOpenIsoTab} />

          : view === 'groups' ?
            <ConventionAttendeeGroupsPanel conventionKey={slug} />

          : view === 'maps' ?
            <VenueMapsList conventionKey={slug} />

          : null}
        </div>
      </div>
    </div>
  )
}
