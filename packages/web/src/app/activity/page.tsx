import { Navigate } from 'react-router-dom'
import ActivityPageClient from '@/app/activity/ActivityPageClient'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

export default function ActivityHubPage() {
  const { isAuthenticated, isFallback, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-dc-muted sm:px-6">Loading…</div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginHref('/activity')} replace />
  }

  if (isFallback) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-dc-text">Activity</h1>
        <p className="mt-2 text-sm text-dc-muted">Sign in with the API to use your unified activity timeline.</p>
      </div>
    )
  }

  return <ActivityPageClient />
}
