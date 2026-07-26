import { Link } from 'react-router-dom'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

type Props = {
  groupId: string
}

export default function GroupCommunicationsAdminPanel({ groupId }: Props) {
  const groupHref = `/groups/${encodeURIComponent(groupId)}`

  return (
    <div className="space-y-4 max-w-3xl">
      <OrganizerPanel
        title="Communications moderation"
        description="Photo approvals and live chat channel tools will appear here in a later beta release."
      >
        <OrganizerFormSection
          title="Photo approval queue"
          description="Review member-uploaded photos before they appear on the group gallery."
        >
          <div
            className="rounded-xl border border-dashed border-dc-border bg-dc-elevated/95/40 px-4 py-6 text-sm text-dc-text-muted"
            aria-disabled="true"
          >
            <p className="font-medium text-dc-text">Beta. Not available yet</p>
            <p className="mt-1">
              Group photo moderation is not wired in this build. Member uploads and gallery display continue on the
              public group page.
            </p>
          </div>
        </OrganizerFormSection>

        <OrganizerFormSection
          title="Live chat channels"
          description="Slow mode, pinned messages, and channel-level moderation for group chat."
        >
          <div
            className="rounded-xl border border-dashed border-dc-border bg-dc-elevated/95/40 px-4 py-6 text-sm text-dc-text-muted"
            aria-disabled="true"
          >
            <p className="font-medium text-dc-text">Beta. Not available yet</p>
            <p className="mt-1">
              Group chat channel admin is not available in the organizer console yet. Forum categories and posts can be
              managed in the section above; members use the public group page for discussions.
            </p>
            <Link
              to={groupHref}
              className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-accent hover:underline"
            >
              Open group page
            </Link>
          </div>
        </OrganizerFormSection>
      </OrganizerPanel>
    </div>
  )
}
