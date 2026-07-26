import { Link } from 'react-router-dom'
import TagLink from '@/components/TagLink'
import Card from '@/components/ui/Card'
import { demoMockImageUrl } from '@/data/mock-data'
import { formatConventionDateRange, type ConventionKind } from '@/lib/convention-utils'
import type { EventCardProps } from '@/components/cards/EventCard'

export type ConventionCardProps = {
  convention: {
    id: string
    slug: string
    name: string
    startsAt?: string | null
    endsAt?: string | null
    kind?: ConventionKind
  }
  /** Anchor calendar event - supplies hero, location, RSVP when linked. */
  anchorEvent?: EventCardProps['event']
}

function kindLabel(kind?: ConventionKind): string {
  return kind === 'hotel_takeover' ? 'Hotel takeover' : 'Convention'
}

function heroDateLabel(startsAt?: string | null, endsAt?: string | null): string {
  const range = formatConventionDateRange(startsAt, endsAt)
  if (range) return range
  if (!startsAt) return ''
  const a = new Date(startsAt)
  if (Number.isNaN(a.getTime())) return ''
  return a.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ConventionCard({ convention, anchorEvent }: ConventionCardProps) {
  const { slug, name, startsAt, endsAt, kind } = convention
  const href = `/conventions/${encodeURIComponent(slug)}`
  const dateLabel = heroDateLabel(startsAt, endsAt)
  const heroSrc =
    anchorEvent?.imageUrl ?? anchorEvent?.bannerUrl ?? demoMockImageUrl(`convention-hero-${slug}`, 960, 480)
  const location = anchorEvent?.location?.trim() || 'Multi-day gathering. View hub for venue'
  const rsvpCount = anchorEvent?.rsvpCount ?? 0
  const capacityLimit = anchorEvent?.capacityLimit
  const fillPct =
    capacityLimit && capacityLimit > 0 ?
      Math.min(100, Math.round((rsvpCount / capacityLimit) * 100))
    : rsvpCount > 0 ?
      Math.min(100, Math.round((rsvpCount / 120) * 100))
    : 0
  const attendanceLabel =
    anchorEvent ?
      capacityLimit && capacityLimit > 0 ?
        `${rsvpCount}/${capacityLimit} on main event`
      : `${rsvpCount} interested`
    : 'Full program on hub'
  const tags = anchorEvent?.tags

  return (
    <Card className="relative overflow-hidden transition-colors hover:border-dc-accent-border/40">
      <div className="relative aspect-[2/1] bg-dc-elevated-solid">
        <Link to={href} className="absolute inset-0 z-0 block" aria-label={`View convention: ${name}`}>
          <img
            src={heroSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </Link>
        {dateLabel ?
          <span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[85%] rounded-lg bg-dc-elevated/95 px-2 py-1 text-xs font-medium text-dc-text backdrop-blur-sm">
            {dateLabel}
          </span>
        : null}
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg bg-dc-accent/90 px-2 py-1 text-xs font-medium text-dc-text">
          {kindLabel(kind)}
        </span>
      </div>
      <Link to={href} className="block p-4">
        <h3 className="line-clamp-2 font-semibold text-dc-text">{name}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-dc-text-muted">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          <span className="truncate">{location}</span>
        </p>
        {tags && tags.length > 0 ?
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <TagLink key={t} tag={t} />
            ))}
          </div>
        : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-md border border-dc-border bg-dc-elevated-solid px-2 py-0.5 text-xs text-dc-text-muted">
            {attendanceLabel}
          </span>
          <span className="inline-flex items-center rounded-md border border-dc-accent-border/30 bg-dc-accent/10 px-2 py-0.5 text-xs text-dc-accent-hover">
            View schedule
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dc-elevated-solid">
            <div className="h-full rounded-full bg-dc-accent" style={{ width: `${fillPct}%` }} />
          </div>
          {fillPct > 0 ?
            <span className="text-xs text-dc-muted">{fillPct}%</span>
          : null}
        </div>
      </Link>
    </Card>
  )
}
