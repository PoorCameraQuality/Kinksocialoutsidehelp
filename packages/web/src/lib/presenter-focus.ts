export const PROFILE_FOCUS_VALUES = [
  'EDUCATOR',
  'PRESENTER',
  'SPEAKER',
  'PANELIST',
  'AUTHOR',
  'PHOTOGRAPHER',
  'MEDIA_CREATOR',
  'DEMO_PARTNER',
  'FACILITATOR',
] as const

export type ProfileFocus = (typeof PROFILE_FOCUS_VALUES)[number]

export type PresenterProfileKind = 'PRES' | 'AUTHOR' | 'BOTH' | 'PHOTO'

export const PRESENTER_ONBOARDING_TRACKS = [
  'educator',
  'speaker',
  'author',
  'photographer',
  'hybrid',
] as const

export type PresenterOnboardingTrack = (typeof PRESENTER_ONBOARDING_TRACKS)[number]

export const PRESENTER_TRACK_LABELS: Record<PresenterOnboardingTrack, string> = {
  educator: 'Educator or instructor',
  speaker: 'Presenter, speaker, or panelist',
  author: 'Author or writer',
  photographer: 'Photographer or media creator',
  hybrid: 'Hybrid profile',
}

export const FOCUS_DISPLAY_LABELS: Record<ProfileFocus, string> = {
  EDUCATOR: 'Educator',
  PRESENTER: 'Presenter',
  SPEAKER: 'Speaker',
  PANELIST: 'Panelist',
  AUTHOR: 'Author',
  PHOTOGRAPHER: 'Photographer',
  MEDIA_CREATOR: 'Media creator',
  DEMO_PARTNER: 'Demo partner',
  FACILITATOR: 'Facilitator',
}

export const TRACK_DEFAULT_FOCUSES: Record<PresenterOnboardingTrack, ProfileFocus[]> = {
  educator: ['EDUCATOR'],
  speaker: ['PRESENTER'],
  author: ['AUTHOR'],
  photographer: ['PHOTOGRAPHER'],
  hybrid: [],
}

export const SPEAKER_FOCUS_OPTIONS: ProfileFocus[] = [
  'PRESENTER',
  'SPEAKER',
  'PANELIST',
  'FACILITATOR',
  'DEMO_PARTNER',
]

export const PHOTOGRAPHER_FOCUS_OPTIONS: ProfileFocus[] = ['PHOTOGRAPHER', 'MEDIA_CREATOR']

export const HYBRID_FOCUS_OPTIONS: { focus: ProfileFocus; label: string }[] = [
  { focus: 'EDUCATOR', label: 'Educator' },
  { focus: 'PRESENTER', label: 'Presenter or speaker' },
  { focus: 'AUTHOR', label: 'Author or writer' },
  { focus: 'PHOTOGRAPHER', label: 'Photographer or media creator' },
  { focus: 'DEMO_PARTNER', label: 'Demo partner' },
  { focus: 'FACILITATOR', label: 'Facilitator' },
]

export function parseOnboardingTrack(raw: string | null | undefined): PresenterOnboardingTrack | null {
  if (!raw) return null
  const normalized = raw.trim().toLowerCase()
  return (PRESENTER_ONBOARDING_TRACKS as readonly string[]).includes(normalized) ?
      (normalized as PresenterOnboardingTrack)
    : null
}

export function profileKindFromFocuses(focuses: ProfileFocus[]): PresenterProfileKind {
  const set = new Set(focuses)
  const hasAuthor = set.has('AUTHOR')
  const hasPhoto = set.has('PHOTOGRAPHER') || set.has('MEDIA_CREATOR')
  const hasTeaching =
    set.has('EDUCATOR') ||
    set.has('PRESENTER') ||
    set.has('SPEAKER') ||
    set.has('PANELIST') ||
    set.has('FACILITATOR') ||
    set.has('DEMO_PARTNER')

  if (hasAuthor && (hasTeaching || hasPhoto)) return 'BOTH'
  if (hasAuthor && !hasTeaching && !hasPhoto) return 'AUTHOR'
  if (hasPhoto && !hasAuthor && !hasTeaching) return 'PHOTO'
  if (hasPhoto && hasTeaching && !hasAuthor) return 'PRES'
  return 'PRES'
}

export function formatProfileFocusLabels(
  focuses: ProfileFocus[] | null | undefined,
  primary?: ProfileFocus | null
): string | null {
  const list = focuses?.length ? [...focuses] : []
  if (list.length === 0) return null

  const ordered =
    primary && list.includes(primary) ?
      [primary, ...list.filter((f) => f !== primary)]
    : list

  const labels = ordered.map((f) => FOCUS_DISPLAY_LABELS[f] ?? f)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1].toLowerCase()}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1].toLowerCase()}`
}

export function presenterRoleLabel(
  profileKind: string,
  profileFocuses?: ProfileFocus[] | null,
  primaryProfileFocus?: ProfileFocus | null
): string | null {
  const focusLabel = formatProfileFocusLabels(profileFocuses, primaryProfileFocus)
  if (focusLabel) return focusLabel
  switch (profileKind) {
    case 'PRES':
      return 'Presenter'
    case 'AUTHOR':
      return 'Author'
    case 'BOTH':
      return 'Presenter & author'
    case 'PHOTO':
      return 'Photographer'
    default:
      return null
  }
}

export function tagsFromCsv(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
}

export function csvFromTags(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ')
}

export function hasPortfolioLink(links: Record<string, string>): boolean {
  const keys = ['portfolio', 'website', 'writing portfolio', 'writing_portfolio', 'media']
  return keys.some((k) => Boolean(links[k]?.trim() || links[k.toLowerCase()]?.trim()))
}

export function isTeachingFocus(focus: ProfileFocus): boolean {
  return focus === 'EDUCATOR'
}

export function isSpeakingFocus(focus: ProfileFocus): boolean {
  return (
    focus === 'PRESENTER' ||
    focus === 'SPEAKER' ||
    focus === 'PANELIST' ||
    focus === 'FACILITATOR' ||
    focus === 'DEMO_PARTNER'
  )
}

export function isPhotoFocus(focus: ProfileFocus): boolean {
  return focus === 'PHOTOGRAPHER' || focus === 'MEDIA_CREATOR'
}

export function offeringsSectionLabel(focuses: ProfileFocus[]): string {
  if (focuses.some(isPhotoFocus)) return 'Services and coverage'
  if (focuses.includes('AUTHOR') && !focuses.some((f) => f === 'EDUCATOR' || isSpeakingFocus(f))) {
    return 'Optional talks or readings'
  }
  if (focuses.some(isSpeakingFocus)) return 'Sessions and talks'
  return 'Classes and offerings'
}
