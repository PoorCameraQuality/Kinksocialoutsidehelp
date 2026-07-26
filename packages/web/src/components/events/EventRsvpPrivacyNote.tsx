import {
  EVENT_RSVP_PRIVACY_BODY,
  EVENT_RSVP_PRIVACY_TITLE,
  attendeeListVisibilitySummary,
} from '@/lib/event-privacy-copy'

type Props = {
  attendeeListVisibility?: string | null
  viewerIsHost?: boolean
  viewerIsGoing?: boolean
  className?: string
  compact?: boolean
}

export default function EventRsvpPrivacyNote({
  attendeeListVisibility,
  viewerIsHost = false,
  viewerIsGoing = false,
  className = '',
  compact = false,
}: Props) {
  const listSummary = attendeeListVisibilitySummary(attendeeListVisibility, {
    viewerIsHost,
    viewerIsGoing,
  })

  if (compact) {
    return (
      <p className={`text-xs leading-relaxed text-dc-muted ${className}`}>
        <span className="font-medium text-dc-text">{EVENT_RSVP_PRIVACY_TITLE}:</span> {EVENT_RSVP_PRIVACY_BODY}
        {listSummary ?
          <> Attendee list: {listSummary}.</>
        : null}
      </p>
    )
  }

  return (
    <div
      className={`rounded-xl border border-dc-border bg-dc-elevated-solid/80 p-3 text-sm ${className}`}
      aria-label="RSVP privacy"
    >
      <p className="font-medium text-dc-text">{EVENT_RSVP_PRIVACY_TITLE}</p>
      <p className="mt-1 text-dc-text-muted leading-relaxed">{EVENT_RSVP_PRIVACY_BODY}</p>
      {listSummary ?
        <p className="mt-2 text-xs text-dc-muted">
          <span className="font-medium text-dc-text">Attendee list:</span> {listSummary}
        </p>
      : null}
    </div>
  )
}
