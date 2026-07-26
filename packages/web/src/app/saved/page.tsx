import { Navigate } from 'react-router-dom'
import SavedPageClient from '@/app/saved/SavedPageClient'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

export default function SavedPage() {
  const { status, isAuthenticated } = useAuth()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-dc-muted sm:px-6">Loading…</div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginHref('/saved')} replace />
  }

  return <SavedPageClient />
}
