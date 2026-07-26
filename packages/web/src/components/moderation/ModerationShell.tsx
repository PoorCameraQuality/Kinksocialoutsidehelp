import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/contexts/AuthContext'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'
import { usePlatformModeratorGate } from '@/hooks/usePlatformModeratorGate'
import type { ModerationOutletContext, ModerationSummary } from '@/lib/moderation/moderation-outlet-context'
import {
  platformModNavShellClass,
  platformModShellHeaderClass,
} from '@/lib/moderation/platform-surfaces'
import { cn } from '@/lib/cn'

async function fetchModerationSummary(): Promise<ModerationSummary | null> {
  try {
    const r = await fetch('/api/v1/moderation/summary', { credentials: 'include' })
    if (!r.ok) return null
    return (await r.json()) as ModerationSummary
  } catch {
    return null
  }
}

function navClass({ isActive }: { isActive: boolean }, rail = false) {
  return cn(
    rail ?
      'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
    : 'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive ?
      'bg-dc-accent/15 text-dc-accent'
    : 'text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text',
  )
}

type ModNavLinkProps = {
  to: string
  end?: boolean
  children: ReactNode
  onNavigate?: () => void
  className?: string
  rail?: boolean
}

function ModNavLink({ to, end, children, onNavigate, className = '', rail = false }: ModNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn(navClass({ isActive }, rail), className)}
      onClick={onNavigate}
    >
      {children}
    </NavLink>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M12 3l7 4v5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V7l7-4z" />
    </svg>
  )
}

