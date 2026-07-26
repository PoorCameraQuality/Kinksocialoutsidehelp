import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'

type ClaimPreview = {
  valid: boolean
  reason?: string
  organization?: {
    slug: string
    displayName: string
    logoUrl: string | null
  }
  expiresAt?: string
}

export default function OrgClaimPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [preview, setPreview] = useState<ClaimPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  const redirectPath = `/orgs/claim/${encodeURIComponent(token)}`

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const res = await fetch(`/api/v1/organizations/claim/preview/${encodeURIComponent(token)}`)
        if (!res.ok) {
          if (!cancelled) setLoadError('Could not load claim invite.')
          return
        }
        const data = (await res.json()) as ClaimPreview
        if (!cancelled) setPreview(data)
      } catch {
        if (!cancelled) setLoadError('Could not load claim invite.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onClaim = useCallback(async () => {
    if (!token || !isAuthenticated) return
    setBusy(true)
    setClaimError(null)
    try {
      const res = await fetch('/api/v1/organizations/claim/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { error?: string; organizationSlug?: string }
      if (!res.ok) {
        setClaimError(data.error ?? 'Claim failed')
        return
      }
      if (data.organizationSlug) {
        navigate(`/organizer/orgs/${encodeURIComponent(data.organizationSlug)}`, { replace: true })
      }
    } catch {
      setClaimError('Claim failed')
    } finally {
      setBusy(false)
    }
  }, [token, isAuthenticated, navigate])

  const reasonCopy: Record<string, string> = {
    not_found: 'This claim link is invalid.',
    expired: 'This claim link has expired. Ask the operator for a new one.',
    already_redeemed: 'This claim link was already used.',
    already_claimed: 'This organization has already been claimed.',
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-6 shadow-[var(--dc-shadow-soft)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Organization handoff</p>
        <h1 className="mt-2 text-2xl font-semibold text-dc-text">Claim your organization</h1>

        {loadError ?
          <p className="mt-4 text-sm text-red-300" role="alert">
            {loadError}
          </p>
        : null}

        {!loadError && preview && !preview.valid ?
          <p className="mt-4 text-sm text-dc-text-muted">
            {reasonCopy[preview.reason ?? ''] ?? 'This claim link is no longer valid.'}
          </p>
        : null}

        {!loadError && preview?.valid && preview.organization ?
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4">
              {preview.organization.logoUrl ?
                <img
                  src={preview.organization.logoUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl border border-dc-border object-cover"
                />
              : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dc-border bg-dc-surface text-lg font-semibold text-dc-muted">
                  {preview.organization.displayName.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-dc-text">{preview.organization.displayName}</p>
                <p className="text-sm text-dc-text-muted">@{preview.organization.slug}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-dc-text-muted">
              Accept ownership to run your organizer console, conventions, and ECKE publishing for this organization on
              Kink Social.
            </p>
            {preview.expiresAt ?
              <p className="text-xs text-dc-muted">
                Link expires {new Date(preview.expiresAt).toLocaleString()}
              </p>
            : null}

            {!isAuthenticated ?
              <Link
                to={buildLoginHref(redirectPath)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Sign in to claim
              </Link>
            : (
              <>
                {claimError ?
                  <p className="text-sm text-red-300" role="alert">
                    {claimError}
                  </p>
                : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onClaim()}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60"
                >
                  {busy ? 'Claiming…' : 'Claim ownership'}
                </button>
              </>
            )}
          </div>
        : null}

        {!loadError && !preview ?
          <p className="mt-4 text-sm text-dc-text-muted" aria-busy="true">
            Loading…
          </p>
        : null}
      </div>
    </div>
  )
}
