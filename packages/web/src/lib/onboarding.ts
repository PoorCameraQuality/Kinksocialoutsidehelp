import {
  isOnboardingComplete,
  safeInternalPath,
  type FeedSettings,
  type UserSettingsBundle,
} from '@c2k/shared'

export {
  isOnboardingComplete,
  onboardingStepNumber,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_INTENT_OPTIONS,
  profileCompletionPercent,
  shouldShowStartHere,
} from '@c2k/shared'

export function buildOnboardingHref(redirect?: string | null): string {
  const q = new URLSearchParams()
  const after = safeInternalPath(redirect ?? undefined)
  if (after) q.set('redirect', after)
  const qs = q.toString()
  return qs ? `/onboarding?${qs}` : '/onboarding'
}

export async function resolvePostAuthPath(redirect?: string | null): Promise<string> {
  const after = safeInternalPath(redirect ?? undefined) ?? '/home'
  try {
    const r = await fetch('/api/settings/me', { credentials: 'include' })
    if (!r.ok) return after
    const data = (await r.json()) as Partial<UserSettingsBundle>
    if (data.feed && !isOnboardingComplete(data.feed)) {
      return buildOnboardingHref(after)
    }
  } catch {
    /* use default destination */
  }
  return after
}

export function onboardingPathsExempt(pathname: string): boolean {
  if (pathname.startsWith('/onboarding')) return true
  if (pathname.startsWith('/verify-email')) return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/forgot-password')) return true
  if (pathname.startsWith('/reset-password')) return true
  if (pathname.startsWith('/terms')) return true
  if (pathname.startsWith('/privacy')) return true
  if (pathname.startsWith('/guidelines')) return true
  if (pathname.startsWith('/policies')) return true
  if (pathname.startsWith('/moderation')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/support')) return true
  if (pathname.startsWith('/contact')) return true
  return false
}

export type OnboardingPersistInput = {
  feed: FeedSettings
  privacy?: UserSettingsBundle['privacy']
}

export async function persistOnboardingSettings(input: OnboardingPersistInput): Promise<boolean> {
  try {
    const r = await fetch('/api/settings/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        feed: input.feed,
        ...(input.privacy ? { privacy: input.privacy } : {}),
      }),
    })
    return r.ok
  } catch {
    return false
  }
}
