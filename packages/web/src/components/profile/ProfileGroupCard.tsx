import { Link } from 'react-router-dom'

type Props = {
  id: string
  slug: string | null
  name: string
  role?: string
  joinedLabel?: string | null
  canManage?: boolean
}

export default function ProfileGroupCard({ id, slug, name, role = 'Member', joinedLabel, canManage }: Props) {
  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 shadow-[var(--dc-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-dc-text">{name}</h3>
          {slug ?
            <p className="text-sm text-dc-muted">/{slug}</p>
          : null}
        </div>
        <span className="shrink-0 rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
          {role}
        </span>
      </div>
      {joinedLabel ?
        <p className="mt-2 text-xs text-dc-muted">Joined {joinedLabel}</p>
      : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/groups/${encodeURIComponent(id)}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-dc-accent/50 px-3 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted/25"
        >
          View group
        </Link>
        {canManage ?
          <Link
            to={`/organizer/groups/${encodeURIComponent(id)}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-semibold text-dc-text hover:border-dc-accent-border/40"
          >
            Manage group
          </Link>
        : null}
      </div>
    </div>
  )
}
