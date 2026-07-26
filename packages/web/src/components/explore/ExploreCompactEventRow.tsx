import { Link } from 'react-router-dom'
import type { MockEvent } from '@/data/mock-data'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { eventDateBlock } from '@/lib/explore-hub'
import { resolveEventHeroUrl } from '@/lib/events-page-utils'

type Props = {
  event: MockEvent
  /** Hide thumbnail for narrow sidebars (e.g. Explore upcoming column). */
  hideThumb?: boolean
  className?: string
}

export default function ExploreCompactEventRow({ event, hideThumb = false, className = '' }: Props) {
  const { month, day } = eventDateBlock(event.date)
  const thumb = resolveEventHeroUrl(event)
  const goingLabel =
    event.capacityLimit && event.capacityLimit > 0 ?
      `${event.rsvpCount}/${event.capacityLimit} going`
    : `${event.rsvpCount} going`

  return (
    <li className={className}>
      <Link
        to={`/events/${encodeURIComponent(String(event.id))}`}
        className="xpl-row-card gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        <div className="xpl-date-badge">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">{month}</span>
          <span className="text-lg font-bold leading-none text-dc-text">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dc-text line-clamp-2">{event.title}</p>
          <p className="text-xs text-dc-muted mt-0.5">{event.date}</p>
          {event.location ?
            <p className="text-xs font-medium text-dc-text-muted line-clamp-1 mt-0.5">{event.location}</p>
          : null}
          <p className="text-xs font-medium text-dc-accent mt-1">{goingLabel}</p>
          {event.mutualGoingCount != null && event.mutualGoingCount > 0 ?
            <p className="text-[11px] text-dc-text-muted mt-0.5">{event.mutualGoingCount} connections going</p>
          : null}
        </div>
        {hideThumb ? null : (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-dc-border">
            {thumb ?
              <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
            : <MediaSurfaceFallback variant="event" compact className="h-full" />}
          </div>
        )}
      </Link>
    </li>
  )
}
