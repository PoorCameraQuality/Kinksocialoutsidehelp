import { safeInternalPath } from '@c2k/shared'

export type ProfileOnboardingGap = 'zip' | 'birthDate' | 'photo'

export type ProfileOnboardingInput = {
  homeZip?: string | null
  birthDate?: string | null
  photoCount?: number
}

const GAP_LABELS: Record<ProfileOnboardingGap, string> = {
  zip: 'ZIP code',
  birthDate: 'date of birth',
  photo: 'profile photo',
}

export function getProfileOnboardingGaps(input: ProfileOnboardingInput): ProfileOnboardingGap[] {
  const gaps: ProfileOnboardingGap[] = []
  const zip = (input.homeZip ?? '').replace(/\D/g, '')
  if (zip.length < 5) gaps.push('zip')
  if (!input.birthDate?.trim()) gaps.push('birthDate')
  if ((input.photoCount ?? 0) < 1) gaps.push('photo')
  return gaps
}

export function isProfileOnboardingComplete(input: ProfileOnboardingInput): boolean {
  return getProfileOnboardingGaps(input).length === 0
}

export function formatProfileOnboardingGaps(gaps: ProfileOnboardingGap[]): string {
  const labels = gaps.map((g) => GAP_LABELS[g])
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export function buildProfileOnboardingHref(redirect?: string | null): string {
  const q = new URLSearchParams()
  const after = safeInternalPath(redirect ?? undefined)
  if (after) q.set('redirect', after)
  const qs = q.toString()
  return qs ? `/profile/edit?${qs}` : '/profile/edit'
}
