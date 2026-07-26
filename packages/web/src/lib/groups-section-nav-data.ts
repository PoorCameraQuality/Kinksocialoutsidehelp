import type { GroupsSectionNavMatch } from './groups-section-mode.ts'

export const GROUPS_SECTION_NAV: ReadonlyArray<{
  href: string
  label: string
  match: GroupsSectionNavMatch
}> = [
  { href: '/groups', label: 'Discover Groups', match: 'discover' },
  { href: '/groups?tab=my', label: 'My Groups', match: 'my' },
  { href: '/groups?tab=invitations', label: 'Invitations', match: 'invitations' },
  { href: '/groups?tab=posts', label: 'My Group Posts', match: 'posts' },
  { href: '/groups?tab=saved', label: 'Saved Groups', match: 'saved' },
]
