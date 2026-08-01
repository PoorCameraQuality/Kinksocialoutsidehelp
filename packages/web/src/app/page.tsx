import '@/components/landing/public-auth.css'
import '@/components/landing/landing-beta.css'
import LandingFaq from '@/components/landing/LandingFaq'
import LandingHero from '@/components/landing/LandingHero'
import LandingJoinSection from '@/components/landing/LandingJoinSection'
import LandingLoginFocus from '@/components/landing/LandingLoginFocus'
import LandingNotDating from '@/components/landing/LandingNotDating'
import LandingOrganizerBetaSection from '@/components/landing/LandingOrganizerBetaSection'
import LandingPathways from '@/components/landing/LandingPathways'
import LandingPlatformShowcase from '@/components/landing/LandingPlatformShowcase'
import LandingPublicFooter from '@/components/landing/LandingPublicFooter'
import LandingSafetyBetaSection from '@/components/landing/LandingSafetyBetaSection'
import LandingSignupBlock from '@/components/landing/LandingSignupBlock'
import MobilePublicNav from '@/components/landing/MobilePublicNav'
import PublicNav from '@/components/landing/PublicNav'
import LandingPageMeta from '@/components/seo/LandingPageMeta'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHrefFromLegacySearch, coercePostAuthPath } from '@/lib/auth-links'
import { isDancecardHost } from '@/lib/dancecard-host'
import { Navigate, useSearchParams } from 'react-router-dom'
import { safeInternalPath } from '@c2k/shared'

export default function LandingPage() {
  const { status, isAuthenticated, isFallback } = useAuth()
  const [searchParams] = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? undefined
  const redirectAfterLogin = safeInternalPath(rawRedirect)
  const loginParam = searchParams.get('login')
  const signupParam = searchParams.get('signup')
  const loginFocus = loginParam === '1' || loginParam === 'true'
  const wantsAuth = loginFocus || signupParam === '1'

  /**
   * Dancecard must never mount the apex marketing LoginCard.
   * Remounts of that card (redirect races) were the mobile flicker.
   */
  if (isDancecardHost()) {
    if (wantsAuth) {
      return <Navigate to={buildLoginHrefFromLegacySearch(searchParams.toString())} replace />
    }
    if (status === 'ready' && isAuthenticated && !isFallback) {
      return <Navigate to={coercePostAuthPath(redirectAfterLogin)} replace />
    }
    if (status === 'loading') {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4" aria-busy="true">
          <p className="text-sm text-dc-muted">Loading…</p>
        </div>
      )
    }
    return <Navigate to="/play" replace />
  }

  const signupProps = {
    defaultTab: loginFocus ? ('login' as const) : ('signup' as const),
    redirectAfterLogin,
    variant: 'landing' as const,
  }

  if (status === 'ready' && isAuthenticated && !isFallback) {
    return <Navigate to={coercePostAuthPath(redirectAfterLogin)} replace />
  }

  return (
    <div
      className={`public-page public-landing-page${loginFocus ? ' public-landing-page--login-focus' : ''}`}
    >
      <LandingPageMeta />
      <PublicNav minimal={loginFocus} loginFocus={loginFocus} />
      <MobilePublicNav minimal={loginFocus} loginFocus={loginFocus} />

      <main id="main-content">
        {loginFocus ?
          <LandingLoginFocus>
            <LandingSignupBlock {...signupProps} />
          </LandingLoginFocus>
        : <>
            <LandingHero />
            <LandingPathways />
            <LandingNotDating />
            <LandingPlatformShowcase />
            <LandingOrganizerBetaSection />
            <LandingSafetyBetaSection />
            <LandingFaq />
            <LandingJoinSection>
              <div id="auth" className="landing-split__card scroll-mt-24">
                <LandingSignupBlock {...signupProps} />
              </div>
            </LandingJoinSection>
          </>
        }
      </main>

      <LandingPublicFooter />
    </div>
  )
}
