import { Link } from 'react-router-dom'
import EmptyState from '@/components/ui/EmptyState'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

export type OrgEventRow = {
  id: string
  title: string
  startsAt?: string
  conventionSlug?: string | null
}

type Props = {
  events: OrgEventRow[]
  conventions: { slug: string; title: string }[]
  orgSlug: string
  calendarEnabled: boolean
  showSettings?: boolean
  onCreateEvent?: () => void
  onCreateConvention?: () => void
}

function formatWhen(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function UpcomingOrgEventsCard({
  events,
  conventions,
  orgSlug,
  calendarEnabled,
  showSettings = false,
  onCreateEvent,
  onCreateConvention,
}: Props) {
  const now = Date.now()
  const upcoming = events
    .filter((e) => {
      if (!e.startsAt) return true
      return new Date(e.startsAt).getTime() >= now
    })
    .slice(0, 5)

  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`

  return (
    <OrganizerPanel
      title="Upcoming events & programs"
      description="Calendar items on this organization's schedule."
      actions={
        calendarEnabled && onCreateEvent ?
          <button
            type="button"
            onClick={onCreateEvent}
            className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Create event
          </button>
        : null
      }
    >
      {!calendarEnabled ?
        <p className="text-sm text-dc-text-muted">
          Calendar is disabled.
          {showSettings ?
            <>
              {' '}
              <Link to={`${orgBase}?tab=settings&settingsSection=features`} className="text-dc-accent hover:underline">
                Enable it in Settings → Features
              </Link>
            </>
          : ' Ask an owner or admin to enable it in Settings → Features.'}
        </p>
      : upcoming.length === 0 && conventions.length === 0 ?
        <EmptyState
          inline
          title="No events yet"
          message="Create your first event or convention program so members have something on the calendar."
          actionLabel={onCreateEvent ? 'Create event' : undefined}
          onAction={onCreateEvent}
          secondaryCtaLabel={onCreateConvention ? 'Create convention' : undefined}
          secondaryOnAction={onCreateConvention}
        />
      : (
        <ul className="space-y-2">
          {conventions.slice(0, 3).map((c) => (
            <li key={c.slug}>
              <Link
                to={`${orgBase}/conventions/${encodeURIComponent(c.slug)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-dc-border px-3 py-2.5 hover:border-dc-accent-border/40"
              >
                <span className="text-sm text-dc-text">{c.title}</span>
                <span className="shrink-0 text-dc-micro text-dc-muted">Program</span>
              </Link>
            </li>
          ))}
          {upcoming.map((ev) => (
            <li key={ev.id}>
              <Link
                to={`${orgBase}/events/${encodeURIComponent(ev.id)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-dc-border px-3 py-2.5 hover:border-dc-accent-border/40"
              >
                <span className="text-sm text-dc-text">{ev.title}</span>
                {ev.startsAt ?
                  <span className="shrink-0 text-dc-micro text-dc-muted">{formatWhen(ev.startsAt)}</span>
                : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OrganizerPanel>
  )
}
