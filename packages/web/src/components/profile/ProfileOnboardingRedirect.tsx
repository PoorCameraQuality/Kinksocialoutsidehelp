import { Navigate, useSearchParams } from 'react-router-dom'
import { safeInternalPath } from '@c2k/shared'
import { buildOnboardingHref } from '@/lib/onboarding'

/** Canonical redirect for legacy `/profile/complete` URLs. */
export default function ProfileOnboardingRedirect() {
  const [searchParams] = useSearchParams()
  const redirect = safeInternalPath(searchParams.get('redirect') ?? undefined)
  return <Navigate to={buildOnboardingHref(redirect)} replace />
}
