import { Link } from 'react-router-dom'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import { EVENT_CATEGORY_VALUES } from '@c2k/shared'
import type { MockEvent } from '@/data/types'
import { countEventsByCategory, resolveEventHeroUrl } from '@/lib/events-page-utils'
import EventsDisplayControls, {
  type EventsSortMode,
  type EventsViewMode,
} from '@/components/events/EventsDisplayControls'

/** Curated regions shown only when we cannot derive real cities from the data. */
const FALLBACK_REGIONS = ['Philadelphia, PA', 'New York, NY', 'Baltimore, MD', 'Pittsburgh, PA', 'Washington, DC']

const CITY_STATE_RE = /([A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2})\b/

/** Pull "City, ST" out of public location strings, skipping redacted/online ones. */
function deriveCityCounts(events: MockEvent[]): { city: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    const loc = e.location?.trim()
    if (!loc) continue
    if (/online|shared after rsvp|tba/i.test(loc)) continue
    const match = loc.match(CITY_STATE_RE)
    if (!match) continue
    const city = match[1].replace(/\s+/g, ' ').trim()
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

type Props = {
  allEvents: MockEvent[]
  suggested: MockEvent[]
  sortMode?: EventsSortMode
  onSortModeChange?: (mode: EventsSortMode) => void
  viewMode?: EventsViewMode
  onViewModeChange?: (mode: EventsViewMode) => void
  sortId?: string
}

export default function EventsRightRail({
  allEvents,
  suggested,
  sortMode,
  onSortModeChange,
  viewMode,
  onViewModeChange,
  sortId = 'events-sort-rail',
}: Props) {
  const categoryCounts = countEventsByCategory(allEvents)
  const picks = suggested.length > 0 ? suggested.slice(0, 3) : allEvents.slice(3, 6)
  const cityCounts = deriveCityCounts(allEvents)

  return (
    <aside className={railAsideClass} aria-label="Events discovery">
      {sortMode && onSortModeChange && viewMode && onViewModeChange ?
        <RailCard title="Sort & view">
          <EventsDisplayControls
            sortId={sortId}
            sortMode={sortMode}
            onSortModeChange={onSortModeChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            layout="stacked"
          />
        </RailCard>
      : null}

      <RailCard title="Host a gathering" emphasize>
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Bring your community together. Use <strong className="font-medium text-dc-text">+ Create</strong> in the
          header to publish a munch, class, or convention.
        </p>
      </RailCard>

      <RailCard title="Worth checking next">
        {picks.length === 0 ?
          <p className="text-xs text-dc-text-muted">
            No events to compare yet. New gatherings show up here as organizers post them.
          </p>
        : <>
        <p className="mb-2 text-xs text-dc-text-muted">Compare these before you RSVP.</p>
        <ul className="space-y-3">
          {picks.map((ev) => {
            const img = resolveEventHeroUrl(ev)
            return (
              <li key={String(ev.id)}>
                <Link to={`/events/${ev.id}`} className="flex gap-2 rounded-lg p-1 hover:bg-dc-elevated-hover">
                  {img ?
                    <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  : (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-dc-border">
                      <MediaSurfaceFallback variant="event" compact className="h-full" />
                    </div>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-dc-text line-clamp-2">{ev.title}</span>
                    <span className="text-xs text-dc-muted">{ev.date}</span>
                    <span className="block text-xs text-dc-muted">
                      {(ev.mutualGoingCount ?? 0) > 0 ?
                        `${ev.mutualGoingCount} connection${ev.mutualGoingCount === 1 ? '' : 's'} going`
                      : `${ev.rsvpCount} going`}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        </>
        }
      </RailCard>

      <RailCard title="Explore by category">
        <p className="mb-2 text-xs text-dc-text-muted">Jump into a type of gathering.</p>
        <ul className="space-y-2 text-sm">
          {EVENT_CATEGORY_VALUES.slice(0, 6).map((cat) => (
            <li key={cat} className="flex items-center justify-between gap-2 text-dc-text-muted">
              <span>{cat}</span>
              <span className="tabular-nums text-dc-muted">{categoryCounts.get(cat) ?? 0}</span>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Browse by city">
        {cityCounts.length > 0 ?
          <>
            <p className="mb-2 text-xs text-dc-text-muted">Where listed events are happening.</p>
            <ul className="space-y-2 text-sm">
              {cityCounts.map((row) => (
                <li key={row.city} className="flex items-center justify-between gap-2">
                  <span className="text-dc-text-muted">{row.city}</span>
                  <span className="shrink-0 text-xs text-dc-muted">
                    {row.count} event{row.count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        : <>
            <p className="mb-2 text-xs text-dc-text-muted">Regions where members tend to gather.</p>
            <ul className="space-y-2 text-sm">
              {FALLBACK_REGIONS.map((city) => (
                <li key={city} className="text-dc-text-muted">
                  {city}
                </li>
              ))}
            </ul>
          </>
        }
      </RailCard>

      <div className="rounded-2xl border border-dc-border/80 bg-dc-elevated-solid/60 p-4">
        <p className="text-sm font-medium text-dc-text">Kink Social+</p>
        <p className="mt-1 text-xs text-dc-text-muted">Visibility, analytics, and organizer tools for hosts.</p>
        <Link
          to="/settings"
          className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:border-dc-accent-border hover:text-dc-accent"
        >
          Learn more
        </Link>
      </div>
    </aside>
  )
}
