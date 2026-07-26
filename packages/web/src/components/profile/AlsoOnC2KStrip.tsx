import { Link } from 'react-router-dom'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import { vendorProfilePath } from '@/lib/user-ecosystem'

type Props = {
  data: UserEcosystemPayload
  /** When false, omit upcoming event links (e.g. public profile keeps strip compact). */
  showUpcomingEvents?: boolean
}

function chipClass(active?: boolean) {
  return `inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
    active
      ? 'border-dc-accent-border/40 bg-dc-accent/15 text-dc-accent'
      : 'border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:text-dc-text hover:border-dc-accent-border/40'
  }`
}

export default function AlsoOnC2KStrip({ data, showUpcomingEvents = true }: Props) {
  const hasLinks =
    data.presenter != null ||
    data.vendor != null ||
    data.orgs.length > 0 ||
    data.groups.length > 0 ||
    (showUpcomingEvents && data.upcomingEvents.length > 0)

  if (!hasLinks) return null

  return (
    <div className="rounded-xl border border-dc-border bg-dc-elevated-solid/40 px-4 py-3 mb-6">
      <p className="text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2">Also on Kink Social</p>
      <div className="flex flex-wrap gap-2 items-center">
        {data.presenter && (
          <Link to={`/presenters/${encodeURIComponent(data.username)}`} className={chipClass(true)}>
            Presenter profile
          </Link>
        )}
        {data.vendor && (
          <Link to={vendorProfilePath(data.vendor)} className={chipClass(true)}>
            Shop · {data.vendor.displayName}
          </Link>
        )}
        {data.orgs.map((o) => (
          <Link key={o.slug} to={`/orgs/${encodeURIComponent(o.slug)}`} className={chipClass()}>
            {o.displayName}
          </Link>
        ))}
        {data.groups.map((g) => (
          <Link key={g.id} to={`/groups/${encodeURIComponent(g.id)}`} className={chipClass()}>
            {g.name}
          </Link>
        ))}
        {showUpcomingEvents &&
          data.upcomingEvents.slice(0, 3).map((e) => (
            <Link key={e.id} to={`/events/${encodeURIComponent(e.id)}`} className={chipClass()}>
              {e.title}
            </Link>
          ))}
      </div>
    </div>
  )
}
