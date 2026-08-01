import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SiteWordmark from '@/components/brand/SiteWordmark'
import { isDancecardHost } from '@/lib/dancecard-host'

type Props = {
  children: ReactNode
}

export default function LandingLoginFocus({ children }: Props) {
  const homeHref = isDancecardHost() ? '/play' : '/'
  const backLabel = isDancecardHost() ? '← Back to Play Spaces' : '← Back to the landing page'

  return (
    <section className="beta-login-focus" aria-labelledby="login-focus-title">
      <div className="public-container beta-login-focus__inner">
        <div className="mb-6 text-center">
          <Link to={homeHref} className="inline-flex justify-center" aria-label="Home">
            <SiteWordmark className="text-xl font-semibold tracking-tight text-[var(--beta-text)]" />
          </Link>
          <h1 id="login-focus-title" className="mt-4 text-2xl font-bold text-[var(--beta-text)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[var(--beta-muted)]">Sign in or create your free account.</p>
        </div>
        {children}
        <p className="mt-6 text-center text-sm text-[var(--beta-muted)]">
          <Link to={homeHref} className="underline underline-offset-4">
            {backLabel}
          </Link>
        </p>
      </div>
    </section>
  )
}
