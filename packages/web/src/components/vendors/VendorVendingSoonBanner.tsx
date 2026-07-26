import { Link } from 'react-router-dom'

export type VendorVendingSoonItem = {
  eventId: string
  eventTitle: string
  startsAt: string
  conventionSlug?: string | null
}

type Props = {
  items: VendorVendingSoonItem[]
  className?: string
}

export default function VendorVendingSoonBanner({ items, className = '' }: Props) {
  if (items.length === 0) return null

  return (
    <section
      id="vending-soon"
      className={`scroll-mt-24 rounded-xl border border-dc-accent/35 bg-dc-accent/10 px-4 py-3 ${className}`}
      aria-label="Upcoming in-person vending"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent mb-2">Vending soon</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.eventId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-dc-text">{item.eventTitle}</span>
            <span className="text-dc-muted">·</span>
            <time className="text-dc-text-muted" dateTime={item.startsAt}>
              {new Date(item.startsAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </time>
            {item.conventionSlug ?
              <>
                <span className="text-dc-muted">·</span>
                <Link
                  to={`/conventions/${encodeURIComponent(item.conventionSlug)}`}
                  className="text-dc-accent hover:underline"
                >
                  Convention
                </Link>
              </>
            : null}
            <Link
              to={`/events/${encodeURIComponent(item.eventId)}`}
              className="text-dc-accent hover:underline text-xs"
            >
              Event details
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
