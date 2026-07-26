/** Full-width Events discover page owns its own left nav (hide duplicate CommunityNavBar). */
export function isEventsDiscoverPresentation(pathname: string, search: string): boolean {
  if (pathname !== '/events') return false
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return !params.get('groupId')
}

export function hideCommunityNavForEventsDiscover(pathname: string, search: string): boolean {
  return isEventsDiscoverPresentation(pathname, search)
}
