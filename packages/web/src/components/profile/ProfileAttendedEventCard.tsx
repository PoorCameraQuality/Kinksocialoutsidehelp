import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import { demoMockImageUrl } from '@/data/mock-data'

type Props = {
  eventId: string
  title: string
  attendedLabel: string
  location?: string | null
  verified?: boolean
  showAddNote?: boolean
}

export default function ProfileAttendedEventCard({
  eventId,
  title,
  attendedLabel,
  location,
  verified,
  showAddNote,
}: Props) {
  const heroSrc = demoMockImageUrl(`event-attended-${eventId}`, 640, 320)

  return (
    <Card className="overflow-hidden hover:border-dc-accent-border/40 transition-colors">
      <Link to={`/events/${encodeURIComponent(eventId)}`} className="block relative aspect-[2/1] bg-dc-elevated-solid" aria-label={`View event: ${title}`}>
        <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <span className="absolute top-3 left-3 rounded-lg bg-emerald-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Attended
        </span>
      </Link>
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium text-dc-accent">{attendedLabel}</p>
        <h3 className="text-base font-semibold text-dc-text line-clamp-2">
          <Link to={`/events/${encodeURIComponent(eventId)}`} className="hover:underline">
            {title}
          </Link>
        </h3>
        {location ?
          <p className="text-xs text-dc-muted flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {location}
          </p>
        : null}
        {verified ?
          <span className="inline-flex rounded-md border border-dc-accent/40 bg-dc-accent-muted/30 px-1.5 py-0.5 text-[10px] font-semibold text-dc-accent">
            Event verified
          </span>
        : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            to={`/events/${encodeURIComponent(eventId)}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-dc-accent/50 px-3 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted/25"
          >
            View event
          </Link>
          {showAddNote ?
            <span className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs text-dc-muted">
              Add note (soon)
            </span>
          : null}
        </div>
      </div>
    </Card>
  )
}
