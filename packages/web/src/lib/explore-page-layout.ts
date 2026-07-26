import { EXPLORE_DASHBOARD_PATH, PEOPLE_DIRECTORY_PATH, LEGACY_DISCOVERY_PATH } from '@/lib/app-routes'

const PEOPLE_DIRECTORY_ALIASES = [PEOPLE_DIRECTORY_PATH, LEGACY_DISCOVERY_PATH, '/explore/people'] as const

export function isPeopleDirectoryPresentation(pathname: string): boolean {
  return (PEOPLE_DIRECTORY_ALIASES as readonly string[]).includes(pathname)
}

/** @deprecated Use isPeopleDirectoryPresentation */
export const EXPLORE_FIND_PEOPLE_PATH = PEOPLE_DIRECTORY_PATH
export const isExploreFindPeoplePresentation = isPeopleDirectoryPresentation

export function hideCommunityNavForPeopleDirectory(pathname: string): boolean {
  return isPeopleDirectoryPresentation(pathname)
}

export function hideCommunityNavForExploreDashboard(pathname: string): boolean {
  return pathname === EXPLORE_DASHBOARD_PATH
}

/** Legacy name - people directory + explore dashboard hide duplicate community nav. */
export function hideCommunityNavForExploreDiscover(pathname: string, _search = ''): boolean {
  return hideCommunityNavForPeopleDirectory(pathname) || hideCommunityNavForExploreDashboard(pathname)
}
