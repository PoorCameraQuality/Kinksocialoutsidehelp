import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import {
  conventionDateRangeLabel,
  type ConventionDiscoverView,
} from '@/lib/conventions-page-utils'

type Props = {
  view: ConventionDiscoverView
}

export default function ConventionsFeaturedCard({ view }: Props) {
  const { row } = view
  const href = `/conventions/${encodeURIComponent(row.slug)}`
  const scheduleHref = `${href}?tab=schedule`

  return (
    <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]">
      <div className="relative aspect-[16/10] w-full bg-dc-surface-muted md:aspect-[16/9]">
        <img src={view.heroUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {view.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-md bg-dc-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dc-accent-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-dc-text">{row.name}</h3>
        <p className="mt-1 text-sm text-dc-accent">{conventionDateRangeLabel(row)}</p>
        <p className="mt-0.5 text-sm text-dc-text-muted">{view.location}</p>
        <p className="mt-2 line-clamp-2 text-sm text-dc-muted">{view.description}</p>

        <dl className="mt-3 flex flex-wrap gap-3 text-xs text-dc-text-muted">
          <div>
            <dt className="sr-only">Duration</dt>
            <dd>{view.durationLabel}</dd>
          </div>
          <div>
            <dt className="sr-only">Events</dt>
            <dd>{view.eventCount} events</dd>
          </div>
          <div>
            <dt className="sr-only">Venue</dt>
            <dd>{view.venueType}</dd>
          </div>
        </dl>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex -space-x-1.5" aria-hidden>
            {view.goingPreview.map((p, i) =>
              p.avatarUrl ?
                <img
                  key={p.username}
                  src={p.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full ring-2 ring-dc-elevated-solid"
                  style={{ zIndex: i }}
                />
              : <PlaceholderAvatar key={p.username} size="sm" className="!h-7 !w-7 ring-2 ring-dc-elevated-solid" />,
            )}
          </span>
          <span className="text-xs text-dc-muted">{view.goingCount} going</span>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Link
            to={href}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:flex-none"
          >
            View Details
          </Link>
          <Link
            to={scheduleHref}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-dc-accent-border px-4 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted sm:flex-none"
          >
            View Schedule
          </Link>
        </div>
      </div>
    </article>
  )
}
