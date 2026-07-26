import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'

type Item = {
  id: string
  label: string
  done: boolean
  optional?: boolean
  anchor: string
}

type Props = {
  items: Item[]
  publicProfileHref: string | null
}

export default function ProfileEditCompletionCard({ items, publicProfileHref }: Props) {
  const required = items.filter((i) => !i.optional)
  const doneRequired = required.filter((i) => i.done).length
  const pct = required.length > 0 ? Math.round((doneRequired / required.length) * 100) : 0
  const complete = pct >= 100

  return (
    <Card padding="md" className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-dc-text">
          {complete ? 'Profile complete' : 'Public profile readiness'}
        </p>
        {!complete ?
          <span className="text-sm font-bold text-dc-accent tabular-nums">{pct}%</span>
        : (
          <span className="text-xs font-semibold text-emerald-400">Ready</span>
        )}
      </div>
      {!complete ?
        <div className="h-2 rounded-full bg-dc-elevated-solid overflow-hidden mb-4">
          <div
            className="h-full bg-dc-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      : null}
      {complete && publicProfileHref ?
        <p className="text-xs text-dc-muted mb-3 leading-relaxed">
          Your public profile has the essentials. Optional sections can still be added anytime.
        </p>
      : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                item.done ? 'bg-emerald-600/30 text-emerald-300' : 'border border-dc-border text-dc-muted'
              }`}
              aria-hidden
            >
              {item.done ? '✓' : ''}
            </span>
            <Link to={item.anchor} className="text-dc-text-muted hover:text-dc-accent flex-1">
              {item.label}
              {item.optional ? <span className="text-dc-muted"> (optional)</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {complete && publicProfileHref ?
        <Link
          to={publicProfileHref}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-accent/50 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted/25"
        >
          View public profile
        </Link>
      : null}
    </Card>
  )
}
