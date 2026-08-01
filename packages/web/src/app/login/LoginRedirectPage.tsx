import { safeInternalPath } from '@c2k/shared'
import LoginCard from '@/components/LoginCard'
import '@/components/landing/public-auth.css'
import '@/components/landing/landing-beta.css'
import LandingLoginFocus from '@/components/landing/LandingLoginFocus'
import LandingPageMeta from '@/components/seo/LandingPageMeta'
import PublicNav from '@/components/landing/PublicNav'
import { useAuth } from '@/contexts/AuthContext'
import { coercePostAuthPath, loginRedirectSearchParams } from '@/lib/auth-links'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'

/**
 * Dedicated login route (stay-path on dancecard).
 * Canonical auth UI — never bounce through `/?login=1` on dancecard.
 */
export default function LoginRedirectPage() {
  const { status, isAuthenticated, isFallback } = useAuth()
  const { search } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const redirectAfterLogin = safeInternalPath(searchParams.get('redirect') ?? undefined)
  const wantsSignup =
    searchParams.get('signup') === '1' ||
    searchParams.get('tab') === 'signup' ||
    searchParams.get('defaultTab') === 'signup'

  // Normalize legacy ?login=1 / ?next= onto clean /login?redirect=…
  useEffect(() => {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    if (!params.has('login') && !params.has('next')) return
    const normalized = loginRedirectSearchParams(search)
    const next = new URLSearchParams(normalized.startsWith('?') ? normalized.slice(1) : normalized)
    if (params.get('signup') === '1' || params.get('tab') === 'signup') next.set('signup', '1')
    setSearchParams(next, { replace: true })
  }, [search, setSearchParams])

  if (status === 'ready' && isAuthenticated && !isFallback) {
    return <Navigate to={coercePostAuthPath(redirectAfterLogin)} replace />
  }

  return (
    <div className="public-page public-landing-page public-landing-page--login-focus">
      <LandingPageMeta />
      <PublicNav minimal loginFocus />
      <main id="main-content">
        <LandingLoginFocus>
          <LoginCard
            defaultTab={wantsSignup ? 'signup' : 'login'}
            redirectAfterLogin={redirectAfterLogin}
            variant="landing"
          />
        </LandingLoginFocus>
      </main>
    </div>
  )
}
