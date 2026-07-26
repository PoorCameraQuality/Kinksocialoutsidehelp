import type { ProfileFocus, PresenterOnboardingTrack } from './presenter-focus'
import { parseOnboardingTrack, TRACK_DEFAULT_FOCUSES } from './presenter-focus'

export const EDUCATOR_STEPS = [
  'chooseTrack',
  'welcome',
  'basics',
  'visibility',
  'teachingStyle',
  'catalog',
  'organizerMaterials',
  'skillsMentorship',
  'linksGallery',
  'review',
  'done',
] as const

export const SPEAKER_STEPS = [
  'chooseTrack',
  'welcome',
  'basics',
  'visibility',
  'topicsFormats',
  'sessionCatalog',
  'logistics',
  'linksMedia',
  'review',
  'done',
] as const

export const AUTHOR_STEPS = [
  'chooseTrack',
  'welcome',
  'basics',
  'visibility',
  'writingFocus',
  'publicationsLinks',
  'optionalTalks',
  'media',
  'review',
  'done',
] as const

export const PHOTOGRAPHER_STEPS = [
  'chooseTrack',
  'welcome',
  'basics',
  'visibility',
  'portfolioGallery',
  'services',
  'consentPrivacyDelivery',
  'links',
  'review',
  'done',
] as const

export type EducatorStep = (typeof EDUCATOR_STEPS)[number]
export type SpeakerStep = (typeof SPEAKER_STEPS)[number]
export type AuthorStep = (typeof AUTHOR_STEPS)[number]
export type PhotographerStep = (typeof PHOTOGRAPHER_STEPS)[number]

export type HybridStep =
  | 'chooseTrack'
  | 'hybridFocusPick'
  | 'welcome'
  | 'basics'
  | 'visibility'
  | 'educatorModule'
  | 'speakerModule'
  | 'authorModule'
  | 'photoModule'
  | 'review'
  | 'done'

export type PresenterOnboardingStep =
  | EducatorStep
  | SpeakerStep
  | AuthorStep
  | PhotographerStep
  | HybridStep

export type PresenterProfileSnapshot = {
  headline: string | null
  bioShort?: string | null
  bio?: string | null
  backgroundStory?: string | null
  directoryVisibility: string
  expertiseTags: string[] | null
  profileKind?: string
  links?: Record<string, string>
  mentorshipOffered?: boolean
  mentorshipNotes?: string | null
}

export type OnboardingResumeState = {
  track: PresenterOnboardingTrack | null
  profileFocuses: ProfileFocus[]
  primaryProfileFocus: ProfileFocus | null
  profile: PresenterProfileSnapshot | null
  offeringCount: number
  galleryCount: number
  skillClaimCount: number
  catalogSkipped?: boolean
  optionalTalksSkipped?: boolean
  speakerTopicsFilled?: boolean
  portfolioSatisfied?: boolean
}

/** Short labels for the wizard stepper rail / progress, keyed by step id. */
export const PRESENTER_STEP_LABELS: Record<string, string> = {
  chooseTrack: 'Track',
  hybridFocusPick: 'Focus areas',
  welcome: 'Welcome',
  basics: 'Basics',
  visibility: 'Visibility',
  teachingStyle: 'Teaching style',
  catalog: 'Class catalog',
  organizerMaterials: 'Organizer materials',
  skillsMentorship: 'Skills & mentorship',
  linksGallery: 'Links & gallery',
  topicsFormats: 'Topics & formats',
  sessionCatalog: 'Session catalog',
  logistics: 'Logistics',
  linksMedia: 'Links & media',
  writingFocus: 'Writing focus',
  publicationsLinks: 'Publications & links',
  optionalTalks: 'Talks',
  media: 'Media',
  portfolioGallery: 'Portfolio',
  services: 'Services',
  consentPrivacyDelivery: 'Consent & delivery',
  links: 'Links',
  educatorModule: 'Teaching',
  speakerModule: 'Speaking',
  authorModule: 'Writing',
  photoModule: 'Photography',
  review: 'Review',
  done: 'Done',
}

/** Steps that are skippable — surfaced as "Optional" hints in the stepper. */
export const PRESENTER_OPTIONAL_STEPS: ReadonlySet<string> = new Set([
  'catalog',
  'organizerMaterials',
  'skillsMentorship',
  'linksGallery',
  'sessionCatalog',
  'logistics',
  'linksMedia',
  'optionalTalks',
  'media',
  'services',
  'links',
])

