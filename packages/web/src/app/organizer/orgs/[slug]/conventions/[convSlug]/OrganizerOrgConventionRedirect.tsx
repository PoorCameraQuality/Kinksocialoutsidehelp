import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

/** Opens convention program manager in organizer context for a known org + convention pair. */
export default function OrganizerOrgConventionRedirect() {
  const { slug: orgSlug = '', convSlug = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgSlug || !convSlug) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/conventions/${encodeURIComponent(convSlug)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setError('Convention not found.')
          return
        }
        const j = (await r.json()) as {
          organizationSummary?: { slug?: string } | null
        }
        const linkedOrgSlug = j.organizationSummary?.slug ?? null
        if (linkedOrgSlug && linkedOrgSlug !== orgSlug) {
          if (!cancelled) setError('This convention belongs to a different organization.')
          return
        }
        if (!cancelled) {
          navigate(
            `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(convSlug)}`,
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
  }, [orgSlug, convSlug, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-dc-text-muted">{error}</p>
        <Link
          to={orgSlug ? `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule` : '/organizer'}
          className="mt-4 inline-block text-dc-accent hover:underline"
        >
          Back to organizer
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
