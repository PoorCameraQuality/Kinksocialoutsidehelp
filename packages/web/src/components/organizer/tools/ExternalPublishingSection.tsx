import { Link } from 'react-router-dom'
import OrganizerOrgEckePanel from '@/components/organizer/OrganizerOrgEckePanel'
import { ToolsSection, ToolsSubsectionHeader } from '@/components/organizer/tools/tools-ui'

type Props = {
  orgSlug: string
  displayName: string
  publishHref: string
  scheduleHref: string
  showPublishActions: boolean
}

export default function ExternalPublishingSection({
  orgSlug,
  scheduleHref,
  showPublishActions,
}: Props) {
  return (
    <ToolsSection id="ecke-publishing">
      <ToolsSubsectionHeader
        title="ECKE & Dancecard"
        subtitle="Manage optional external publishing for public listings and attendee-facing schedule surfaces."
      />

      <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <dt className="font-medium text-dc-text">Kink Social public hub</dt>
          <dd className="mt-1 text-dc-text-muted">Your organization page inside Kink Social.</dd>
        </div>
        <div className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <dt className="font-medium text-dc-text">East Coast Kink Events</dt>
          <dd className="mt-1 text-dc-text-muted">Optional public directory listing when the publish bridge is enabled.</dd>
        </div>
        <div className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
          <dt className="font-medium text-dc-text">Dancecard</dt>
          <dd className="mt-1 text-dc-text-muted">Attendee schedules and convention program tools where supported.</dd>
        </div>
      </dl>

      {showPublishActions ?
        <OrganizerOrgEckePanel orgSlug={orgSlug} />
      : (
        <p className="rounded-xl border border-dc-border bg-dc-surface/30 px-4 py-3 text-sm text-dc-text-muted">
          Organization publishing settings are available to owners and admins.{' '}
          <Link to={scheduleHref} className="text-dc-accent hover:underline">
            Open Events & conventions
          </Link>{' '}
          for per-convention publish actions.
        </p>
      )}

      <p className="mt-4 text-sm text-dc-text-muted">
        Per-convention preview and publish actions are on each row in{' '}
        <Link to={scheduleHref} className="font-medium text-dc-accent hover:underline">
          Events & conventions
        </Link>
        .
      </p>
    </ToolsSection>
  )
}
