import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { isPublicWebPath } from '@/lib/public-routes'

/** Redirect anonymous visitors to the landing login unless the route is public. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation()
  const { status, isAuthenticated, isFallback } = useAuth()

  if (isPublicWebPath(pathname)) {
    return children
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" aria-busy="true">
        <p className="text-sm text-dc-muted">Loading…</p>
      </div>
    )
  }

  if (isAuthenticated && !isFallback) {
    return children
  }

  const redirect = `${pathname}${search}`
  return <Navigate to={buildLoginHref(redirect)} replace />
}
