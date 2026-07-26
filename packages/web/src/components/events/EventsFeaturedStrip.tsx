import { Link } from 'react-router-dom'
import EventSaveButton from '@/components/events/EventSaveButton'
import AutoScrollRow from '@/components/home/AutoScrollRow'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { formatEventLocationForDisplay, resolveEventHeroUrl } from '@/lib/events-page-utils'
import type { MockEvent } from '@/data/types'

function HighlightCard({ event, compact }: { event: MockEvent; compact?: boolean }) {
  const heroSrc = resolveEventHeroUrl(event)
  const preview = event.connectionRsvpPreview?.slice(0, 3) ?? []
  const showFeaturedBadge = event.featured === true
  const isVirtual = event.eventFormat === 'virtual'
  const displayLocation = formatEventLocationForDisplay(event.location, isVirtual)
  const socialLabel =
    (event.mutualGoingCount ?? 0) > 0 ?
      `${event.mutualGoingCount} mutual${event.mutualGoingCount === 1 ? '' : 's'} going`
    : event.rsvpCount > 0 ?
      `${event.rsvpCount} going`
    : 'RSVP on event page'

  return (
    <article
      className={`relative shrink-0 snap-start overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] ${
        compact ? 'w-[min(72vw,240px)]' : 'w-[min(82vw,280px)] sm:w-[280px]'
      }`}
    >
      {showFeaturedBadge ?
        <span className="absolute left-3 top-3 z-10 rounded-md bg-dc-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-dc-accent-foreground">
          Featured
        </span>
      : null}
      <Link to={`/events/${event.id}`} className="block">
        <div className={`w-full bg-dc-surface-muted ${compact ? 'aspect-[2/1]' : 'aspect-[16/10]'}`}>
          {heroSrc ?
            <img src={heroSrc} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          : <MediaSurfaceFallback variant="event" />}
        </div>
        <div className="p-2.5 sm:p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">{event.date}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-dc-text">{event.title}</h3>
          <p className="mt-1 line-clamp-1 text-xs font-medium text-dc-text-muted">{displayLocation}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isVirtual ?
                  'border border-sky-400/35 bg-sky-500/15 text-sky-200'
                : 'border border-dc-border bg-dc-surface-muted text-dc-text-muted'
              }`}
            >
              {isVirtual ? 'Online' : 'In person'}
            </span>
            {preview.length > 0 ?
              <span className="flex -space-x-1.5" aria-hidden>
                {preview.map((p, i) =>
                  p.avatarUrl ?
                    <img key={p.username} src={p.avatarUrl} alt="" className="h-5 w-5 rounded-full ring-2 ring-dc-elevated-solid" style={{ zIndex: i }} />
                  : <PlaceholderAvatar key={p.username} size="sm" className="!h-5 !w-5" />,
                )}
              </span>
            : null}
            <span className="text-[11px] text-dc-muted">{socialLabel}</span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10 rounded-lg bg-dc-elevated-solid/90">
        <EventSaveButton eventId={event.id} size="sm" />
      </div>
    </article>
  )
}

export default function EventsFeaturedStrip({ events }: { events: MockEvent[] }) {
  const featured = events.slice(0, 3)
  if (featured.length < 2) return null

  return (
    <section className="mb-4" aria-label="Featured events">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-dc-text">Featured by organizers</h2>
        <p className="text-xs text-dc-text-muted">Spotlighted gatherings — compare date, place, and who is going.</p>
      </div>
      <div className="relative">
        <AutoScrollRow aria-label="Featured upcoming events carousel" trackClassName="gap-3 scroll-smooth">
          {featured.map((event, i) => (
            <HighlightCard key={String(event.id)} event={event} compact={i > 0} />
          ))}
        </AutoScrollRow>
        <div
          className="pointer-events-none absolute bottom-1 right-0 top-0 w-10 bg-gradient-to-l from-dc-surface to-transparent md:hidden"
          aria-hidden
        />
      </div>
    </section>
  )
}
