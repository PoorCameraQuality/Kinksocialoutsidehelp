import { Navigate } from 'react-router-dom'
import MediaUploadComposer from '@/components/media/MediaUploadComposer'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

export default function CreatePage() {
  const { status, isAuthenticated } = useAuth()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center text-dc-muted sm:px-6">Loading…</div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginHref('/create')} replace />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-dc-text">Create</h1>
        <p className="mt-1 text-sm text-dc-text-muted">
          Share pictures, video, or writing with your community.
        </p>
      </header>
      <MediaUploadComposer />
    </div>
  )
}
