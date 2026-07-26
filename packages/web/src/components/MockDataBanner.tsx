import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

/**
 * Dev-only strip clarifying demo viewer vs local API sessions.
 */
export default function MockDataBanner() {
  const { pathname } = useLocation()
  const { status, isFallback, isAuthenticated } = useAuth()
  const onLanding = pathname === '/'

  if (!import.meta.env.DEV || status !== 'ready') return null

  const demoCatalogFallback = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'

  if (isFallback) {
    if (onLanding) {
      return (
        <div
          className="border-b border-amber-200/10 bg-[#0a0a0b]/95 px-3 py-1.5 text-center text-[11px] leading-snug text-[#8f887f]"
          role="status"
        >
          Previewing public community pages.{' '}
          <a href={buildLoginHref()} className="font-semibold text-[#f0c94d] underline hover:text-[#f6e08a]">
            Sign in
          </a>{' '}
          to personalize results.
        </div>
      )
    }
    return (
      <div
        className="border-b border-dc-border/60 bg-dc-elevated-muted/80 px-4 py-2 text-center text-xs text-dc-text-muted"
        role="status"
      >
        <strong className="font-semibold text-dc-text">Public preview:</strong>
        {' '}
        Sign in to personalize results and use your account.{' '}
        <a href={buildLoginHref()} className="text-dc-accent underline hover:text-dc-accent-hover">
          Sign in
        </a>
        .
      </div>
    )
  }

  if (demoCatalogFallback && !isAuthenticated) {
    return (
      <div
        className="border-b border-dc-warning/30 bg-dc-warning-muted px-4 py-2 text-center text-xs text-dc-text-muted"
        role="status"
      >
        <strong className="font-semibold text-dc-text">Preview catalogs:</strong>
        {' '}
        Empty home rails are filled with demo cards for layout review. Sign in for live data.
      </div>
    )
  }

  return null
}
