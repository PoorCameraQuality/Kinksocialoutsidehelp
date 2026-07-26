import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import type {
  ProfileStoryActivityItem,
  ProfileStoryHighlight,
  ProfileStoryInput,
} from './types'

const DEFAULT_TAGLINE =
  'Here to meet people, attend events, and build community.'

export function deriveRoleHeadline(input: {
  roles: string[]
  ecosystem: UserEcosystemPayload | null
  lifestyleActivity?: string | null
}): string {
  const parts: string[] = []
  if (input.roles[0]) parts.push(input.roles[0])
  if (input.lifestyleActivity?.trim()) parts.push(input.lifestyleActivity.trim())
  const orgRole = input.ecosystem?.orgs.find((o) =>
    /organizer|host|admin/i.test(o.role),
  )
  if (orgRole) parts.push('Organizer')
  else if (input.ecosystem?.presenter?.headline) {
    const h = input.ecosystem.presenter.headline.trim()
    if (h && !parts.includes(h)) parts.push(h)
  }
  return parts.slice(0, 3).join(' · ')
}

export function deriveProfileTagline(bio: string | null | undefined): string {
  const trimmed = bio?.trim()
  if (!trimmed) return DEFAULT_TAGLINE
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim()
  if (firstSentence && firstSentence.length <= 160) return firstSentence
  if (trimmed.length <= 160) return trimmed
  return `${trimmed.slice(0, 157).trim()}…`
}

export function deriveRegionLabel(location: string | null | undefined): string | null {
  if (!location?.trim() || location === 'Unknown') return null
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 1]
  return location.trim()
}

export function deriveHighlights(input: ProfileStoryInput): ProfileStoryHighlight[] {
  const items: ProfileStoryHighlight[] = []
  const upcoming = input.ecosystem?.upcomingEvents.length ?? 0
  if (upcoming > 0) {
    items.push({
      id: 'events',
      icon: 'calendar',
      label: upcoming === 1 ? 'Hosting 1 Upcoming Event' : `Hosting ${upcoming} Upcoming Events`,
    })
  }
  if (input.lifestyleActivity?.trim()) {
    items.push({ id: 'lifestyle', icon: 'star', label: input.lifestyleActivity.trim() })
  }
  const primaryOrg = input.ecosystem?.orgs[0]
  if (primaryOrg) {
    items.push({
      id: `org-${primaryOrg.slug}`,
      icon: 'building',
      label: `${primaryOrg.role} at ${primaryOrg.displayName}`,
    })
  }
  const region = deriveRegionLabel(input.location)
  if (region) items.push({ id: 'region', icon: 'map', label: `${region} Region` })
  if (input.ecosystem?.groups.length) {
    items.push({
      id: 'groups',
      icon: 'users',
      label: `${input.ecosystem.groups.length} Group${input.ecosystem.groups.length === 1 ? '' : 's'}`,
    })
  }
  return items.slice(0, 5)
}

export function deriveActivityTimeline(
  ecosystem: UserEcosystemPayload | null,
  references: { createdAt: string; referrerUsername: string }[],
): ProfileStoryActivityItem[] {
  const items: ProfileStoryActivityItem[] = []
  for (const e of ecosystem?.upcomingEvents.slice(0, 2) ?? []) {
    items.push({
      id: `event-${e.id}`,
      icon: 'calendar',
      title: 'Hosting an event',
      subtitle: e.title,
      when: formatRelativeOrDate(e.startsAt),
      href: `/events/${encodeURIComponent(e.id)}`,
    })
  }
  for (const g of ecosystem?.groups.slice(0, 2) ?? []) {
    items.push({
      id: `group-${g.id}`,
      icon: 'users',
      title: 'Joined group',
      subtitle: g.name,
      href: `/groups/${encodeURIComponent(g.id)}`,
    })
  }
  for (const o of ecosystem?.orgs.slice(0, 1) ?? []) {
    items.push({
      id: `org-${o.slug}`,
      icon: 'building',
      title: 'Organization role',
      subtitle: `${o.role} at ${o.displayName}`,
      href: `/orgs/${encodeURIComponent(o.slug)}`,
    })
  }
  for (const ref of references.slice(0, 1)) {
    items.push({
      id: `ref-${ref.createdAt}`,
      icon: 'star',
      title: 'Received a reference',
      subtitle: `From @${ref.referrerUsername}`,
      when: formatRelativeOrDate(ref.createdAt),
    })
  }
  return items.slice(0, 6)
}

export function derivePersonalityParagraph(input: {
  bio: string | null
  lifestyleActivity?: string | null
  kinks: { note: string | null; displayName: string }[]
  presenterHeadline?: string | null
}): string | null {
  const bio = input.bio?.trim()
  if (bio && bio.length > 120) {
    const sentences = bio.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (sentences.length >= 2) return sentences.slice(1).join(' ').trim()
    return bio
  }
  const kinkNotes = input.kinks
    .map((k) => k.note?.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (kinkNotes.length) return kinkNotes.join(' ')
  if (input.presenterHeadline?.trim()) return input.presenterHeadline.trim()
  if (input.lifestyleActivity?.trim()) {
    return `Active in the community as ${input.lifestyleActivity.trim().toLowerCase()}.`
  }
  return null
}

function formatRelativeOrDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
