import { Link } from 'react-router-dom'
import ConnectionsPageClient from '@/app/connections/ConnectionsPageClient'
import { useAuth } from '@/contexts/AuthContext'

export default function ConnectionsPage() {
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-dc-text-muted sm:px-6 lg:px-8">Loading…</div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-dc-text">Connections</h1>
        <p className="mb-6 text-dc-text-muted">
          Log in to see connection requests and people you are connected with.
        </p>
        <Link to="/" className="font-medium text-dc-accent hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return <ConnectionsPageClient />
}
