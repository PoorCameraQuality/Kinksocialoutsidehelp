import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'
import { formatMyRsvpLabel } from '@/hooks/useApiMyRsvps'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'

export type UpcomingRsvpItem = {
  eventId: string
  title: string
  startsAt: string
  status?: string
  location?: string | null
  imageUrl?: string | null
}

type StatusKey = 'going' | 'maybe' | 'waitlist' | 'default'

function resolveStatus(status?: string): StatusKey {
  if (status === 'going' || status === 'maybe' || status === 'waitlist') return status
  return 'default'
}

const STATUS_META: Record<
  StatusKey,
  { label: string; badgeClass: string; icon: ReactNode }
> = {
  going: {
    label: 'Going',
    badgeClass: 'bg-emerald-500/15 text-emerald-200',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  maybe: {
    label: RSVP_LABEL_INTERESTED,
    badgeClass: 'bg-amber-500/15 text-amber-100',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
  },
  waitlist: {
    label: 'Waitlist',
    badgeClass: 'bg-slate-500/20 text-slate-200',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  default: {
    label: 'RSVP',
    badgeClass: 'bg-violet-500/15 text-violet-200',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
}

type Props = {
  event: UpcomingRsvpItem
  compact?: boolean
  embedded?: boolean
  onNavigate?: () => void
}

export default function HomeUpcomingEventCard({ event, compact = false, embedded = false, onNavigate }: Props) {
  const img = event.imageUrl ?? null
  const statusKey = resolveStatus(event.status)
  const status = STATUS_META[statusKey]
  const { date } = formatMyRsvpLabel({
    eventId: event.eventId,
    title: event.title,
    startsAt: event.startsAt,
    status: event.status ?? 'going',
  })

  const ariaLabel = [event.title, date, status.label, event.location].filter(Boolean).join(', ')

  return (
    <Link
      to={`/events/${encodeURIComponent(event.eventId)}`}
      onClick={onNavigate}
      aria-label={ariaLabel}
      className={`group flex min-h-11 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 transition-colors hover:border-[rgba(214,178,59,0.35)] hover:bg-white/[0.05] sm:p-3 ${compact ? 'mt-0' : 'mt-3'}`}
    >
      {img ?
        <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10" loading="lazy" />
      : (
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
          <MediaSurfaceFallback variant="event" compact className="h-full" />
        </div>
      )}

      <span className="min-w-0 flex-1">
        {embedded ? null : (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">Upcoming for you</span>
        )}
        <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${embedded ? '' : 'mt-0.5'}`}>
          <span className="truncate text-sm font-semibold text-dc-text">{event.title}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.badgeClass}`}
          >
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3 [&>svg]:w-3">
              {status.icon}
            </span>
            {status.label}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dc-muted">
          <span className="inline-flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0 text-dc-accent/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {date}
          </span>
          {event.location ?
            <span className="inline-flex min-w-0 items-center gap-1">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.location}</span>
            </span>
          : null}
        </span>
      </span>

      <svg
        className="h-4 w-4 shrink-0 text-dc-muted transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
