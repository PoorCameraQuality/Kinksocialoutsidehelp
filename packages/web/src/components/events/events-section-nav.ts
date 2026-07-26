import type { EventsSectionNavMatch } from '@/lib/events-section-mode'

export const EVENTS_SECTION_NAV: ReadonlyArray<{
  href: string
  label: string
  match: EventsSectionNavMatch
}> = [
  { href: '/events', label: 'Discover Events', match: 'discover' },
  { href: '/events?mine=registrations', label: 'My RSVPs & registrations', match: 'registrations' },
  { href: '/events?host=me', label: 'My Hosted Events', match: 'hosted' },
  { href: '/events?mine=saved', label: 'Saved Events', match: 'saved' },
  { href: '/events?mine=past-attended', label: 'Past Attended', match: 'past-attended' },
]
