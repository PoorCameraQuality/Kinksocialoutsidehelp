/** Full-width Groups discover page owns its own left nav (hide duplicate CommunityNavBar). */

export function isGroupsDiscoverPresentation(pathname: string): boolean {

  return pathname === '/groups'

}



export function hideCommunityNavForGroupsDiscover(pathname: string): boolean {

  return isGroupsDiscoverPresentation(pathname)

}


