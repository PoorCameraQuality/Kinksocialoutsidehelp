import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

/** Resolves owning org and opens embedded convention program manager. */
export default function OrganizerConventionManageRedirect() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setError('Convention not found.')
          return
        }
        const j = (await r.json()) as {
          organizationSummary?: { slug?: string } | null
        }
        const found = j.organizationSummary?.slug ?? null
        if (!found) {
          if (!cancelled) setError('This convention is not linked to an organization.')
          return
        }
        if (!cancelled) {
          navigate(
            `/organizer/orgs/${encodeURIComponent(found)}/conventions/${encodeURIComponent(slug)}`,
            { replace: true },
          )
        }
      } catch {
        if (!cancelled) setError('Network error loading convention.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-dc-text-muted">{error}</p>
        <Link to="/organizer" className="mt-4 inline-block text-dc-accent hover:underline">
          Back to organizer hub
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center" aria-busy="true">
      <p className="text-dc-text-muted">Opening program manager…</p>
    </div>
  )
}
