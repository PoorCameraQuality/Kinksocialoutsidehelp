import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import EventFiltersPanel, { type EventFilterState } from '@/components/events/EventFiltersPanel'
import EventsSectionNavLinks from '@/components/events/EventsSectionNavLinks'
import { formatMyRsvpLabel } from '@/hooks/useApiMyRsvps'
import EmptyState from '@/components/ui/EmptyState'
import { buildEventIcsDownloadUrl } from '@/lib/event-calendar-links'

type AgendaRow = {
  eventId: string
  title: string
  startsAt: string
  status: string
  organizing: boolean
}

type Props = {
  showDiscoverFilters?: boolean
  filterState?: EventFilterState
  categoryCounts?: Map<string, number>
  agendaLoading: boolean
  agendaError: boolean
  onAgendaRetry: () => void
  upcomingAgenda: AgendaRow[]
  pastRsvpCount: number
  showAgenda: boolean
  showMockAgenda?: boolean
}

export default function EventsDiscoverLeftRail({
  showDiscoverFilters = true,
  filterState,
  categoryCounts,
  agendaLoading,
  agendaError,
  onAgendaRetry,
  upcomingAgenda,
  pastRsvpCount,
  showAgenda,
  showMockAgenda,
}: Props) {
  const { pathname, search } = useLocation()
  const [filtersOpen, setFiltersOpen] = useState(filterState?.hasActiveFilters ?? false)

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Events navigation and filters">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <div className={showDiscoverFilters ? 'border-b border-dc-border pb-4' : undefined}>
          <EventsSectionNavLinks pathname={pathname} search={search} />
        </div>

        {showDiscoverFilters && filterState && categoryCounts ?
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="mb-1 flex w-full min-h-10 items-center justify-between rounded-xl px-2 text-sm font-semibold text-dc-text hover:bg-dc-elevated-hover"
              aria-expanded={filtersOpen}
            >
              <span>Refine results</span>
              <span className="text-dc-muted" aria-hidden>
                {filtersOpen ? '−' : '+'}
              </span>
            </button>
            <p className="mb-3 px-2 text-xs text-dc-text-muted">Date, format, category, and location.</p>
            {filtersOpen ?
              <EventFiltersPanel idPrefix="evt-rail" f={filterState} categoryCounts={categoryCounts} />
            : null}
          </div>
        : null}
      </div>

      {showAgenda ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
          <h3 className="mb-3 text-sm font-semibold text-dc-text">My agenda</h3>
          {agendaLoading ?
            <ul className="space-y-2" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <li key={i} className="h-10 animate-pulse rounded-lg bg-dc-elevated-muted" />
              ))}
            </ul>
          : agendaError ?
            <div className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
              <p className="mb-2">Could not load agenda.</p>
              <button type="button" onClick={onAgendaRetry} className="text-xs underline">
                Retry
              </button>
            </div>
          : upcomingAgenda.length === 0 ?
            <EmptyState
              inline
              message={
                pastRsvpCount > 0 ?
                  `No upcoming items. ${pastRsvpCount} past on your profile.`
                : 'No upcoming RSVPs yet.'
              }
              ctaLabel="Browse events"
              ctaHref="/events"
            />
          : <ul className="space-y-2 text-sm">
              {upcomingAgenda.slice(0, 5).map((r) => {
                const { date, title } = formatMyRsvpLabel(r)
                return (
                  <li key={r.eventId}>
                    <Link to={`/events/${encodeURIComponent(r.eventId)}`} className="text-dc-text-muted hover:text-dc-text">
                      <span className="font-medium text-dc-accent">{date}</span> · {title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          }
          {upcomingAgenda[0] ?
            <a
              href={buildEventIcsDownloadUrl(upcomingAgenda[0].eventId)}
              className="mt-4 flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-accent-border text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
              title={
                upcomingAgenda.length > 1 ?
                  `Download calendar file for soonest RSVP (${upcomingAgenda[0].title}). Open each event for its own .ics.`
                : `Download calendar file for ${upcomingAgenda[0].title}`
              }
            >
              Sync to calendar
            </a>
          : <button
              type="button"
              disabled
              className="mt-4 flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-xl border border-dc-border text-sm font-semibold text-dc-muted opacity-60"
              title="RSVP to an upcoming event to download a calendar file"
            >
              Sync to calendar
            </button>
          }
        </div>
      : showMockAgenda ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 text-sm text-dc-muted">
          Sign in to see your agenda and sync to calendar.
        </div>
      : null}
    </aside>
  )
}
