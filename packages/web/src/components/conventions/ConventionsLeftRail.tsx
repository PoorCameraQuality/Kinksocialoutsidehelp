import { Link, useLocation } from 'react-router-dom'
import ConventionFiltersPanel, { type ConventionFilterState } from '@/components/conventions/ConventionFiltersPanel'
import type { ConventionEventType } from '@/lib/conventions-page-utils'

type Props = {
  filterState: ConventionFilterState
  eventTypeCounts: Map<ConventionEventType, number>
}

const NAV = [
  { href: '/conventions', label: 'Browse Conventions', match: 'browse' },
  { href: '/events?mine=registrations', label: 'My RSVPs & registrations', match: 'tickets' },
  { href: '/saved', label: 'Saved', match: 'saved' },
  { href: '/conventions?view=past', label: 'Past Conventions', match: 'past' },
] as const

export default function ConventionsLeftRail({ filterState, eventTypeCounts }: Props) {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)

  const activeMatch = () => {
    if (params.get('view') === 'past') return 'past'
    if (params.get('mine') === '1') return 'mine'
    if (pathname === '/saved') return 'saved'
    if (pathname === '/events' && params.get('mine') === 'registrations') return 'tickets'
    return 'browse'
  }
  const current = activeMatch()

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Conventions navigation and filters">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <nav aria-label="Conventions sections">
          <ul className="space-y-0.5 border-b border-dc-border pb-4">
            {NAV.map((item) => {
              const active = item.match === current
              return (
                <li key={item.label}>
                  <Link
                    to={item.href}
                    className={`flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active ?
                        'bg-dc-accent-muted text-dc-accent'
                      : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <ConventionFiltersPanel idPrefix="conv-rail" f={filterState} eventTypeCounts={eventTypeCounts} />
      </div>

      <div className="rounded-2xl border border-dc-accent-border/30 bg-gradient-to-br from-dc-elevated-solid to-dc-surface-muted p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text">Stay in the loop</h3>
        <p className="mt-1 text-xs text-dc-text-muted">
          Get alerts when new conventions publish registration or early-bird pricing opens.
        </p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-4 flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-dc-border bg-dc-elevated-muted text-sm font-semibold text-dc-muted"
          title="Convention notifications coming soon"
        >
          Enable Notifications
          <span className="rounded-full bg-dc-elevated-solid px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-muted">
            Soon
          </span>
        </button>
      </div>
    </aside>
  )
}
