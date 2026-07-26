import { Link } from 'react-router-dom'

export type VenueEventRow = {
  id: string
  title: string
  startsAt: string
  endsAt?: string | null
  location?: string | null
  publicLocationSummary?: string | null
  imageUrl?: string | null
  hostOrganization?: { slug: string; displayName: string } | null
}

function formatWhen(startsAt: string, endsAt?: string | null) {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return startsAt
  const end = endsAt ? new Date(endsAt) : null
  const date = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (end && !Number.isNaN(end.getTime()) && end.toDateString() !== start.toDateString()) {
    const endDate = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${date} ${time} – ${endDate}`
  }
  return `${date} · ${time}`
}

export default function VenueEventsList({
  events,
  title = 'Events at this venue',
}: {
  events: VenueEventRow[]
  title?: string
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-5">
        <h2 className="text-lg font-semibold text-dc-text">{title}</h2>
        <p className="mt-2 text-sm text-dc-text-muted">No upcoming public events listed yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-5">
      <h2 className="text-lg font-semibold text-dc-text">{title}</h2>
      <ul className="mt-4 space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="rounded-xl border border-dc-border/80 bg-dc-surface/30 px-4 py-3">
            <Link to={`/events/${encodeURIComponent(ev.id)}`} className="font-semibold text-dc-accent hover:underline">
              {ev.title}
            </Link>
            <p className="mt-1 text-sm text-dc-text-muted">{formatWhen(ev.startsAt, ev.endsAt)}</p>
            {ev.publicLocationSummary || ev.location ?
              <p className="mt-1 text-xs text-dc-muted">{ev.publicLocationSummary ?? ev.location}</p>
            : null}
            {ev.hostOrganization ?
              <Link
                to={`/orgs/${encodeURIComponent(ev.hostOrganization.slug)}`}
                className="mt-2 inline-flex text-xs font-medium text-dc-text-muted hover:text-dc-accent"
              >
                Hosted by {ev.hostOrganization.displayName}
              </Link>
            : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
