/** Full-width Conventions discover page owns its own left nav (hide duplicate CommunityNavBar). */
export function isConventionsDiscoverPresentation(pathname: string): boolean {
  return pathname === '/conventions'
}

export function hideCommunityNavForConventionsDiscover(pathname: string): boolean {
  return isConventionsDiscoverPresentation(pathname)
}
