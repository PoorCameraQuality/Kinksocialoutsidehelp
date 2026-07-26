/** Organizations directory - hide duplicate CommunityNavBar on list page. */

export function hideCommunityNavForOrgsDiscover(pathname: string): boolean {
  return pathname === '/orgs'
}
