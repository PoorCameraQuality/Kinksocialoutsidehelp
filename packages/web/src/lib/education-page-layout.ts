/** Full-width Education discover page owns its own left nav (hide duplicate CommunityNavBar). */

export function isEducationDiscoverPresentation(pathname: string): boolean {
  return pathname === '/education'
}

export function hideCommunityNavForEducationDiscover(pathname: string): boolean {
  return isEducationDiscoverPresentation(pathname)
}

/** Inline explore sub-nav replaces CommunityNavBar on full-width discover pages. */
export function showEducationSubNav(pathname: string): boolean {
  return hideCommunityNavForEducationDiscover(pathname)
}
