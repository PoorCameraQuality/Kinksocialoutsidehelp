import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import OrganizerOrgPeoplePanel from '@/components/organizer/people/OrganizerOrgPeoplePanel'
import GroupMemberRolePanel from '@/components/organizer/admin/GroupMemberRolePanel'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

type Props = {
  scopeKind: 'org' | 'group'
  orgSlug?: string
  orgId?: string
  orgVisibility?: string | null
  groupId?: string
  canManageRoles?: boolean
  viewerRole?: string | null
}

export default function OrganizerPeoplePanel({
  scopeKind,
  orgSlug,
  orgVisibility,
  groupId,
  canManageRoles = true,
  viewerRole = null,
}: Props) {
  const { viewerUserId } = useAuth()

  if (scopeKind === 'org' && orgSlug) {
    return (
      <OrganizerOrgPeoplePanel
        orgSlug={orgSlug}
        orgVisibility={orgVisibility}
        canManageRoles={canManageRoles}
        viewerUserId={viewerUserId}
        viewerRole={viewerRole}
      />
    )
  }

  if (scopeKind === 'group' && groupId) {
    return (
      <div className="max-w-4xl space-y-6">
        <OrganizerPanel
          title="Group members"
          description="Promote members to admin or moderator. Roles control who can manage this group in the organizer console."
        />
        <GroupMemberRolePanel groupId={groupId} viewerRole={viewerRole} />
        <Link
          to={`/groups/${encodeURIComponent(groupId)}?tab=Members`}
          className="inline-flex min-h-11 items-center text-sm text-dc-accent hover:underline"
        >
          View member directory on public group →
        </Link>
      </div>
    )
  }

  return null
}
