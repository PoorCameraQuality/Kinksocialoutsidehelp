import { RSVP_LABEL_INTERESTED } from '@c2k/shared'
import { Link } from 'react-router-dom'
import { OrgHubSectionCard } from '@/components/org/hub/OrgHubSectionCard'
import type { OrgCalendarLoadState } from '@/lib/org-calendar-fetch'

export type OrgHubCalendarEvent = {
  id: string
  title: string
  startsAt: string
  location?: string | null
  ticketPurchaseUrl?: string | null
  hasProgram?: boolean
  conventionSlug?: string | null
  programSlotCount?: number
  rsvpCount?: number
  viewerRsvpStatus?: 'going' | 'maybe' | null
}

export type OrgHubCalendarConvention = {
  id: string
  slug: string
  name: string
  startsAt: string
  endsAt: string
  slotCount: number
  anchorEventId: string | null
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDateBlock(iso: string) {
  const d = new Date(iso)
  return {
    month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleString(undefined, { weekday: 'short' }),
  }
}

export function OrgHubCalendarTab({
  events,
  conventions,
  calendarLoadState,
  canManageOrg,
  orgSlug,
  isAuthenticated,
  onRsvp,
}: {
  events: OrgHubCalendarEvent[] | null
  conventions: OrgHubCalendarConvention[] | null
  calendarLoadState: OrgCalendarLoadState
  canManageOrg: boolean
  orgSlug: string
  isAuthenticated: boolean
  onRsvp: (eventId: string, mode: 'going' | 'maybe' | 'clear') => void
}) {
  if (calendarLoadState === 'loading' || events === null || conventions === null) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        <div className="h-56 animate-pulse rounded-2xl bg-dc-elevated-muted" />
      </div>
    )
  }

  if (calendarLoadState === 'error') {
    return (
      <OrgHubSectionCard eyebrow="Calendar" title="Events & conventions">
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-dc-text">Could not load the calendar</p>
          <p className="mt-2 text-sm text-dc-muted">Try refreshing the page in a moment.</p>
        </div>
      </OrgHubSectionCard>
    )
  }

  if (calendarLoadState === 'disabled') {
    return (
      <OrgHubSectionCard eyebrow="Calendar" title="Events & conventions">
        <div className="rounded-xl border border-dashed border-dc-border-strong px-4 py-8 text-center">
          <p className="text-sm font-medium text-dc-text">Events &amp; conventions disabled in org settings</p>
          <p className="mt-2 text-sm text-dc-muted">
            Organizers can turn the calendar back on when they are ready to publish programs.
          </p>
          {canManageOrg ?
            <Link
              to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=settings&settingsSection=features`}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Open feature settings
            </Link>
          : null}
        </div>
      </OrgHubSectionCard>
    )
  }

  const now = Date.now()
  const upcomingConventions = [...conventions]
    .filter((c) => new Date(c.endsAt).getTime() >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  const anchorIds = new Set(conventions.map((c) => c.anchorEventId).filter(Boolean) as string[])

  const upcomingEvents = [...events]
    .filter((e) => new Date(e.startsAt).getTime() >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  const featuredConvention = upcomingConventions[0] ?? null
  const featuredEvent =
    upcomingEvents.find((e) => e.hasProgram || e.conventionSlug) ??
    upcomingEvents.find((e) => !featuredConvention || e.id !== featuredConvention.anchorEventId) ??
    null

  const remainingConventions = upcomingConventions.filter((c) => c.id !== featuredConvention?.id)
  const calendarOnlyEvents = upcomingEvents.filter((e) => {
    if (featuredEvent && e.id === featuredEvent.id) return false
    if (anchorIds.has(e.id) && upcomingConventions.some((c) => c.anchorEventId === e.id)) return false
    return true
  })

  const nothingUpcoming = !featuredConvention && !featuredEvent && remainingConventions.length === 0 && calendarOnlyEvents.length === 0

  return (
    <div className="space-y-6">
      {(featuredConvention || featuredEvent) && (
        <OrgHubSectionCard eyebrow="Featured" title="Next on the calendar">
          {featuredConvention ?
            <FeaturedConventionCard convention={featuredConvention} />
          : featuredEvent ?
            <FeaturedEventCard event={featuredEvent} isAuthenticated={isAuthenticated} onRsvp={onRsvp} />
          : null}
        </OrgHubSectionCard>
      )}

      {remainingConventions.length > 0 ?
        <OrgHubSectionCard
          eyebrow="Programs"
          title="Programs & conventions"
          description="Multi-day program shells with a full schedule inside."
        >
          <ul className="space-y-3">
            {remainingConventions.map((c) => (
              <li key={c.id}>
                <ConventionListCard convention={c} />
              </li>
            ))}
          </ul>
        </OrgHubSectionCard>
      : null}

      <OrgHubSectionCard
        eyebrow="Events"
        title="Calendar events"
        description={
          anchorIds.size > 0 ?
            'Public listings on the org calendar. Program weekends may also appear above as convention shells.'
          : 'Public listings on the org calendar.'
        }
      >
        {nothingUpcoming ?
          <div className="rounded-xl border border-dashed border-dc-border-strong px-4 py-8 text-center">
            <p className="text-sm font-medium text-dc-text">No upcoming events yet</p>
            <p className="mt-2 text-sm text-dc-muted">
              Check back soon, or join the organization to hear about new events.
            </p>
          </div>
        : calendarOnlyEvents.length === 0 ?
          <p className="text-sm text-dc-text-muted">No additional calendar events right now.</p>
        : <ul className="space-y-3">
            {calendarOnlyEvents.map((ev) => (
              <li key={ev.id}>
                <CalendarEventCard event={ev} isAuthenticated={isAuthenticated} onRsvp={onRsvp} />
              </li>
            ))}
          </ul>
        }
      </OrgHubSectionCard>
    </div>
  )
}

function FeaturedConventionCard({ convention }: { convention: OrgHubCalendarConvention }) {
  const start = formatDateBlock(convention.startsAt)
  return (
    <div className="overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-br from-teal-950/50 via-dc-elevated-solid to-slate-950/80">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center sm:gap-1 sm:px-2">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-teal-400/30 bg-black/30 text-center">
            <span className="text-[10px] font-semibold tracking-wide text-teal-200/90">{start.month}</span>
            <span className="text-2xl font-bold leading-none text-teal-50">{start.day}</span>
          </div>
          <span className="text-xs text-dc-muted sm:text-center">{start.weekday}</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100">
            Convention program
          </span>
          <h3 className="mt-2 text-xl font-semibold text-dc-text">{convention.name}</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            {formatEventDate(convention.startsAt)} – {formatEventDate(convention.endsAt)}
          </p>
          <p className="mt-1 text-sm text-dc-muted">
            {convention.slotCount} program slot{convention.slotCount === 1 ? '' : 's'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/conventions/${encodeURIComponent(convention.slug)}?tab=Schedule`}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              View schedule
            </Link>
            <Link
              to={`/conventions/${encodeURIComponent(convention.slug)}#get-involved`}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border/50 px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/10"
            >
              Present / apply
            </Link>
            {convention.anchorEventId ?
              <Link
                to={`/events/${convention.anchorEventId}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 py-2 text-sm font-semibold text-dc-text-muted hover:text-dc-text"
              >
                Event page
              </Link>
            : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeaturedEventCard({
  event,
  isAuthenticated,
  onRsvp,
}: {
  event: OrgHubCalendarEvent
  isAuthenticated: boolean
  onRsvp: (eventId: string, mode: 'going' | 'maybe' | 'clear') => void
}) {
  const start = formatDateBlock(event.startsAt)
  const isProgram = Boolean(event.hasProgram || event.conventionSlug)
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/35 via-dc-elevated-solid to-dc-surface">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center sm:gap-1 sm:px-2">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-amber-400/25 bg-black/30 text-center">
            <span className="text-[10px] font-semibold tracking-wide text-amber-200/90">{start.month}</span>
            <span className="text-2xl font-bold leading-none text-amber-50">{start.day}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {isProgram ?
            <span className="inline-flex rounded-full bg-dc-accent/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
              Program event
            </span>
          : null}
          <h3 className="mt-2 text-xl font-semibold text-dc-text">{event.title}</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            {formatEventDate(event.startsAt)} · {event.location ?? 'Location TBA'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/events/${event.id}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              View event
            </Link>
            {event.conventionSlug ?
              <Link
                to={`/conventions/${encodeURIComponent(event.conventionSlug)}?tab=Schedule`}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border/50 px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/10"
              >
                View schedule
                {typeof event.programSlotCount === 'number' && event.programSlotCount > 0 ?
                  ` (${event.programSlotCount})`
                : ''}
              </Link>
            : null}
          </div>
          <RsvpRow event={event} isAuthenticated={isAuthenticated} onRsvp={onRsvp} />
        </div>
      </div>
    </div>
  )
}

function ConventionListCard({ convention }: { convention: OrgHubCalendarConvention }) {
  return (
    <div className="rounded-xl border border-dc-border bg-dc-elevated-muted/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">Program shell</p>
          <Link
            to={`/conventions/${encodeURIComponent(convention.slug)}?tab=Schedule`}
            className="mt-1 block text-base font-semibold text-dc-text hover:text-dc-accent"
          >
            {convention.name}
          </Link>
          <p className="mt-1 text-xs text-dc-muted">
            {formatEventDate(convention.startsAt)} – {formatEventDate(convention.endsAt)} · {convention.slotCount}{' '}
            slots
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link
          to={`/conventions/${encodeURIComponent(convention.slug)}?tab=Schedule`}
          className="inline-flex min-h-10 items-center rounded-lg border border-dc-accent-border/40 px-3 py-1.5 text-xs font-semibold text-dc-accent hover:bg-dc-accent/10"
        >
          View schedule
        </Link>
        <Link
          to={`/conventions/${encodeURIComponent(convention.slug)}#get-involved`}
          className="inline-flex min-h-10 items-center rounded-lg border border-dc-border px-3 py-1.5 text-xs font-semibold text-dc-text-muted hover:text-dc-text"
        >
          Present / apply
        </Link>
        </div>
      </div>
    </div>
  )
}

function CalendarEventCard({
  event,
  isAuthenticated,
  onRsvp,
}: {
  event: OrgHubCalendarEvent
  isAuthenticated: boolean
  onRsvp: (eventId: string, mode: 'going' | 'maybe' | 'clear') => void
}) {
  const start = formatDateBlock(event.startsAt)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dc-border bg-dc-elevated-muted/30 p-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center gap-3 sm:w-20 sm:flex-col sm:gap-0">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-dc-border bg-dc-surface-muted text-center">
          <span className="text-[9px] font-semibold uppercase text-dc-muted">{start.month}</span>
          <span className="text-lg font-bold leading-none text-dc-text">{start.day}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">Public calendar listing</p>
        <Link to={`/events/${event.id}`} className="mt-1 block text-base font-semibold text-dc-text hover:text-dc-accent">
          {event.title}
        </Link>
        <p className="mt-1 text-xs text-dc-muted">
          {formatEventDate(event.startsAt)} · {event.location ?? 'TBA'}
        </p>
        {event.hasProgram && event.conventionSlug ?
          <Link
            to={`/conventions/${encodeURIComponent(event.conventionSlug)}?tab=Schedule&programView=list`}
            className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline"
          >
            Linked program schedule
            {typeof event.programSlotCount === 'number' && event.programSlotCount > 0 ?
              ` · ${event.programSlotCount} slots`
            : ''}
          </Link>
        : null}
        <RsvpRow event={event} isAuthenticated={isAuthenticated} onRsvp={onRsvp} />
      </div>
    </div>
  )
}

function RsvpRow({
  event,
  isAuthenticated,
  onRsvp,
}: {
  event: OrgHubCalendarEvent
  isAuthenticated: boolean
  onRsvp: (eventId: string, mode: 'going' | 'maybe' | 'clear') => void
}) {
  if (!isAuthenticated) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dc-border-subtle pt-3">
      <button
        type="button"
        onClick={() => onRsvp(event.id, 'going')}
        className={`min-h-10 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          event.viewerRsvpStatus === 'going'
            ? 'border-dc-accent bg-dc-accent/20 text-dc-text'
            : 'border-dc-border text-dc-text-muted hover:text-dc-text'
        }`}
      >
        Going
      </button>
      <button
        type="button"
        onClick={() => onRsvp(event.id, 'maybe')}
        className={`min-h-10 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          event.viewerRsvpStatus === 'maybe'
            ? 'border-dc-accent bg-dc-accent/20 text-dc-text'
            : 'border-dc-border text-dc-text-muted hover:text-dc-text'
        }`}
      >
        {RSVP_LABEL_INTERESTED}
      </button>
      {event.viewerRsvpStatus ?
        <button type="button" onClick={() => onRsvp(event.id, 'clear')} className="text-xs text-dc-muted">
          Clear
        </button>
      : null}
      {typeof event.rsvpCount === 'number' ?
        <span className="text-xs text-dc-muted">{event.rsvpCount} RSVPs</span>
      : null}
    </div>
  )
}
