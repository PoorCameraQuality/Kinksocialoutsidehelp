import type { FeedSettings } from './user-settings.js'

export const ONBOARDING_STEP_COUNT = 11 as const

/** Flow version for remapping saved steps from the pre-hybrid 6-step wizard. */
export const ONBOARDING_FLOW_VERSION = 2 as const

/**
 * Map a step saved under the old 6-step funnel into the hybrid 11-step funnel.
 * Old: welcome(1) safety(2) profile(3) privacy(4) interests(5) firstSteps(6)
 * New: welcome(1) age(2) email(3) photo(4) about(5) kinks(6) details(7) privacy(8) intents(9) gallery(10) firstSteps(11)
 */
export function remapLegacyOnboardingStep(step: number): number {
  const map: Record<number, number> = {
    1: 1,
    2: 2,
    3: 5,
    4: 8,
    5: 9,
    6: 11,
  }
  return map[Math.round(step)] ?? 1
}

/** Clamp a (possibly stale) saved step into the current valid range [1, ONBOARDING_STEP_COUNT]. */
export function clampOnboardingStep(step: number | null | undefined): number {
  if (typeof step !== 'number' || Number.isNaN(step)) return 1
  return Math.min(Math.max(Math.round(step), 1), ONBOARDING_STEP_COUNT)
}

export const ONBOARDING_INTENT_OPTIONS = [
  { id: 'friends', label: 'Make friends' },
  { id: 'events', label: 'Find events' },
  { id: 'groups', label: 'Join groups' },
  { id: 'orgs', label: 'Follow organizations' },
  { id: 'organize', label: 'Organize events' },
  { id: 'learn', label: 'Learn' },
  { id: 'conventions', label: 'Explore conventions' },
] as const

export type OnboardingIntentId = (typeof ONBOARDING_INTENT_OPTIONS)[number]['id']

export type OnboardingFeedFields = {
  onboardingCompletedAt?: string | null
  onboardingStep?: number
  onboardingSafetyAckAt?: string | null
  onboardingIntents?: string[]
  startHereDismissedAt?: string | null
  emailVerificationSkippedAt?: string | null
  onboardingFlowVersion?: number
}

export function isOnboardingComplete(feed: OnboardingFeedFields | null | undefined): boolean {
  if (!feed) return false
  return typeof feed.onboardingCompletedAt === 'string' && feed.onboardingCompletedAt.length > 0
}

export function onboardingStepNumber(feed: OnboardingFeedFields | null | undefined): number {
  return clampOnboardingStep(feed?.onboardingStep)
}

export function hasSafetyAcknowledgement(feed: OnboardingFeedFields | null | undefined): boolean {
  return typeof feed?.onboardingSafetyAckAt === 'string' && feed.onboardingSafetyAckAt.length > 0
}

export function shouldShowStartHere(feed: OnboardingFeedFields | null | undefined): boolean {
  if (!isOnboardingComplete(feed)) return true
  if (!feed?.startHereDismissedAt) return true
  const completed = feed.onboardingCompletedAt ? Date.parse(feed.onboardingCompletedAt) : NaN
  if (!Number.isFinite(completed)) return true
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - completed < sevenDays
}

export function profileCompletionPercent(input: {
  displayName?: string | null
  bio?: string | null
  photoCount?: number
  privacyConfigured?: boolean
  joinedOrFollowed?: boolean
}): number {
  let score = 0
  if ((input.displayName ?? '').trim().length > 0) score += 25
  if ((input.bio ?? '').trim().length > 0) score += 20
  if ((input.photoCount ?? 0) > 0) score += 25
  if (input.privacyConfigured) score += 15
  if (input.joinedOrFollowed) score += 15
  return Math.min(100, score)
}

export function mergeOnboardingFeedPatch(
  feed: FeedSettings,
  patch: Partial<OnboardingFeedFields>,
): FeedSettings {
  return { ...feed, ...patch }
}
