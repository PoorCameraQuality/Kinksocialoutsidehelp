import { Link } from 'react-router-dom'

type Props = {
  label: string
  done: boolean
  href: string
  priority?: 'high' | 'normal'
  optional?: boolean
  hint?: string
}

export default function OrganizerSetupCard({
  label,
  done,
  href,
  priority = 'normal',
  optional = false,
  hint,
}: Props) {
  return (
    <Link
      to={href}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-dc-accent-border/40 ${
        done ? 'border-emerald-500/25 bg-emerald-950/20'
        : optional ? 'border-dc-border/70 bg-dc-surface/30 border-dashed'
        : priority === 'high' ? 'border-dc-accent-border/30 bg-dc-accent/5'
        : 'border-dc-border bg-dc-surface/40'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-emerald-500/20 text-emerald-300'
          : optional ? 'bg-dc-elevated-muted text-dc-muted'
          : 'bg-dc-elevated-muted text-dc-muted'
        }`}
        aria-hidden
      >
        {done ? '✓' : optional ? '◇' : '○'}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${done && !optional ? 'text-dc-text-muted line-through' : 'text-dc-text'}`}>
          {label}
          {optional ?
            <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-dc-muted">Optional</span>
          : null}
        </span>
        {hint ?
          <span className="mt-0.5 block text-dc-micro text-dc-text-muted">{hint}</span>
        : null}
      </span>
    </Link>
  )
}
