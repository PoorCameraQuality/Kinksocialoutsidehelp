import type { GroupRole } from '@/data/mock-data'

const ROLE_LABELS: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  event_host: 'Event Host',
  vetted: 'Vetted',
  member: 'Member',
}

const ROLE_STYLES: Record<GroupRole, string> = {
  owner: 'bg-amber-500/20 text-amber-400',
  admin: 'bg-purple-500/20 text-purple-400',
  moderator: 'bg-blue-500/20 text-blue-400',
  event_host: 'bg-emerald-500/20 text-emerald-400',
  vetted: 'bg-cyan-500/20 text-cyan-400',
  member: 'bg-dc-elevated-solid text-dc-text-muted',
}

export type GroupRoleBadgeProps = {
  role: GroupRole
}

export default function GroupRoleBadge({ role }: GroupRoleBadgeProps) {
  const label = ROLE_LABELS[role]
  const style = ROLE_STYLES[role]

  return (
    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-md ${style}`}>
      {label}
    </span>
  )
}
