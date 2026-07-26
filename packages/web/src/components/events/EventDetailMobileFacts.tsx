import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type Props = {
  whenLine: string
  hostTzLine?: string | null
  countdownLabel?: string | null
  isVirtual: boolean
  locationNode: ReactNode
  hostUsername?: string | null
  hostName?: string | null
  rsvpCount: number
  capacityMax?: number | null
  formatBadges?: ReactNode
}

export default function EventDetailMobileFacts({
  whenLine,
  hostTzLine,
  countdownLabel,
  isVirtual,
  locationNode,
  hostUsername,
  hostName,
  rsvpCount,
  capacityMax,
  formatBadges,
}: Props) {
  const hostLabel = hostName?.trim() || hostUsername || 'Community host'

  return (
    <section className="space-y-3 lg:hidden" aria-label="Event at a glance">
      <div className="flex flex-wrap gap-2">{formatBadges}</div>
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid/80 p-4 shadow-[var(--dc-shadow-soft)]">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">When</dt>
            <dd className="mt-1 font-medium text-dc-text">{whenLine}</dd>
            {hostTzLine ?
              <dd className="mt-0.5 text-xs text-dc-muted">Also {hostTzLine} (host timezone)</dd>
            : null}
            {countdownLabel ?
              <dd className="mt-0.5 text-xs text-sky-200/90">{countdownLabel}</dd>
            : null}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
              {isVirtual ? 'Format' : 'Location'}
            </dt>
            <dd className="mt-1 text-dc-text">{locationNode}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Host</dt>
            <dd className="mt-1">
              {hostUsername ?
                <Link to={`/profile/${encodeURIComponent(hostUsername)}`} className="font-medium text-dc-accent hover:underline">
                  {hostLabel}
                </Link>
              : <span className="text-dc-text">{hostLabel}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Attendance</dt>
            <dd className="mt-1 text-dc-text-muted">
              {rsvpCount} going
              {typeof capacityMax === 'number' ? ` · cap ${capacityMax}` : ''}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
