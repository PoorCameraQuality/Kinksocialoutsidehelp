import type { ProfileEditTabId } from '@/components/profile/edit/ProfileEditTabNav'

export type StudioCheckItem = {
  key: string
  label: string
  complete: boolean
}

export type StudioSectionStatus = {
  complete: boolean
  progressLabel?: string
}

export type StudioCompletionInput = {
  displayName: string
  bio: string
  locationLabel: string
  hasPhoto: boolean
  roles: string[]
  lifestyleActivity: string
  lookingFor: string[]
  kinksCount: number
  linksCount: number
  relationshipsCount: number
  pronounTags: string[]
}

export function deriveStudioSectionStatus(input: StudioCompletionInput): Record<ProfileEditTabId, StudioSectionStatus> {
  const storyDone =
    input.displayName.trim().length > 0 &&
    input.locationLabel.trim().length > 0 &&
    input.bio.trim().length > 0 &&
    input.hasPhoto

  const identityFilled =
    input.roles.length > 0 ||
    Boolean(input.lifestyleActivity.trim()) ||
    input.pronounTags.length > 0

  const interestTarget = 3
  const interestCount = input.kinksCount

  return {
    basics: { complete: storyDone },
    identity: { complete: identityFilled && input.roles.length > 0 && Boolean(input.lifestyleActivity.trim()) },
    'looking-for': {
      complete: input.lookingFor.length > 0,
      progressLabel: input.lookingFor.length > 0 ? `${input.lookingFor.length} selected` : undefined,
    },
    interests: {
      complete: interestCount >= interestTarget,
      progressLabel: `${Math.min(interestCount, interestTarget)}/${interestTarget}`,
    },
    about: {
      complete: input.bio.trim().length >= 120,
      progressLabel: input.bio.trim().length >= 120 ? undefined : 'Add depth',
    },
    relationships: {
      complete: input.relationshipsCount > 0,
      progressLabel: input.relationshipsCount > 0 ? `${input.relationshipsCount}` : undefined,
    },
    privacy: { complete: true },
    links: {
      complete: input.linksCount > 0,
      progressLabel: input.linksCount > 0 ? `${input.linksCount}` : undefined,
    },
  }
}

export function deriveStudioEssentials(input: StudioCompletionInput): StudioCheckItem[] {
  return [
    { key: 'name', label: 'Display name', complete: input.displayName.trim().length > 0 },
    { key: 'location', label: 'Location', complete: input.locationLabel.trim().length > 0 },
    { key: 'bio', label: 'About', complete: input.bio.trim().length > 0 },
    { key: 'photo', label: 'Profile photo', complete: input.hasPhoto },
  ]
}

export function deriveStudioBoosters(input: StudioCompletionInput): StudioCheckItem[] {
  return [
    {
      key: 'headline',
      label: 'Role headline',
      complete: input.roles.length > 0 && Boolean(input.lifestyleActivity.trim()),
    },
    { key: 'goals', label: 'Looking for', complete: input.lookingFor.length > 0 },
    { key: 'interests', label: '3+ interests', complete: input.kinksCount >= 3 },
    { key: 'depth', label: 'About (120+ chars)', complete: input.bio.trim().length >= 120 },
    { key: 'roles', label: 'Community roles', complete: input.roles.length > 0 },
    { key: 'links', label: 'Links', complete: input.linksCount > 0 },
  ]
}

export function deriveStudioStrengthScore(essentials: StudioCheckItem[], boosters: StudioCheckItem[]): number {
  const essentialWeight = 0.55
  const boosterWeight = 0.45
  const ePct = essentials.filter((i) => i.complete).length / Math.max(essentials.length, 1)
  const bPct = boosters.filter((i) => i.complete).length / Math.max(boosters.length, 1)
  return Math.round((ePct * essentialWeight + bPct * boosterWeight) * 100)
}

export function deriveVisitorReadout(input: StudioCompletionInput): string {
  const parts: string[] = []
  if (input.roles.length > 0) parts.push(input.roles.slice(0, 2).join(' and ').toLowerCase())
  if (input.lifestyleActivity.trim()) parts.push(input.lifestyleActivity.trim().toLowerCase())
  if (input.lookingFor.length > 0) {
    parts.push(`looking for ${input.lookingFor.slice(0, 2).join(' and ').toLowerCase()}`)
  }
  if (parts.length >= 2) {
    return `Visitors can quickly see that you are ${parts.slice(0, 2).join(', ')}${parts[2] ? `, and ${parts[2]}` : ''}.`
  }
  if (parts.length === 1) {
    return `Visitors can see ${parts[0]}. Add connection goals and a fuller bio so people know why to reach out.`
  }
  return 'Add an About section, roles, and what you are looking for so visitors understand who you are and why to connect.'
}

export function deriveStudioNextSteps(boosters: StudioCheckItem[]): string[] {
  const labels: Record<string, string> = {
    headline: 'Add roles and experience level for your profile headline',
    goals: 'Add what you are looking for',
    interests: 'Add at least three interests',
    depth: 'Expand your About section',
    roles: 'Add community roles',
    links: 'Add a website or social link',
  }
  return boosters.filter((b) => !b.complete).slice(0, 4).map((b) => labels[b.key] ?? b.label)
}

/** Map public profile story props to the same completion input used in profile edit. */
export function buildStudioCompletionFromStory(input: {
  displayName: string
  bio: string | null
  location: string
  photoUrl?: string | null
  photoCount?: number
  roles: string[]
  lifestyleActivity?: string | null
  lookingFor: string[]
  kinksCount: number
  linksCount?: number
  relationshipsCount?: number
  pronounTags?: string[]
}): StudioCompletionInput {
  const locationTrimmed = input.location.trim()
  const locationLabel = locationTrimmed === 'Unknown' ? '' : locationTrimmed

  return {
    displayName: input.displayName,
    bio: input.bio ?? '',
    locationLabel,
    hasPhoto: (input.photoCount ?? 0) > 0 || Boolean(input.photoUrl?.trim()),
    roles: input.roles,
    lifestyleActivity: input.lifestyleActivity?.trim() ?? '',
    lookingFor: input.lookingFor,
    kinksCount: input.kinksCount,
    linksCount: input.linksCount ?? 0,
    relationshipsCount: input.relationshipsCount ?? 0,
    pronounTags: input.pronounTags ?? [],
  }
}
