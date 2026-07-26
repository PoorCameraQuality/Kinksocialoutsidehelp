export type GroupsSectionMode = 'discover' | 'my' | 'invitations' | 'posts' | 'saved'

export type GroupsSectionNavMatch = GroupsSectionMode

const PERSONAL_MODES: ReadonlySet<GroupsSectionMode> = new Set([
  'my',
  'invitations',
  'posts',
  'saved',
])

export function parseGroupsSectionMode(params: URLSearchParams): GroupsSectionMode {
  const tab = params.get('tab')
  if (tab === 'my') return 'my'
  if (tab === 'invitations') return 'invitations'
  if (tab === 'posts') return 'posts'
  if (tab === 'saved' || tab === 'saved-groups') return 'saved'
  return 'discover'
}

export function resolveGroupsSectionNavMatch(pathname: string, search: string): GroupsSectionNavMatch {
  if (pathname !== '/groups') return 'discover'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return parseGroupsSectionMode(params)
}

export function isPersonalGroupsMode(mode: GroupsSectionMode): boolean {
  return PERSONAL_MODES.has(mode)
}

export function isDiscoveryGroupsMode(mode: GroupsSectionMode): boolean {
  return mode === 'discover'
}
