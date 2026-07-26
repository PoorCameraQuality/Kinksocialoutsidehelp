import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

const ROLE_STYLES: Record<string, string> = {
  OWNER: 'border-dc-accent/50 bg-dc-accent/15 text-dc-accent',
  ADMIN: 'border-amber-500/40 bg-amber-950/30 text-amber-200',
  MODERATOR: 'border-violet-500/35 bg-violet-950/35 text-violet-200',
  STAFF: 'border-sky-500/35 bg-sky-950/35 text-sky-200',
  MEMBER: 'border-dc-border bg-dc-elevated-muted text-dc-text-muted',
}

export default function MemberRoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        ROLE_STYLES[role] ?? ROLE_STYLES.MEMBER,
      )}
    >
      {role === 'OWNER' ? 'Owner' : role.charAt(0) + role.slice(1).toLowerCase()}
    </span>
  )
}

export function DirectoryVisibilityBadge({ listed }: { listed: boolean }) {
  return listed ?
      <Badge variant="success">Visible</Badge>
    : <Badge variant="neutral">Hidden</Badge>
}
