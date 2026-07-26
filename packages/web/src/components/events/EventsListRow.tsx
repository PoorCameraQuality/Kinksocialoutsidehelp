import { Link } from 'react-router-dom'
import EventSaveButton from '@/components/events/EventSaveButton'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import TagLink from '@/components/TagLink'
import { eventGoingSummary, formatEventDateTile } from '@/components/events/events-agenda'
import {
  cardSurfaceInteractiveClass,
  cardSurfaceSolidClass,
} from '@/lib/card-surface'
import {
  filterPublicEventTags,
  formatEventLocationForDisplay,
  resolveEventHeroUrl,
} from '@/lib/events-page-utils'
import type { MockEvent } from '@/data/types'

type Props = {
  event: MockEvent
}

export default function EventsListRow({ event }: Props) {
  const { weekday, day, month, time } = formatEventDateTile(event)
  const isVirtual = event.eventFormat === 'virtual'
  const displayLocation = formatEventLocationForDisplay(event.location, isVirtual)
  const tags = filterPublicEventTags(event.tags)
  const formatLabel = isVirtual ? 'Online' : 'In person'
  const { count: goingLabel, mutual: mutualLabel } = eventGoingSummary(event)
  const connections = event.connectionRsvpPreview?.slice(0, 3) ?? []
  const heroSrc = resolveEventHeroUrl(event)

  return (
    <article className={`overflow-hidden ${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass}`}>
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Date-first tile */}
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-dc-accent-border/60 bg-dc-accent/10 py-2 text-center sm:w-16">
          <span className="text-[10px] font-bold uppercase tracking-wide text-dc-accent">{weekday}</span>
          <span className="text-xl font-bold leading-none text-dc-text sm:text-2xl">{day}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-text-muted">{month}</span>
          {time ?
            <span className="mt-1 text-[10px] font-medium tabular-nums text-dc-muted">{time}</span>
          : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/events/${event.id}`}
                className="line-clamp-2 text-base font-semibold leading-snug text-dc-text hover:text-dc-accent"
              >
                {event.title}
              </Link>
              {event.hostName ?
                <p className="mt-0.5 truncate text-xs text-dc-muted">Hosted by {event.hostName}</p>
              : null}
            </div>
            <EventSaveButton eventId={event.id} className="shrink-0" />
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-dc-text-muted">
            <span className="font-medium text-dc-text">{displayLocation}</span>
            <span aria-hidden>·</span>
            <span>{formatLabel}</span>
          </p>

          {(event.category || tags.length > 0) ?
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {event.category ?
                <span className="rounded-full border border-dc-border bg-dc-surface-muted px-2 py-0.5 text-[11px] font-medium text-dc-text-muted">
                  {event.category}
                </span>
              : null}
              {tags.slice(0, 2).map((tag) => (
                <TagLink
                  key={tag}
                  tag={tag.replace(/^#/, '')}
                  className="!rounded-full !bg-dc-surface-muted !px-2 !py-0.5 !text-[11px]"
                />
              ))}
            </div>
          : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dc-border/60 pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-dc-muted">
              {connections.length > 0 ?
                <span className="flex -space-x-1.5" aria-hidden>
                  {connections.map((c, i) =>
                    c.avatarUrl ?
                      <img
                        key={c.username}
                        src={c.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover ring-2 ring-dc-elevated-solid"
                        style={{ zIndex: i }}
                      />
                    : <PlaceholderAvatar key={c.username} size="sm" className="!h-5 !w-5 ring-2 ring-dc-elevated-solid" />,
                  )}
                </span>
              : null}
              {goingLabel}
            </span>
            {mutualLabel ?
              <span className="text-xs font-medium text-dc-accent">{mutualLabel}</span>
            : null}
            <Link
              to={`/events/${event.id}`}
              className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted px-4 text-sm font-semibold text-dc-text hover:border-dc-accent-border hover:text-dc-accent"
            >
              View details
            </Link>
          </div>
        </div>

        {heroSrc ?
          <Link
            to={`/events/${event.id}`}
            className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-dc-border bg-dc-surface-muted sm:block"
            aria-label={`View event: ${event.title}`}
            tabIndex={-1}
          >
            <img
              src={heroSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </Link>
        : null}
      </div>
    </article>
  )
}
