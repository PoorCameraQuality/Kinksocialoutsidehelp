import { Link } from 'react-router-dom'
import AlphaTestBadge from '@/components/alpha/AlphaTestBadge'
import EventSaveButton from '@/components/events/EventSaveButton'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import TagLink from '@/components/TagLink'
import { eventGoingSummary, formatEventDateTile } from '@/components/events/events-agenda'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import {
  filterPublicEventTags,
  formatEventLocationForDisplay,
  resolveEventHeroUrl,
} from '@/lib/events-page-utils'
import type { MockEvent } from '@/data/types'

type Props = {
  event: MockEvent
}

/**
 * Events-directory grid card (used only on the Events discover grid view).
 * Date-first hierarchy with a designed date/category placeholder instead of an
 * empty media block when an event has no cover image.
 */
export default function EventsGridCard({ event }: Props) {
  const heroSrc = resolveEventHeroUrl(event)
  const { weekday, day, month, time } = formatEventDateTile(event)
  const isVirtual = event.eventFormat === 'virtual'
  const displayLocation = formatEventLocationForDisplay(event.location, isVirtual)
  const tags = filterPublicEventTags(event.tags)
  const { count: goingLabel, mutual: mutualLabel } = eventGoingSummary(event)
  const connections = event.connectionRsvpPreview?.slice(0, 3) ?? []

  return (
    <article className={`relative flex flex-col overflow-hidden ${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass}`}>
      <div className="relative aspect-[2/1]">
        <Link to={`/events/${event.id}`} className="absolute inset-0 z-0 block" aria-label={`View event: ${event.title}`}>
          {heroSrc ?
            <img
              src={heroSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          : <DatePlaceholder weekday={weekday} day={day} month={month} time={time} category={event.category} />}
        </Link>

        {/* Date chip over imagery (the no-image placeholder already leads with the date) */}
        {heroSrc ?
          <span className="c2k-event-date-badge pointer-events-none absolute left-3 top-3 z-10 flex-col !items-start !gap-0 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wide text-dc-accent">{weekday}</span>
            <span className="text-sm font-bold leading-none text-dc-text">
              {month} {day}
            </span>
            {time ? <span className="text-[10px] font-medium text-dc-text-muted">{time}</span> : null}
          </span>
        : null}

        {event.alphaLabel ?
          <span className="absolute right-3 top-3 z-10">
            <AlphaTestBadge label={event.alphaLabel} />
          </span>
        : null}
        {event.featured || event.isFeatured ?
          <span className="absolute bottom-3 left-3 z-10 rounded-md bg-emerald-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Featured
          </span>
        : null}
        <div className="absolute bottom-3 right-3 z-20 rounded-full bg-dc-elevated-solid/90 backdrop-blur-sm">
          <EventSaveButton eventId={event.id} size="sm" className="!min-h-11 !min-w-11 !rounded-full" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        <div className="flex items-start gap-2">
          <Link
            to={`/events/${event.id}`}
            className="min-w-0 flex-1 font-display text-[15px] font-semibold leading-snug text-dc-text line-clamp-2 hover:text-dc-accent sm:text-base"
          >
            {event.title}
          </Link>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isVirtual ?
                'border-sky-400/35 bg-sky-500/20 text-sky-200'
              : 'border-dc-border bg-dc-surface-muted text-dc-text-muted'
            }`}
          >
            {isVirtual ? 'Online' : 'In person'}
          </span>
        </div>

        {event.hostName ?
          <p className="mt-0.5 truncate text-xs text-dc-muted">Hosted by {event.hostName}</p>
        : null}

        <p className="mt-1.5 line-clamp-1 text-sm font-medium text-dc-text">{displayLocation}</p>

        {(event.category || tags.length > 0) ?
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {event.category ?
              <span className="rounded-full border border-dc-border bg-dc-surface-muted px-2 py-0.5 text-[11px] font-medium text-dc-text-muted">
                {event.category}
              </span>
            : null}
            {tags.slice(0, 2).map((t) => (
              <TagLink key={t} tag={t} />
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
            className="ml-auto inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-xs font-semibold text-dc-text hover:border-dc-accent-border hover:text-dc-accent"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}

function DatePlaceholder({
  weekday,
  day,
  month,
  time,
  category,
}: {
  weekday: string
  day: string
  month: string
  time: string | null
  category?: string
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-dc-accent/20 via-dc-surface-muted to-dc-elevated-solid">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-dc-accent/90">{weekday}</span>
      <span className="font-display text-4xl font-bold leading-none text-dc-text">{day || '—'}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-dc-text-muted">
        {month}
        {time ? ` · ${time}` : ''}
      </span>
      {category ?
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dc-border/70 bg-dc-elevated-solid/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-text-muted">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {category}
        </span>
      : null}
    </div>
  )
}
