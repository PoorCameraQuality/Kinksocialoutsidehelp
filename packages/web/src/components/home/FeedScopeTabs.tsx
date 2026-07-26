import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { EXPLORE_DASHBOARD_PATH } from '@/lib/app-routes'

const SCOPES = [
  { id: 'foryou', label: 'For you', href: '/home?mode=discover&tab=Local' },
  { id: 'following', label: 'Following', href: '/home?mode=following' },
  { id: 'nearby', label: 'Nearby', href: '/people' },
  { id: 'organizers', label: 'Organizers', href: '/events' },
  { id: 'trending', label: 'Explore', href: EXPLORE_DASHBOARD_PATH },
] as const

type Props = {
  showHeading?: boolean
  /** When true, hidden at lg+ so HomeFeedScopeNav is the sole desktop scope control. */
  hideOnDesktop?: boolean
}

export default function FeedScopeTabs({ showHeading = false, hideOnDesktop = false }: Props) {
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const mode = searchParams.get('mode') ?? 'discover'
  const tab = searchParams.get('tab') ?? 'Local'

  const activeId =
    pathname === EXPLORE_DASHBOARD_PATH ? 'trending'
    : mode === 'following' ? 'following'
    : tab === 'Trending' ? 'trending'
    : tab === 'People' ? 'nearby' // legacy tab param; redirects to /people
    : tab === 'Events' ? 'organizers'
    : tab === 'Local' && mode === 'discover' ? 'foryou'
    : 'foryou'

  return (
    <div className={`${showHeading ? 'mb-4' : 'mb-2'}${hideOnDesktop ? ' lg:hidden' : ''}`}>
      {showHeading ?
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-dc-text">Community activity</h2>
          <Link
            to="/people"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-dc-muted hover:bg-dc-elevated-hover hover:text-dc-text"
            aria-label="Filters"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </Link>
        </div>
      : null}
      <div className="relative">
        <div
          className="-mx-1 flex snap-x snap-mandatory items-end gap-0.5 overflow-x-auto px-1 pb-0.5 c2k-no-scrollbar scroll-smooth"
          role="tablist"
          aria-label="Community activity scope"
        >
          {SCOPES.map((scope) => {
            const selected = activeId === scope.id
            return (
              <Link
                key={scope.id}
                to={scope.href}
                role="tab"
                aria-selected={selected}
                className={`-mb-px shrink-0 snap-start min-h-11 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                  selected ?
                    'border-dc-accent text-dc-text'
                  : 'border-transparent text-dc-text-muted hover:border-dc-border-strong hover:text-dc-text'
                }`}
              >
                {scope.label}
              </Link>
            )
          })}
        </div>
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-dc-surface to-transparent"
          aria-hidden
        />
      </div>
    </div>
  )
}
