/** Minimum reviews before showing a public reputation score on the org hub. */
export const ORG_REPUTATION_MIN_REVIEWS = 3

export function formatOrgHubMetadata(input: {
  slug: string
  memberCount: number
  completedEventCount: number
  reviewCount: number
  rating: number
}): string {
  const memberLabel = input.memberCount === 1 ? 'member' : 'members'
  const parts: string[] = [`/${input.slug}`, `${input.memberCount} ${memberLabel}`]

  if (input.completedEventCount > 0) {
    const eventLabel = input.completedEventCount === 1 ? 'event completed' : 'events completed'
    parts.push(`${input.completedEventCount} ${eventLabel}`)
  }

  const showReputation =
    input.reviewCount >= ORG_REPUTATION_MIN_REVIEWS &&
    Number.isFinite(input.rating) &&
    input.rating > 0

  if (showReputation) {
    parts.push(`Reputation ${input.rating.toFixed(1)}/5`)
  } else if (input.reviewCount > 0) {
    parts.push('Reviews building')
  } else {
    parts.push('No public rating yet')
  }

  return parts.join(' · ')
}

export function formatOrgVisibilityLabel(visibility: string): string {
  const v = visibility.toLowerCase()
  if (v === 'public') return 'Public'
  if (v === 'private') return 'Private'
  if (v === 'members_only' || v === 'members-only') return 'Members only'
  return visibility.replace(/_/g, ' ')
}