export default function ModerationShell() {
  const { isAuthenticated, status: authStatus } = useAuth()
  const { gate, siteAdmin } = usePlatformModeratorGate()
  const { staff } = useApiPlatformStaff(gate === 'ok')
  const location = useLocation()
  const [summary, setSummary] = useState<ModerationSummary | null>(null)
  const [moderationRefreshKey, setModerationRefreshKey] = useState(0)
  const [moreAdminOpen, setMoreAdminOpen] = useState(false)

  const refreshModeration = useCallback(() => {
    setModerationRefreshKey((n) => n + 1)
  }, [])

  const showLegal = staff?.siteAdmin || staff?.legalAdmin
  const showDmca = staff?.siteAdmin || staff?.trustSafetyAdmin || staff?.legalAdmin

  useEffect(() => {
    if (gate !== 'ok') return
    let cancelled = false
    void (async () => {
      const next = await fetchModerationSummary()
      if (!cancelled) setSummary(next)
    })()
    return () => {
      cancelled = true
    }
  }, [gate, location.pathname, moderationRefreshKey])

  if (authStatus !== 'ready') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-dc-muted">
        Checking session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState message="Sign in to access moderation tools." ctaLabel="Home" ctaHref="/home" />
      </div>
    )
  }

  if (gate === 'loading' || gate === 'idle') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-dc-muted">
        Checking moderator access…
      </div>
    )
  }

  if (gate === 'no') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          message="Your account is not platform staff (platform_staff table or C2K_PLATFORM_MODERATOR_USER_IDS)."
          ctaLabel="Back to settings"
          ctaHref="/settings"
        />
      </div>
    )
  }

  if (gate === 'err') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState message="Could not verify moderator status." ctaLabel="Settings" ctaHref="/settings" />
      </div>
    )
  }

  const closeMoreAdmin = () => setMoreAdminOpen(false)

  const primaryNav = (rail = false) => (
    <>
      <ModNavLink to="/moderation/dashboard" rail={rail}>
        Dashboard
      </ModNavLink>
      <ModNavLink to="/moderation/cases" rail={rail}>
        Cases
        {summary && summary.openReports > 0 ?
          <span className="ml-auto inline-flex min-w-[1.25rem] justify-center rounded-full bg-dc-accent/20 px-1.5 text-xs font-semibold text-dc-accent">
            {summary.openReports}
          </span>
        : null}
      </ModNavLink>
    </>
  )

  const secondaryNav = (dropdown?: boolean, rail = false) => (
    <>
      <ModNavLink
        to="/moderation/profile-flags"
        onNavigate={dropdown ? closeMoreAdmin : undefined}
        className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
        rail={rail}
      >
        Profile flags
        {summary && summary.openProfileFlags > 0 ?
          <span
            className={cn(
              'inline-flex min-w-[1.25rem] justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-200',
              rail && 'ml-auto',
              !rail && 'ml-1.5',
            )}
          >
            {summary.openProfileFlags}
          </span>
        : null}
      </ModNavLink>
      <ModNavLink
        to="/moderation/audit"
        onNavigate={dropdown ? closeMoreAdmin : undefined}
        className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
        rail={rail}
      >
        Audit
      </ModNavLink>
      {showDmca ?
        <ModNavLink
          to="/moderation/dmca"
          onNavigate={dropdown ? closeMoreAdmin : undefined}
          className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
          rail={rail}
        >
          DMCA
        </ModNavLink>
      : null}
      {showLegal ?
        <ModNavLink
          to="/moderation/legal"
          onNavigate={dropdown ? closeMoreAdmin : undefined}
          className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
          rail={rail}
        >
          Legal
        </ModNavLink>
      : null}
      {showDmca ?
        <ModNavLink
          to="/moderation/contact"
          onNavigate={dropdown ? closeMoreAdmin : undefined}
          className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
          rail={rail}
        >
          Contact inbox
        </ModNavLink>
      : null}
      {siteAdmin || staff?.siteOwner || staff?.trustSafetyAdmin ?
        <ModNavLink
          to="/moderation/mail-intake"
          onNavigate={dropdown ? closeMoreAdmin : undefined}
          className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
          rail={rail}
        >
          Mail intake
        </ModNavLink>
      : null}
      {siteAdmin ?
        <ModNavLink
          to="/moderation/admin"
          onNavigate={dropdown ? closeMoreAdmin : undefined}
          className={dropdown ? 'block w-full rounded-none px-3 py-2.5' : ''}
          rail={rail}
        >
          Admin
        </ModNavLink>
      : null}
    </>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className={cn(platformModShellHeaderClass, 'mb-6')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Trust &amp; Safety</p>
            <h1 className="mt-2 flex items-center gap-3 text-xl font-bold text-dc-text sm:text-2xl">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dc-accent/25 bg-dc-surface-muted text-dc-accent">
                <ShieldIcon className="h-5 w-5" />
              </span>
              Moderation console
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
              Review member reports, triage cases, and take human-only enforcement actions.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshModeration()}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text shadow-[var(--dc-shadow-soft)] hover:bg-dc-surface-muted"
            >
              Refresh
            </button>
            <Link
              to="/settings"
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted shadow-[var(--dc-shadow-soft)] hover:bg-dc-surface-muted hover:text-dc-text"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:block">
          <nav className={cn(platformModNavShellClass, 'sticky top-24')} aria-label="Moderation sections">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-dc-muted">Console</p>
            {primaryNav(true)}
            <div className="my-2 border-t border-dc-border/60" />
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-dc-muted">Administration</p>
            {secondaryNav(false, true)}
          </nav>
        </aside>

        <div className="min-w-0">
          <nav className="mb-5 border-b border-dc-border pb-3 lg:hidden" aria-label="Moderation sections">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-6 after:bg-gradient-to-l after:from-dc-surface after:to-transparent relative">
              {primaryNav()}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMoreAdminOpen((o) => !o)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    moreAdminOpen ?
                      'bg-dc-accent/15 text-dc-accent'
                    : 'text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text',
                  )}
                  aria-expanded={moreAdminOpen}
                >
                  More
                </button>
                {moreAdminOpen ?
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-panel)]">
                    {secondaryNav(true)}
                  </div>
                : null}
              </div>
            </div>
          </nav>

          <Outlet
            context={
              { refreshModeration, moderationRefreshKey, summary } satisfies ModerationOutletContext
            }
          />
        </div>
      </div>
    </div>
  )
}
