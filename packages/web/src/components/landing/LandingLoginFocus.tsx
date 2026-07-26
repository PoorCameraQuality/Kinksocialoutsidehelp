import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SiteWordmark from '@/components/brand/SiteWordmark'

type Props = {
  children: ReactNode
}

export default function LandingLoginFocus({ children }: Props) {
  return (
    <section className="beta-login-focus" aria-labelledby="login-focus-title">
      <div className="public-container beta-login-focus__inner">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex justify-center" aria-label="Kink Social home">
            <SiteWordmark className="text-xl font-semibold tracking-tight text-[var(--beta-text)]" />
          </Link>
          <h1 id="login-focus-title" className="mt-4 text-2xl font-bold text-[var(--beta-text)]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[var(--beta-muted)]">Sign in or create your free account.</p>
        </div>
        {children}
        <p className="mt-6 text-center text-sm text-[var(--beta-muted)]">
          <Link to="/" className="underline underline-offset-4">
            ← Back to the landing page
          </Link>
        </p>
      </div>
    </section>
  )
}
