export type EckePublishStatus = 'never' | 'draft' | 'published' | 'error' | 'stale' | 'unpublished'

const STATUS_LABELS: Record<EckePublishStatus, string> = {
  never: 'Not previewed yet',
  draft: 'Preview ready',
  published: 'Published',
  error: 'Last publish failed',
  stale: 'Changes since last publish',
  unpublished: 'Unpublished',
}

type Props = {
  status: EckePublishStatus
  className?: string
}

function statusTone(status: EckePublishStatus): string {
  switch (status) {
    case 'published':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-950/30'
    case 'stale':
      return 'text-amber-200 border-amber-500/30 bg-amber-950/30'
    case 'error':
      return 'text-red-300 border-red-500/30 bg-red-950/30'
    case 'unpublished':
      return 'text-slate-300 border-dc-border bg-dc-elevated-muted'
    default:
      return 'text-slate-300 border-dc-border bg-dc-elevated-muted'
  }
}

export default function EckePublishStatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusTone(status)} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
