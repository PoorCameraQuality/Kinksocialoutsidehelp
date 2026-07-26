export const ORG_ONBOARDING_STEPS = ['welcome', 'basics', 'visibility', 'launch'] as const

export type OrgOnboardingStep = (typeof ORG_ONBOARDING_STEPS)[number]

export const ORG_ONBOARDING_STEP_LABELS: Record<OrgOnboardingStep, string> = {
  welcome: 'Welcome',
  basics: 'Details',
  visibility: 'Visibility',
  launch: 'Launch',
}

export const ORG_WELCOME_TITLE = 'Create an organization'
export const ORG_WELCOME_INTRO =
  'Build a home for your events, members, communications, and public listings. You become the owner and can add admins from the organizer dashboard.'
export const ORG_BASICS_HEADING = 'Organization details'
export const ORG_BASICS_INTRO = 'Use the name people already know you by. You can add branding and feature toggles after creation.'
export const ORG_VISIBILITY_HEADING = 'Who can find your organization?'
export const ORG_VISIBILITY_INTRO = 'You can change visibility later in the organizer dashboard.'
export const ORG_LAUNCH_HEADING = 'Review and create'
export const ORG_LAUNCH_INTRO = 'After creation, you land in the organizer dashboard to finish setup.'

export type OrgVisibility = 'PUBLIC' | 'MEMBERS' | 'PRIVATE'

export const ORG_VISIBILITY_OPTIONS: {
  value: OrgVisibility
  label: string
  description: string
}[] = [
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Anyone can find the public hub.',
  },
  {
    value: 'MEMBERS',
    label: 'Members only',
    description: 'Only members can see community details.',
  },
  {
    value: 'PRIVATE',
    label: 'Private',
    description: 'Hidden from the public directory; share the hub link directly.',
  },
]

export function stepIndex(step: OrgOnboardingStep): number {
  return ORG_ONBOARDING_STEPS.indexOf(step)
}
