import { Link } from 'react-router-dom'
import EmptyState from '@/components/ui/EmptyState'
import GroupRoleBadge from '@/components/GroupRoleBadge'
import CommunityTrustChip from '@/components/trust/CommunityTrustChip'
import Card from '@/components/ui/Card'
import type { MockGroupMember } from '@/data/mock-data'

interface GroupMembersSectionProps {
  members: MockGroupMember[]
  staffHiddenMemberCount?: number
  showStaffHiddenNote?: boolean
}

export default function GroupMembersSection({
  members,
  staffHiddenMemberCount = 0,
  showStaffHiddenNote = false,
}: GroupMembersSectionProps) {
  if (members.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState message="No members yet." />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {showStaffHiddenNote && staffHiddenMemberCount > 0 ?
        <p className="rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text-muted">
          {staffHiddenMemberCount} member{staffHiddenMemberCount === 1 ? '' : 's'} chose to stay hidden from the public
          member list. You can see them here for moderation.
        </p>
      : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card
            key={`${member.groupId}-${member.userId}`}
            className="p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-dc-elevated-solid flex items-center justify-center text-dc-muted flex-shrink-0">
              {member.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to={`/profile/${member.username}`}
                className="font-medium text-dc-text hover:text-dc-accent truncate block"
              >
                {member.username}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <GroupRoleBadge role={member.role} />
                {member.memberListHidden ?
                  <span className="rounded-full border border-dc-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">
                    Hidden from member list
                  </span>
                : null}
                <CommunityTrustChip username={member.username} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
