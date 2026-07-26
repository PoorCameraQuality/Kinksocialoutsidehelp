import { Link } from 'react-router-dom'
import { formatMyRsvpLabel, type ApiMyRsvpItem } from '@/hooks/useApiMyRsvps'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'

function registrationStatusLabel(item: ApiMyRsvpItem): string {
  if (item.status === 'going' && item.rsvpApprovalStatus === 'pending') return 'Awaiting approval'
  if (item.status === 'maybe') return RSVP_LABEL_INTERESTED
  if (item.status === 'going') return 'Going'
  if (item.status === 'waitlist') return 'Waitlist'
  return item.status.replace(/_/g, ' ')
}

type Props = {
  item: ApiMyRsvpItem
  locationHint?: string
}

export default function PersonalRegistrationRow({ item, locationHint }: Props) {
  const { date, title } = formatMyRsvpLabel(item)

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-dc-accent">{date}</p>
        <h3 className="mt-1 text-base font-semibold text-dc-text">
          <Link to={`/events/${encodeURIComponent(item.eventId)}`} className="hover:text-dc-accent">
            {title}
          </Link>
        </h3>
        {locationHint ?
          <p className="mt-0.5 text-sm text-dc-text-muted">{locationHint}</p>
        : null}
        <p className="mt-1 text-xs text-dc-muted">
          <span className="rounded-full bg-dc-surface-muted px-2 py-0.5 font-medium text-dc-text">
            {registrationStatusLabel(item)}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          to={`/events/${encodeURIComponent(item.eventId)}`}
          className="inline-flex min-h-10 items-center rounded-xl border border-dc-accent-border px-4 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
        >
          View details
        </Link>
      </div>
    </article>
  )
}
