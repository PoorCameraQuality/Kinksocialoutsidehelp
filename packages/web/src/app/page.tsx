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
import { Navigate, useSearchParams } from 'react-router-dom'
import { safeInternalPath } from '@c2k/shared'

export default function LandingPage() {
  const { status, isAuthenticated, isFallback } = useAuth()
  const [searchParams] = useSearchParams()
  const rawRedirect = searchParams.get('redirect') ?? undefined
  const redirectAfterLogin = safeInternalPath(rawRedirect)
  const loginParam = searchParams.get('login')
  const loginFocus = loginParam === '1' || loginParam === 'true'

  const signupProps = {
    defaultTab: loginFocus ? ('login' as const) : ('signup' as const),
    redirectAfterLogin,
    variant: 'landing' as const,
  }

  if (status === 'ready' && isAuthenticated && !isFallback) {
    return <Navigate to="/home" replace />
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
