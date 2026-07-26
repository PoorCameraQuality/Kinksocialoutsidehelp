/** True when the home route should use the LinkedIn-style 3-column feed shell. */
export function isHomeFeedPresentation(pathname: string, search: string): boolean {
  if (pathname !== '/home' && pathname !== '/feed') return false
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const mode = params.get('mode')
  const tab = params.get('tab') ?? 'Local'
  if (mode === 'following') return true
  if (tab === 'Local') return true
  if (!params.has('tab') && (mode === 'discover' || !mode)) return true
  return false
}

/** Hide duplicate CommunityNavBar when the feed shell owns navigation. */
export function hideCommunityNavForFeedShell(pathname: string, search: string): boolean {
  return isHomeFeedPresentation(pathname, search)
}
