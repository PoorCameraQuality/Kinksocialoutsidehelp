import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { onboardingPathsExempt } from '@/lib/onboarding'

const DISMISS_KEY = 'c2k-email-verify-nudge-dismissed'

function dismissKey(username: string | null): string {
  return username ? `${DISMISS_KEY}:${username}` : DISMISS_KEY
}

/** Soft, session-dismissible nudge when the account email is not verified. */
export default function EmailVerifyNudgeBanner() {
  const { pathname } = useLocation()
  const { isAuthenticated, isFallback, viewerUsername } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)
  const [emailMasked, setEmailMasked] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    setDismissed(sessionStorage.getItem(dismissKey(viewerUsername)) === '1')
  }, [viewerUsername])

  useEffect(() => {
    if (!isAuthenticated || isFallback) {
      setNeedsVerify(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/auth/email/status', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const j = (await r.json()) as { verified?: boolean; emailMasked?: string | null; hasEmail?: boolean }
        if (cancelled) return
        setEmailMasked(j.emailMasked ?? null)
        setNeedsVerify(Boolean(j.hasEmail) && !j.verified)
      } catch {
        if (!cancelled) setNeedsVerify(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isFallback])

  if (!mounted || !isAuthenticated || isFallback) return null
  if (onboardingPathsExempt(pathname) || pathname.startsWith('/verify-email')) return null
  if (dismissed || !needsVerify) return null

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem(dismissKey(viewerUsername), '1')
  }

  return (
    <div
      className="border-b border-dc-accent-border/40 bg-dc-accent-muted/15 px-3 py-2.5 text-center sm:px-4"
      role="status"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-dc-text">
        <p>
          <span className="font-medium">Verify your email</span>
          {emailMasked ? ` (${emailMasked})` : ''} to protect account recovery.
        </p>
        <Link to="/verify-email" className="font-semibold text-dc-accent hover:underline">
          Verify now
        </Link>
        <Link to="/settings/account" className="text-dc-text-muted hover:underline">
          Settings
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-dc-muted hover:text-dc-text"
          aria-label="Dismiss email verification reminder"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
