/**
 * Focused personal utility pages: inbox-style surfaces without browse chrome.
 * Hides secondary global nav (appHomeMainNav) and CommunityNavBar.
 */
const FOCUSED_PREFIXES = [
  '/messaging',
  '/notifications',
  '/connections',
  '/activity',
  '/my-posts',
  '/settings',
  '/saved',
  '/profile/edit',
] as const

export function isFocusedPersonalUtilityPath(pathname: string): boolean {
  return FOCUSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Secondary row: Home, Explore, Events, Groups, … */
export function hideAppHomeMainNavForPath(pathname: string): boolean {
  return isFocusedPersonalUtilityPath(pathname)
}

/** Community nav: Following, Near you, Events, … */
export function hideCommunityNavForFocusedPersonal(pathname: string): boolean {
  return isFocusedPersonalUtilityPath(pathname)
}

/** Reduce dev banner noise on utility pages (still shown on landing / browse). */
export function hideMockDataBannerForPath(pathname: string): boolean {
  return isFocusedPersonalUtilityPath(pathname)
}
