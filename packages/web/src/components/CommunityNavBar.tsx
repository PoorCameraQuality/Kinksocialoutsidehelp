import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import HomeFeedScopeNav from '@/components/home/HomeFeedScopeNav'
import { showHomeMobileFeedNav } from '@/lib/community-nav'

/**
 * Lightweight home-only nav: Following, Near you, Trending.
 * Visible below lg only — desktop feed scope lives in HomePageClient at lg+.
 * Directory destinations live in the Header browse row (md+).
 */
export default function CommunityNavBar() {
  const { pathname } = useLocation()
  const { isAuthenticated, isFallback, status } = useAuth()

  if (!showHomeMobileFeedNav(pathname)) {
    return null
  }

  if (status === 'loading') {
    return (
      <div
        className="sticky z-40 h-12 border-b border-dc-border-subtle bg-dc-elevated/95 backdrop-blur-md lg:hidden"
        style={{ top: 'var(--c2k-sticky-below-header)' }}
        aria-hidden
      />
    )
  }

  if (!isAuthenticated || isFallback) {
    return null
  }

  const onHome = pathname === '/home' || pathname === '/' || pathname === '/feed'
  if (!onHome) {
    return null
  }

  return (
    <div
      className="sticky z-40 border-b border-dc-border-subtle bg-dc-elevated/95 backdrop-blur-md lg:hidden"
      style={{ top: 'var(--c2k-sticky-below-header)' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
        <HomeFeedScopeNav />
      </div>
    </div>
  )
}
