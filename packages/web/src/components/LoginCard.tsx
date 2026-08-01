import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { validatePublicUsername } from '@c2k/shared'
import { coercePostAuthPath } from '@/lib/auth-links'
import { fetchAlphaMode } from '@/lib/alpha-mode'
import { buildOnboardingHref, resolvePostAuthPath } from '@/lib/onboarding'
import FormField from '@/components/ui/FormField'
import { premiumInputClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'
import { SIGNUP_REASSURANCE } from '@/components/landing/landing-content'
import { LANDING_CTA_JOIN } from '@/lib/alpha-activation-copy'

type Tab = 'signup' | 'login'

export type LoginCardProps = {
  /** `login` only — signup is the default for new visitors */
  defaultTab?: Tab
  /** After successful login (must be same-origin path, e.g. from `?redirect=`) */
  redirectAfterLogin?: string
  variant?: 'default' | 'landing'
}

/** Landing signup checkbox with 44px hit area (audit-safe). */
function LandingCheckbox({
  checked,
  onChange,
  children,
  landing,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  landing: boolean
}) {
  const boxClass =
    landing ?
      'border-[var(--pub-border)] bg-white/[0.04]'
    : 'border-dc-border bg-dc-surface-muted'
  const checkedClass =
    landing ?
      'border-[var(--pub-gold-bright)] bg-[var(--pub-gold-bright)] text-[#0a0908]'
    : 'border-dc-accent bg-dc-accent text-white'
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-0.5">
      <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 z-10 h-9 w-9 cursor-pointer opacity-0 focus:outline-none"
        />
        <span
          aria-hidden
          className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded border ${boxClass} ${
            checked ? checkedClass : ''
          }`}
        >
          {checked ?
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          : null}
        </span>
      </span>
      <span className="pt-0.5 leading-snug">{children}</span>
    </label>
  )
}

function PasswordInput({
  id,
  label,
  autoComplete,
  value,
  onChange,
  hint,
  landing,
}: {
  id: string
  label: string
  autoComplete: string
  value: string
  onChange: (v: string) => void
  hint?: string
  landing: boolean
}) {
  const [visible, setVisible] = useState(false)
  const inputClass = landing ?
    cn(premiumInputClass, 'auth-input auth-input--landing')
  : premiumInputClass

  return (
    <FormField id={id} label={label} hint={hint}>
      <div className="relative">
        {landing ? null : (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-muted">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
        )}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, landing ? 'pr-11' : 'pl-10 pr-11')}
        />
        <button
          type="button"
          className={
            landing ?
              'absolute right-1 top-1/2 inline-flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-lg text-[var(--pub-text-soft)]'
            : 'absolute right-1 top-1/2 inline-flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-lg text-dc-muted'
          }
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ?
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 3.029a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          : <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        </button>
      </div>
    </FormField>
  )
}

export default function LoginCard({
  defaultTab = 'signup',
  redirectAfterLogin,
  variant = 'default',
}: LoginCardProps = {}) {
  const landing = variant === 'landing'
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  const [signupUsername, setSignupUsername] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupAgeAffirmed, setSignupAgeAffirmed] = useState(false)
  const [signupTermsAccepted, setSignupTermsAccepted] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupSubmitting, setSignupSubmitting] = useState(false)
  const [signupInviteCode, setSignupInviteCode] = useState('')
  const [registrationPolicy, setRegistrationPolicy] = useState<{
    registrationOpen: boolean
    inviteRequired: boolean
  }>({ registrationOpen: true, inviteRequired: false })

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    let cancelled = false
    void fetchAlphaMode().then((mode) => {
      if (!cancelled) {
        setRegistrationPolicy({
          registrationOpen: mode.registrationOpen,
          inviteRequired: mode.inviteRequired,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoginError(null)
    setLoginSubmitting(true)
    try {
      const r = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: loginIdentifier.trim(),
          password: loginPassword,
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setLoginError(typeof data.error === 'string' ? data.error : 'Login failed')
        return
      }
      await refresh()
      const next = await resolvePostAuthPath(redirectAfterLogin)
      navigate(next)
    } catch {
      setLoginError('Network error. Try again.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  async function handleSignupSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSignupError(null)
    const username = signupUsername.trim()
    const email = signupEmail.trim()
    if (!username || !email || !signupPassword) {
      setSignupError('Username, email, and password are required.')
      return
    }
    const usernameError = validatePublicUsername(username, email)
    if (usernameError) {
      setSignupError(usernameError)
      return
    }
    if (signupPassword.length < 8) {
      setSignupError('Password must be at least 8 characters.')
      return
    }
    if (!signupAgeAffirmed) {
      setSignupError('You must confirm you are at least 18 years old.')
      return
    }
    if (!signupTermsAccepted) {
      setSignupError('You must accept the terms and community rules.')
      return
    }
    if (!registrationPolicy.registrationOpen) {
      setSignupError('Registration is closed on this server.')
      return
    }
    if (registrationPolicy.inviteRequired && !signupInviteCode.trim()) {
      setSignupError('Invite code is required.')
      return
    }
    setSignupSubmitting(true)
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          email,
          password: signupPassword,
          ageAffirmed: true,
          termsAccepted: true,
          ...(registrationPolicy.inviteRequired ? { inviteCode: signupInviteCode.trim() } : {}),
        }),
      })
      const data = (await r.json()) as { error?: string }
      if (!r.ok) {
        setSignupError(typeof data.error === 'string' ? data.error : 'Could not create account')
        return
      }
      await refresh()
      navigate(buildOnboardingHref(coercePostAuthPath(redirectAfterLogin)))
    } catch {
      setSignupError('Network error. Try again.')
    } finally {
      setSignupSubmitting(false)
    }
  }

  const shellClass =
    landing ?
      'auth-card mx-auto w-full max-w-none'
    : 'mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-dc-accent-border/25 bg-dc-elevated-solid shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(212,175,55,0.12)]'

  const textInputClass = landing ?
    cn(premiumInputClass, 'auth-input auth-input--landing')
  : premiumInputClass

  return (
    <div className={shellClass}>
      {!landing ?
        <>
          <div className="h-1 bg-gradient-to-r from-transparent via-dc-accent/70 to-transparent" aria-hidden />
          <div className="border-b border-dc-border bg-gradient-to-r from-dc-accent/[0.08] via-transparent to-transparent px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-lg bg-dc-accent-muted p-2 text-dc-accent" aria-hidden>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-base font-semibold text-dc-text">Join Kink Social</h2>
                <p className="text-xs text-dc-muted">18+ community · Privacy-first · Free to join</p>
              </div>
            </div>
          </div>
        </>
      : null}

      <div className={landing ? 'auth-tabs' : 'flex border-b border-dc-border'} role="tablist" aria-label="Join or log in">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'signup'}
          onClick={() => setActiveTab('signup')}
          data-active={landing ? activeTab === 'signup' : undefined}
          className={
            landing ?
              'auth-tab'
            : `flex-1 min-h-touch px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'signup' ?
                  'border-b-2 border-dc-accent bg-dc-elevated-solid text-dc-text'
                : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
              }`
          }
        >
          Join free
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'login'}
          onClick={() => setActiveTab('login')}
          data-active={landing ? activeTab === 'login' : undefined}
          className={
            landing ?
              'auth-tab'
            : `flex-1 min-h-touch px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'login' ?
                  'border-b-2 border-dc-accent bg-dc-elevated-solid text-dc-text'
                : 'font-medium text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
              }`
          }
        >
          Log in
        </button>
      </div>

      <div className={landing ? 'auth-body' : 'p-6'} aria-live="polite">
        {activeTab === 'signup' ?
          <>
            {!landing ?
              <>
                <p className="mb-4 text-sm leading-relaxed text-dc-text-muted">
                  Create your profile in minutes. Find events, meet people, and build community safely.
                </p>
                <ul className="mb-5 flex flex-wrap gap-2">
                  {SIGNUP_REASSURANCE.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dc-accent-border/25 bg-dc-accent-muted/30 px-2.5 py-1 text-[11px] font-medium text-dc-text-muted"
                    >
                      <span className="text-dc-accent" aria-hidden>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            : null}
            {!registrationPolicy.registrationOpen ?
              <p
                className={
                  landing ?
                    'rounded-xl border border-[var(--pub-border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--pub-text-muted)]'
                  : 'rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3 text-sm text-dc-text-muted'
                }
              >
                Registration is closed on this test server. Contact the team for an account.
              </p>
            : null}
            <form className="space-y-4" onSubmit={handleSignupSubmit} noValidate>
              {registrationPolicy.inviteRequired ?
                <FormField id="signup-invite" label="Invite code">
                  <input
                    id="signup-invite"
                    type="text"
                    autoComplete="off"
                    value={signupInviteCode}
                    onChange={(e) => setSignupInviteCode(e.target.value)}
                    className={textInputClass}
                  />
                </FormField>
              : null}
              <FormField
                id="signup-username"
                label="Username"
                hint="Your public @handle on profile URLs and mentions — not your email."
              >
                <input
                  id="signup-username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. MedusaMinded"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  className={textInputClass}
                />
              </FormField>
              <FormField id="signup-email" label="Email address">
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={textInputClass}
                />
              </FormField>
              <PasswordInput
                id="signup-password"
                label="Password"
                hint="At least 8 characters"
                autoComplete="new-password"
                value={signupPassword}
                onChange={setSignupPassword}
                landing={landing}
              />
              <div
                className={
                  landing ?
                    'space-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-snug text-[var(--pub-text-muted)]'
                  : 'space-y-1 rounded-xl border border-dc-border bg-dc-surface-muted/60 px-3 py-2 text-xs leading-snug text-dc-text-muted'
                }
              >
                <LandingCheckbox checked={signupAgeAffirmed} onChange={setSignupAgeAffirmed} landing={landing}>
                  I confirm I am at least 18 years old.
                </LandingCheckbox>
                <LandingCheckbox checked={signupTermsAccepted} onChange={setSignupTermsAccepted} landing={landing}>
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className={landing ? 'text-[var(--pub-gold-bright)] hover:underline' : 'text-dc-accent hover:underline'}>
                      Terms
                    </Link>
                    ,{' '}
                    <Link to="/privacy" className={landing ? 'text-[var(--pub-gold-bright)] hover:underline' : 'text-dc-accent hover:underline'}>
                      Privacy Policy
                    </Link>
                    ,{' '}
                    <Link to="/guidelines" className={landing ? 'text-[var(--pub-gold-bright)] hover:underline' : 'text-dc-accent hover:underline'}>
                      Community Guidelines
                    </Link>
                    , and{' '}
                    <Link to="/adult-content-consent" className={landing ? 'text-[var(--pub-gold-bright)] hover:underline' : 'text-dc-accent hover:underline'}>
                      Adult Content policy
                    </Link>
                    .{' '}
                    <Link to="/policies" className={landing ? 'text-[var(--pub-gold-bright)] hover:underline' : 'text-dc-accent hover:underline'}>
                      View all policies
                    </Link>
                    .
                  </span>
                </LandingCheckbox>
              </div>
              {signupError ?
                <div
                  className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
                  role="alert"
                >
                  {signupError}
                </div>
              : null}
              <button
                type="submit"
                disabled={
                  signupSubmitting ||
                  !registrationPolicy.registrationOpen ||
                  !signupAgeAffirmed ||
                  !signupTermsAccepted ||
                  (registrationPolicy.inviteRequired && !signupInviteCode.trim())
                }
                className={
                  landing ?
                    'auth-submit'
                  : 'w-full min-h-11 rounded-xl bg-dc-accent px-4 py-3 font-semibold text-dc-accent-foreground transition-colors hover:bg-dc-accent-hover focus:outline-none focus:ring-2 focus:ring-dc-accent focus:ring-offset-2 focus:ring-offset-dc-surface disabled:opacity-60'
                }
              >
                {signupSubmitting ? 'Creating account…' : landing ? 'Create free account' : 'Create free profile'}
              </button>
            </form>
            {landing ?
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--pub-text-soft)]">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pub-gold-bright)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>
                  Your data is never shared. Read our{' '}
                  <Link to="/privacy" className="inline-flex min-h-touch items-center text-[var(--pub-gold-bright)] hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/guidelines" className="inline-flex min-h-touch items-center text-[var(--pub-gold-bright)] hover:underline">
                    Community Guidelines
                  </Link>
                  .
                </span>
              </p>
            : null}
          </>
        : <>
            {!landing ?
              <p className="mb-6 text-sm text-dc-text-muted">
                Welcome back. Log in to pick up where you left off.
              </p>
            : null}
            <form className={`space-y-4 ${landing ? 'pt-1' : ''}`} onSubmit={handleLoginSubmit} noValidate>
              <FormField id="login-identifier" label="Username or email">
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={loginError ? 'login-error' : undefined}
                  className={textInputClass}
                />
              </FormField>
              <PasswordInput
                id="login-password"
                label="Password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={setLoginPassword}
                landing={landing}
              />
              <div className="-mt-2 flex justify-end">
                <Link
                  to="/forgot-password"
                  className={
                    landing ?
                      'inline-flex min-h-touch items-center px-2 text-xs text-[var(--pub-gold-bright)] hover:underline'
                    : 'inline-flex min-h-touch items-center px-2 text-xs text-dc-accent hover:underline'
                  }
                >
                  Forgot password?
                </Link>
              </div>
              {loginError ?
                <div
                  id="login-error"
                  className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
                  role="alert"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <p className="flex-1">{loginError}</p>
                    <button
                      type="button"
                      onClick={() => setLoginError(null)}
                      className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              : null}
              <button
                type="submit"
                disabled={loginSubmitting}
                className={
                  landing ?
                    'auth-submit'
                  : 'w-full min-h-11 rounded-xl border border-dc-accent-border/60 bg-dc-elevated px-4 py-3 font-semibold text-dc-text transition-colors hover:border-dc-accent-border hover:bg-dc-elevated-hover focus:outline-none focus:ring-2 focus:ring-dc-accent focus:ring-offset-2 focus:ring-offset-dc-surface disabled:cursor-not-allowed disabled:opacity-60'
                }
              >
                {loginSubmitting ? 'Signing in…' : 'Log in'}
              </button>
            </form>
            <p className={landing ? 'mt-5 text-center text-sm text-[var(--pub-text-muted)]' : 'mt-5 text-center text-sm text-dc-text-muted'}>
              New here?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className={landing ? 'inline-flex min-h-touch items-center font-semibold text-[var(--pub-gold-bright)] hover:underline' : 'inline-flex min-h-touch items-center font-semibold text-dc-accent hover:underline'}
              >
                {landing ? LANDING_CTA_JOIN : 'Join free'}
              </button>
            </p>
          </>
        }
      </div>
    </div>
  )
}