export function stepsForTrack(track: PresenterOnboardingTrack | null, hybridFocuses: ProfileFocus[] = []): string[] {
  if (!track) return ['chooseTrack']
  if (track === 'educator') return [...EDUCATOR_STEPS]
  if (track === 'speaker') return [...SPEAKER_STEPS]
  if (track === 'author') return [...AUTHOR_STEPS]
  if (track === 'photographer') return [...PHOTOGRAPHER_STEPS]
  const steps: HybridStep[] = ['chooseTrack', 'hybridFocusPick', 'welcome', 'basics', 'visibility']
  if (hybridFocuses.includes('EDUCATOR')) steps.push('educatorModule')
  if (
    hybridFocuses.some((f) =>
      ['PRESENTER', 'SPEAKER', 'PANELIST', 'FACILITATOR', 'DEMO_PARTNER'].includes(f)
    )
  ) {
    steps.push('speakerModule')
  }
  if (hybridFocuses.includes('AUTHOR')) steps.push('authorModule')
  if (hybridFocuses.includes('PHOTOGRAPHER') || hybridFocuses.includes('MEDIA_CREATOR')) {
    steps.push('photoModule')
  }
  steps.push('review', 'done')
  return steps
}

export function stepIndexForTrack(
  track: PresenterOnboardingTrack | null,
  step: string,
  hybridFocuses: ProfileFocus[] = []
): number {
  const steps = stepsForTrack(track, hybridFocuses)
  const idx = steps.indexOf(step)
  return idx >= 0 ? idx : 0
}

export function initialPresenterOnboardingStep(state: OnboardingResumeState): string {
  const { track, profileFocuses, primaryProfileFocus, profile, offeringCount, galleryCount } = state

  if (!track) return 'chooseTrack'
  if (track === 'hybrid' && profileFocuses.length === 0) return 'hybridFocusPick'

  const steps = stepsForTrack(track, profileFocuses)

  if (!profile?.headline?.trim()) {
    const basicsIdx = steps.indexOf('basics')
    return basicsIdx >= 0 ? 'basics' : steps[1] ?? 'chooseTrack'
  }

  if (!profile.directoryVisibility) {
    const visIdx = steps.indexOf('visibility')
    return visIdx >= 0 ? 'visibility' : 'basics'
  }

  if (track === 'educator') {
    if (!profile.bio?.trim() && !profile.backgroundStory?.trim()) return 'teachingStyle'
    if (offeringCount === 0 && !state.catalogSkipped) return 'catalog'
  }

  if (track === 'speaker') {
    if (!state.speakerTopicsFilled && offeringCount === 0) return 'topicsFormats'
    if (offeringCount === 0 && !state.catalogSkipped) return 'sessionCatalog'
  }

  if (track === 'author') {
    if (!profile.bio?.trim() && !profile.backgroundStory?.trim()) return 'writingFocus'
    const links = profile.links ?? {}
    const hasPubLink = Object.values(links).some((v) => v.trim())
    if (!hasPubLink) return 'publicationsLinks'
    if (offeringCount === 0 && !state.optionalTalksSkipped && steps.includes('optionalTalks')) {
      return 'optionalTalks'
    }
  }

  if (track === 'photographer') {
    if (!state.portfolioSatisfied && galleryCount === 0) return 'portfolioGallery'
    if (offeringCount === 0 && !state.catalogSkipped) return 'services'
    if (!profile.bio?.trim() && !profile.backgroundStory?.trim()) return 'consentPrivacyDelivery'
  }

  if (track === 'hybrid') {
    for (const mod of ['educatorModule', 'speakerModule', 'authorModule', 'photoModule'] as const) {
      if (!steps.includes(mod)) continue
      if (mod === 'photoModule' && !state.portfolioSatisfied && galleryCount === 0) return mod
      if (mod === 'authorModule') {
        const links = profile?.links ?? {}
        if (!Object.values(links).some((v) => v.trim()) && !profile?.bio?.trim()) return mod
      }
      if ((mod === 'educatorModule' || mod === 'speakerModule') && offeringCount === 0 && !state.catalogSkipped) {
        return mod
      }
    }
  }

  if (primaryProfileFocus || profileFocuses.length > 0) return 'review'
  return 'done'
}

export function inferTrackFromFocuses(focuses: ProfileFocus[]): PresenterOnboardingTrack | null {
  if (focuses.length === 0) return null
  if (focuses.length > 1) return 'hybrid'
  const f = focuses[0]
  if (f === 'EDUCATOR') return 'educator'
  if (f === 'AUTHOR') return 'author'
  if (f === 'PHOTOGRAPHER' || f === 'MEDIA_CREATOR') return 'photographer'
  return 'speaker'
}

export function defaultFocusesForTrack(track: PresenterOnboardingTrack): ProfileFocus[] {
  return [...TRACK_DEFAULT_FOCUSES[track]]
}

export function trackFromQueryParam(raw: string | null): PresenterOnboardingTrack | null {
  return parseOnboardingTrack(raw)
}

export const FORBIDDEN_ONBOARDING_COPY = [
  'coming soon',
  'not yet available',
  'placeholder',
  'future feature',
  'upload coming soon',
  'disabled for now',
  'under construction',
] as const

export function onboardingCopyIsAllowed(text: string): boolean {
  const lower = text.toLowerCase()
  return !FORBIDDEN_ONBOARDING_COPY.some((phrase) => lower.includes(phrase))
}
