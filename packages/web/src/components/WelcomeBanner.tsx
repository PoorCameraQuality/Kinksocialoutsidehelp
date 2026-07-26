import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ProfileOnboardingGap } from '@/lib/profile-onboarding'
import { buildProfileOnboardingHref, formatProfileOnboardingGaps } from '@/lib/profile-onboarding'

const WELCOME_DISMISSED_KEY = 'c2k-welcome-dismissed'
const PROFILE_NUDGE_DISMISSED_KEY = 'c2k-profile-nudge-dismissed'

function dismissKey(base: string, username: string | null): string {
  return username ? `${base}:${username}` : base
}

type ProfileIncompleteProps = {
  gaps: ProfileOnboardingGap[]
  username: string | null
  className?: string
}

/** Soft, dismissible nudge when ZIP, birth date, or photo are missing. */
export function ProfileIncompleteBanner({ gaps, username, className = '' }: ProfileIncompleteProps) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    setDismissed(sessionStorage.getItem(dismissKey(PROFILE_NUDGE_DISMISSED_KEY, username)) === '1')
  }, [username])

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(dismissKey(PROFILE_NUDGE_DISMISSED_KEY, username), '1')
    }
  }

  if (!mounted || dismissed || gaps.length === 0) return null

  const missing = formatProfileOnboardingGaps(gaps)
  const finishHref = buildProfileOnboardingHref('/home')

  return (
    <div
      className={`relative rounded-xl border border-dc-accent-border/40 bg-dc-accent-muted/15 px-3 py-3 sm:px-4 ${className}`}
      role="status"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-dc-muted hover:text-dc-text rounded"
        aria-label="Dismiss profile reminder"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-sm text-dc-text pr-8">
        <span className="font-medium text-dc-text">Finish your profile.</span> Add your {missing} so people can find you.
      </p>
      <Link
        to={finishHref}
        className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-dc-accent hover:underline"
      >
        Complete profile
      </Link>
    </div>
  )
}

/**
 * Fetish.com-style welcome banner for new users.
 * Dismissible; persists in sessionStorage.
 */
export default function WelcomeBanner({ username = null, className = '' }: { username?: string | null; className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    setMounted(true)
    setDismissed(sessionStorage.getItem(dismissKey(WELCOME_DISMISSED_KEY, username)) === '1')
  }, [username])

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(dismissKey(WELCOME_DISMISSED_KEY, username), '1')
    }
  }

  if (!mounted || dismissed) return null

  return (
    <div className={`relative rounded-xl border border-dc-border/80 bg-dc-elevated-muted/50 px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-dc-muted hover:text-dc-text rounded"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-xs text-dc-muted pr-8">
        Welcome to Kink Social! We&apos;re constantly developing and improving. Need help?{' '}
        <Link to="/support" className="text-dc-accent hover:underline">Support Center</Link>
        {' '}·{' '}
        <Link to="/people" className="text-dc-accent hover:underline">Search for members</Link>
        {' '}·{' '}
        <Link to={buildProfileOnboardingHref('/home')} className="text-dc-accent hover:underline">Complete your profile</Link>
        {' '}·{' '}
        <Link to="/messaging" className="text-dc-accent hover:underline">Messages</Link>
      </p>
    </div>
  )
}
