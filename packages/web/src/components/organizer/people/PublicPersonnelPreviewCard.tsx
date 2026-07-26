import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { OrgMemberRow } from '@/components/organizer/admin/OrgMemberAdminPanel'
import { PeopleSection } from '@/components/organizer/people/people-ui'

type Props = {
  members: OrgMemberRow[]
  publicHubHref: string
  settingsContentHref?: string
  showSettings: boolean
}

export default function PublicPersonnelPreviewCard({
  members,
  publicHubHref,
  settingsContentHref,
  showSettings,
}: Props) {
  const visible = members.filter((m) => m.listedInOrgDirectory)

  return (
    <PeopleSection>
      <h3 className="text-sm font-semibold text-dc-text">Public personnel preview</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        This shows how leadership, staff, and visible personnel appear on the public organization hub.
      </p>
      {visible.length === 0 ?
        <p className="mt-4 rounded-lg border border-dashed border-dc-border bg-dc-surface/30 px-3 py-4 text-sm text-dc-text-muted">
          No personnel are currently visible on the public hub. Members opt in from their profile or you can
          promote staff tags that surface on Overview.
        </p>
      : (
        <ul className="mt-4 space-y-2">
          {visible.slice(0, 5).map((m) => (
            <li key={m.userId} className="flex items-center gap-3 rounded-lg border border-dc-border/80 bg-dc-surface/40 px-3 py-2">
              <PlaceholderAvatar size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dc-text">{m.displayName || m.username}</p>
                <p className="text-dc-micro text-dc-muted">@{m.username}</p>
              </div>
            </li>
          ))}
          {visible.length > 5 ?
            <li className="text-dc-micro text-dc-muted">+{visible.length - 5} more visible</li>
          : null}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Link
          to={publicHubHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
        >
          Preview public hub
        </Link>
        {showSettings && settingsContentHref ?
          <Link to={settingsContentHref} className="text-sm font-medium text-dc-accent hover:underline">
            Edit hub content →
          </Link>
        : null}
        <p className="text-dc-micro text-dc-muted">
          Directory visibility is controlled by each member when they opt in; roster shows current status.
        </p>
      </div>
    </PeopleSection>
  )
}
