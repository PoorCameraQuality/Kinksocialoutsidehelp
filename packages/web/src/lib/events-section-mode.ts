export type EventsSectionMode =
  | 'discover'
  | 'past-public'
  | 'registrations'
  | 'hosted'
  | 'saved'
  | 'past-attended'

export type EventsSectionNavMatch =
  | 'discover'
  | 'past-public'
  | 'registrations'
  | 'hosted'
  | 'saved'
  | 'past-attended'

const PERSONAL_MODES: ReadonlySet<EventsSectionMode> = new Set([
  'registrations',
  'hosted',
  'saved',
  'past-attended',
])

export function parseEventsSectionMode(params: URLSearchParams): EventsSectionMode {
  const mine = params.get('mine')
  if (mine === 'registrations' || params.get('rsvp') === '1') return 'registrations'
  if (mine === 'saved') return 'saved'
  if (mine === 'past-attended') return 'past-attended'
  if (params.get('host') === 'me') return 'hosted'
  if (params.get('view') === 'past') return 'past-public'
  return 'discover'
}

export function resolveEventsSectionNavMatch(pathname: string, search: string): EventsSectionNavMatch {
  if (pathname !== '/events') return 'discover'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.get('view') === 'past') return 'past-public'
  if (params.get('mine') === 'registrations' || params.get('rsvp') === '1') return 'registrations'
  if (params.get('host') === 'me') return 'hosted'
  if (params.get('mine') === 'saved') return 'saved'
  if (params.get('mine') === 'past-attended') return 'past-attended'
  return 'discover'
}

export function isPersonalEventsMode(mode: EventsSectionMode): boolean {
  return PERSONAL_MODES.has(mode)
}

export function isDiscoveryEventsMode(mode: EventsSectionMode): boolean {
  return mode === 'discover' || mode === 'past-public'
}
