import { Link } from 'react-router-dom'
import ContentSection from '@/components/ui/ContentSection'

export type EventTimingStatus = 'upcoming' | 'past' | 'rsvp_closed' | 'at_capacity'

type Props = {
  hostUsername?: string | null
  hostName?: string | null
  orgSlug?: string | null
  groupId?: string | null
  groupName?: string | null
  apiBacked?: boolean
  hasDiscussionTab?: boolean
  timingStatus?: EventTimingStatus | null
  onSelectTab: (tab: string) => void
}

function timingLabel(status: EventTimingStatus): string {
  switch (status) {
    case 'past':
      return 'This event has ended.'
    case 'rsvp_closed':
      return 'RSVPs are closed.'
    case 'at_capacity':
      return 'This event is at capacity; new Going RSVPs may join the waitlist.'
    default:
      return 'Upcoming event.'
  }
}

export default function EventSocialOrientation({
  hostUsername,
  hostName,
  orgSlug,
  groupId,
  groupName,
  apiBacked = false,
  hasDiscussionTab = false,
  timingStatus = 'upcoming',
  onSelectTab,
}: Props) {
  const hostLabel = hostName?.trim() || hostUsername || 'Community host'

  return (
    <ContentSection
      as="section"
      padding="none"
      className="mb-6 hidden p-4 sm:p-5 lg:block"
      aria-label="About this event"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Event hub</p>
      <p className="mt-2 text-sm text-dc-text-muted leading-relaxed">
        RSVP saves your spot and may unlock location or join details per host settings. Use{' '}
        <strong className="font-medium text-dc-text">Save</strong> to bookmark this page, or{' '}
        <strong className="font-medium text-dc-text">Report</strong> if something feels unsafe.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-dc-text-muted">
        <li>
          <span className="font-medium text-dc-text">Host:</span>{' '}
          {hostUsername ?
            <Link to={`/profile/${encodeURIComponent(hostUsername)}`} className="text-dc-accent hover:underline">
              {hostLabel}
            </Link>
          : hostLabel}
        </li>
        {orgSlug ?
          <li>
            <span className="font-medium text-dc-text">Organization:</span>{' '}
            <Link to={`/orgs/${encodeURIComponent(orgSlug)}`} className="text-dc-accent hover:underline">
              View org hub
            </Link>
          </li>
        : null}
        {groupId ?
          <li>
            <span className="font-medium text-dc-text">Group:</span>{' '}
            <Link to={`/groups/${encodeURIComponent(groupId)}`} className="text-dc-accent hover:underline">
              {groupName?.trim() || 'View group'}
            </Link>
          </li>
        : null}
        {timingStatus ?
          <li>
            <span className="font-medium text-dc-text">Status:</span> {timingLabel(timingStatus)}
          </li>
        : null}
        {apiBacked && hasDiscussionTab ?
          <li>
            <span className="font-medium text-dc-text">Discussion:</span> RSVP attendees and the host can post in the
            Discussion tab.
          </li>
        : null}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {hasDiscussionTab ?
          <button
            type="button"
            onClick={() => onSelectTab('Discussion')}
            className="min-h-10 rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Open discussion
          </button>
        : null}
        <button
          type="button"
          onClick={() => onSelectTab('Attendees')}
          className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
        >
          View attendees
        </button>
      </div>
    </ContentSection>
  )
}
