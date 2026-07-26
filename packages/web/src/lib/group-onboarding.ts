export const GROUP_ONBOARDING_STEPS = ['welcome', 'basics', 'community', 'launch'] as const

export type GroupOnboardingStep = (typeof GROUP_ONBOARDING_STEPS)[number]

export const GROUP_ONBOARDING_STEP_LABELS: Record<GroupOnboardingStep, string> = {
  welcome: 'Welcome',
  basics: 'Basics',
  community: 'Community',
  launch: 'Launch',
}

export const GROUP_WELCOME_TITLE = 'Create a group'
export const GROUP_WELCOME_INTRO =
  'Start a local or interest-based community. Name your group, set who can find it, and optionally add rules members accept when joining.'
export const GROUP_BASICS_HEADING = 'Group basics'
export const GROUP_BASICS_INTRO = 'Name your group, choose a purpose, and set who can find it.'
export const GROUP_COMMUNITY_HEADING = 'Community rules'
export const GROUP_COMMUNITY_INTRO = 'Optional rules members accept when joining. You can skip and add rules later from group settings.'
export const GROUP_LAUNCH_HEADING = 'Review and create'
export const GROUP_LAUNCH_INTRO = 'Confirm your details, then create your group.'

export function stepIndex(step: GroupOnboardingStep): number {
  return GROUP_ONBOARDING_STEPS.indexOf(step)
}
