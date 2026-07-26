import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isOnboardingComplete } from '@c2k/shared'
import { useAuth } from '@/contexts/AuthContext'
import { buildOnboardingHref, onboardingPathsExempt } from '@/lib/onboarding'

/** Redirect authenticated members who have not finished first-time onboarding. */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation()
  const { isAuthenticated, isFallback, status } = useAuth()
  const [checked, setChecked] = useState(false)
  const [complete, setComplete] = useState(true)

  useEffect(() => {
    if (status !== 'ready' || !isAuthenticated || isFallback || onboardingPathsExempt(pathname)) {
      setComplete(true)
      setChecked(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/settings/me', { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) {
            setComplete(true)
            setChecked(true)
          }
          return
        }
        const data = (await r.json()) as { feed?: { onboardingCompletedAt?: string | null } }
        if (!cancelled) {
          setComplete(isOnboardingComplete(data.feed))
          setChecked(true)
        }
      } catch {
        if (!cancelled) {
          setComplete(true)
          setChecked(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, isAuthenticated, isFallback, pathname])

  if (!checked) return children

  if (isAuthenticated && !isFallback && !complete && !onboardingPathsExempt(pathname)) {
    const redirect = `${pathname}${search}`
    return <Navigate to={buildOnboardingHref(redirect)} replace />
  }

  return children
}
