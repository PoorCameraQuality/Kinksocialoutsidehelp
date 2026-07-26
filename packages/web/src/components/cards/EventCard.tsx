import { Link } from 'react-router-dom'
import TagLink from '@/components/TagLink'
import AlphaTestBadge from '@/components/alpha/AlphaTestBadge'
import type { AlphaContentLabel } from '@c2k/shared'
import EventSaveButton from '@/components/events/EventSaveButton'
import Card from '@/components/ui/Card'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { filterPublicEventTags, formatEventLocationForDisplay, resolveEventHeroUrl } from '@/lib/events-page-utils'

export type EventCardProps = {
  event: {
    id: number | string
    title: string
    date: string
    location: string
    rsvpCount: number
    capacityLimit?: number
    mutualGoingCount?: number
    connectionRsvpPreview?: Array<{ username: string; avatarUrl?: string | null }>
    imageUrl?: string | null
    bannerUrl?: string | null
    tags?: string[]
    eventFormat?: 'in-person' | 'virtual'
    isFeatured?: boolean
    alphaLabel?: AlphaContentLabel
  }
}

export default function EventCard({ event }: EventCardProps) {
  const {
    id,
    title,
    date,
    location,
    rsvpCount,
    capacityLimit,
    mutualGoingCount = 0,
    tags,
    eventFormat,
    isFeatured,
    alphaLabel,
  } = event
  const isVirtual = eventFormat === 'virtual'
  const heroSrc = resolveEventHeroUrl(event)
  const attendanceLabel = capacityLimit && capacityLimit > 0 ? `${rsvpCount}/${capacityLimit} going` : `${rsvpCount} going`
  const displayLocation = formatEventLocationForDisplay(location, isVirtual)
  const displayTags = filterPublicEventTags(tags)

  return (
    <Card interactive className="relative min-w-0 overflow-hidden p-0">
      <div className="relative aspect-[2/1] bg-dc-elevated-solid">
        <Link
          to={`/events/${id}`}
          className="absolute inset-0 z-0 block"
          aria-label={`View event: ${title}`}
        >
          {heroSrc ? (
            <img
              src={heroSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
              data-sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <MediaSurfaceFallback variant="event" className="absolute inset-0" />
          )}
        </Link>
        <span className="c2k-event-date-badge absolute left-3 top-3 z-10 max-w-[calc(100%-3.5rem)] pointer-events-none text-[11px] sm:text-xs">
          {date}
        </span>
        {alphaLabel && (
          <span className="absolute right-3 top-3 z-10 pointer-events-auto">
            <AlphaTestBadge label={alphaLabel} />
          </span>
        )}
        {isFeatured && (
          <span className="absolute bottom-3 left-3 z-10 px-2 py-1 bg-emerald-600/90 rounded-lg text-xs font-semibold text-white pointer-events-none">
            Featured
          </span>
        )}
        <div className="absolute bottom-3 right-3 z-20 rounded-full bg-dc-elevated/95/90 backdrop-blur-sm">
          <EventSaveButton eventId={id} size="sm" className="!min-h-11 !min-w-11 !rounded-full" />
        </div>
      </div>
      <Link to={`/events/${id}`} className="block p-4 pt-3.5">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="min-w-0 flex-1 font-display text-[15px] font-semibold leading-snug text-dc-text line-clamp-2 sm:text-base">
            {title}
          </h3>
          {isVirtual ?
            <span className="shrink-0 rounded-full border border-sky-400/35 bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
              Online
            </span>
          : <span className="shrink-0 rounded-full border border-dc-border bg-dc-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-text-muted">
              In person
            </span>
          }
        </div>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-dc-text">
          {isVirtual ?
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          : <svg className="mt-0.5 h-4 w-4 shrink-0 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          }
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {displayLocation === location && isVirtual && (location === 'TBA' || !location.trim()) ?
              'Online. Tap for details'
            : displayLocation}
          </span>
        </p>
        {displayTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {displayTags.slice(0, 2).map((t) => (
              <TagLink key={t} tag={t} />
            ))}
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-dc-border bg-dc-elevated-solid px-2 py-0.5 text-xs font-medium text-dc-text">
            {attendanceLabel}
          </span>
          {mutualGoingCount > 0 ?
            <span className="text-xs text-dc-accent">{mutualGoingCount} mutual going</span>
          : null}
        </div>
      </Link>
    </Card>
  )
}
