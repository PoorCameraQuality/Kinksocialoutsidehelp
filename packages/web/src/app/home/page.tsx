import { Suspense } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import HomePageClient from './HomePageClient'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { EXPLORE_DASHBOARD_PATH } from '@/lib/app-routes'

function HomeFallback() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-11 max-w-full animate-pulse rounded-lg bg-white/5" />
      <div className="mt-6 space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-xl bg-white/5" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { status, isAuthenticated, isFallback } = useAuth()
  const { pathname, search } = useLocation()

  if (status === 'loading') {
    return <HomeFallback />
  }

  if (!isAuthenticated || isFallback) {
    return <Navigate to={buildLoginHref(`${pathname}${search}`)} replace />
  }

  const tab = new URLSearchParams(search).get('tab')
  if (tab?.toLowerCase() === 'trending') {
    return <Navigate to={EXPLORE_DASHBOARD_PATH} replace />
  }

  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePageClient />
    </Suspense>
  )
}
