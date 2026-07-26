import { Link } from 'react-router-dom'

const PROOF_LINES = [
  { user: 'RopeDreamer', action: 'shared an event', time: '1h ago', initial: 'R' },
  { user: 'LeatherMama', action: 'joined a group', time: '3h ago', initial: 'L' },
] as const

export default function LandingCommunityProof({ className = '' }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-dc-border bg-dc-elevated-solid/90 p-4 shadow-[var(--dc-shadow-soft)] ${className}`}
      aria-label="Community trust"
    >
      <h2 className="text-sm font-semibold text-dc-text">Real people. Real participation.</h2>
      <ul className="mt-3 space-y-2.5">
        {PROOF_LINES.map((row) => (
          <li key={row.user} className="flex gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc-accent/20 text-xs font-semibold text-dc-accent"
              aria-hidden
            >
              {row.initial}
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-dc-text">
                <span className="font-medium">{row.user}</span>{' '}
                <span className="text-dc-text-muted">{row.action}</span>
              </p>
              <p className="text-xs text-dc-muted">{row.time}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-dc-muted">
        Reputation and references tie to real-world events. Not anonymous likes.
      </p>
      <Link
        to="/home?mode=discover&tab=Local"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-dc-accent hover:underline"
      >
        See community activity →
      </Link>
    </section>
  )
}
