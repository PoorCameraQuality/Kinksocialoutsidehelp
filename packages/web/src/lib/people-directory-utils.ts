import type { BadgeId, MockPerson } from '@/data/types'

import type { CommunityRoleFilterId } from '@/lib/people-search-constants'
import type { FindPeopleFilterDraft } from '@/components/find-people/FindPeopleFiltersPanel'



const COMMUNITY_ROLE_MATCH: Record<

  CommunityRoleFilterId,

  { roles?: string[]; badges?: BadgeId[] }

> = {

  organizer: { roles: ['Organizer', 'Host'] },

  presenter: { roles: ['Educator', 'Mentor', 'Facilitator'] },

  vendor: { badges: ['vendor_verified'], roles: ['Vendor'] },

  volunteer: { roles: ['Volunteer'] },

  moderator: { roles: ['Moderator'] },

}



export type PersonCommunityBadge = {

  id: string

  label: string

  tone: 'gold' | 'green' | 'blue' | 'purple' | 'orange'

}



export function personMatchesCommunityRoleFilter(person: MockPerson, filterId: CommunityRoleFilterId): boolean {

  const spec = COMMUNITY_ROLE_MATCH[filterId]

  const roles = person.roles ?? []

  if (spec.roles?.some((r) => roles.some((pr) => pr.toLowerCase() === r.toLowerCase()))) return true

  if (spec.badges?.some((b) => person.badges?.includes(b))) return true

  // Published vendor shop (from vendor_profiles), not only a self-tagged profile role.
  if (filterId === 'vendor' && person.vendorShopSlug) return true

  return false

}



export function filterPeopleByCommunityRoles(people: MockPerson[], filterIds: CommunityRoleFilterId[]): MockPerson[] {

  if (!filterIds.length) return people

  return people.filter((p) => filterIds.every((id) => personMatchesCommunityRoleFilter(p, id)))

}



export function getPersonCommunityBadges(person: MockPerson): PersonCommunityBadge[] {

  const roles = person.roles ?? []

  const badges: PersonCommunityBadge[] = []

  if (person.badges?.includes('event_verified')) {

    badges.push({ id: 'event_verified', label: 'Event verified', tone: 'gold' })

  }

  if (roles.some((r) => /organizer|host/i.test(r))) {

    badges.push({ id: 'organizer', label: 'Organizer', tone: 'green' })

  }

  if (roles.some((r) => /educator|mentor|facilitator/i.test(r))) {

    badges.push({ id: 'presenter', label: 'Presenter', tone: 'blue' })

  }

  if (
    person.badges?.includes('vendor_verified') ||
    Boolean(person.vendorShopSlug) ||
    roles.some((r) => /vendor/i.test(r))
  ) {

    badges.push({ id: 'vendor', label: 'Vendor', tone: 'purple' })

  }

  if (roles.some((r) => /volunteer/i.test(r))) {

    badges.push({ id: 'volunteer', label: 'Volunteer', tone: 'green' })

  }

  if (roles.some((r) => /moderator/i.test(r))) {

    badges.push({ id: 'moderator', label: 'Moderator', tone: 'orange' })

  }

  if ((person.groupsLedCount ?? 0) > 0) {

    badges.push({ id: 'group_leader', label: 'Group leader', tone: 'green' })

  }

  if (person.badges?.includes('education_completed') || person.badges?.includes('community_contributor')) {

    badges.push({ id: 'education', label: 'Education contributor', tone: 'blue' })

  }

  return badges

}



export type PersonDirectoryStat = { key: string; label: string; value: number }



/** Compact activity counts for people directory cards. */
export function getPersonDirectoryStats(person: MockPerson): PersonDirectoryStat[] {
  const photos =
    person.photoCount ??
    person.profilePhotos?.length ??
    (person.avatarUrl?.trim() ? 1 : 0)
  const writings = person.writingCount ?? person.publishedArticlesCount ?? 0
  const videos = person.videoCount ?? 0
  const stats: PersonDirectoryStat[] = []
  if (photos > 0) stats.push({ key: 'photos', label: 'Photos', value: photos })
  if (writings > 0) stats.push({ key: 'writings', label: 'Writings', value: writings })
  if (videos > 0) stats.push({ key: 'videos', label: 'Videos', value: videos })
  return stats
}



export function getPersonHeadlineRole(person: MockPerson): string | null {

  const roles = person.roles ?? []

  const community = roles.find((r) =>

    /organizer|host|educator|mentor|facilitator|vendor/i.test(r),

  )

  return community ?? null

}



/**
 * One short, privacy-safe "why you're seeing this" line per card.
 *
 * Returns at most a single reason, prioritized strongest-signal first. Only uses
 * counts already present in the page's data flow (co-attendance / mutual graph /
 * public contribution counts). Never exposes hidden groups, private RSVPs, or
 * presence — all inputs are either mutual-with-viewer or public profile facts.
 */
export function formatPersonContextLine(person: MockPerson): string | null {

  const mutualGroups = person.mutualGroupsCount ?? 0

  const shared = person.sharedEventsCount ?? 0

  const mutual = person.mutualCount ?? 0

  const hosted = person.hostedEventsCount ?? 0

  const articles = person.publishedArticlesCount ?? 0

  if (mutualGroups > 0) return mutualGroups === 1 ? 'Shared group' : `${mutualGroups} shared groups`

  if (shared > 0) return shared === 1 ? 'Shared event' : `${shared} shared events`

  if (mutual > 0) return mutual === 1 ? '1 mutual connection' : `${mutual} mutual connections`

  if (hosted > 0) return 'Hosts community events'

  if (articles > 0) return 'Education contributor'

  return null

}

/** @deprecated Use formatPersonContextLine — kept for any legacy imports. */
export function formatPersonContextLines(person: MockPerson): string[] {

  const line = formatPersonContextLine(person)

  return line ? [line] : []

}



export function trustStepIndex(value: number): number {

  const steps = [0, 25, 50, 75]

  let idx = 0

  for (let i = 0; i < steps.length; i++) {

    if (value >= steps[i]) idx = i

  }

  return idx

}



export function trustValueFromStepIndex(index: number): number {

  const steps = [0, 25, 50, 75] as const

  return steps[Math.max(0, Math.min(index, steps.length - 1))] ?? 0

}

/** Preflight / automation accounts — hide from directory display only. */
export function isAuditDemoUsername(username: string): boolean {
  return /^audit[a-z0-9]+$/i.test(username.trim())
}

export function countPeopleActiveFilters(d: FindPeopleFilterDraft): number {
  let n = 0
  if (d.distance !== 50) n++
  if (d.country.trim()) n++
  if (d.city.trim()) n++
  if (d.peopleGender.trim()) n++
  n += d.communityRoles.length
  n += d.interestRoles.length
  if (d.experienceLevel !== 'any') n++
  if (d.verifiedOnly) n++
  if (d.eventActiveOnly) n++
  return n
}


