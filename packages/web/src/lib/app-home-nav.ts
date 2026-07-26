import { EXPLORE_DASHBOARD_PATH, PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'
import { isPeopleDirectoryNavActive } from '@/lib/community-nav'

/** Active state for logged-in desktop main nav (home dashboard shell). */
export function isAppHomeMainNavActive(
  href: string,
  pathname: string,
  search: string,
): boolean {
  const target = new URL(href, 'http://local')
  const targetPath = target.pathname
  const targetParams = target.searchParams

  if (targetPath === '/home' || targetPath === '/feed') {
    if (pathname !== '/home' && pathname !== '/feed' && pathname !== '/') return false
    const mode = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('mode') ?? 'discover'
    const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab') ?? 'Local'
    const wantMode = targetParams.get('mode') ?? 'discover'
    const wantTab = targetParams.get('tab') ?? 'Local'
    if (wantTab === 'Local' && !targetParams.has('tab') && wantMode === 'discover') {
      return mode === 'discover' && tab === 'Local'
    }
    return mode === wantMode && tab === wantTab
  }

  if (targetPath === PEOPLE_DIRECTORY_PATH || targetPath === '/discovery') {
    return isPeopleDirectoryNavActive(pathname)
  }

  if (targetPath === EXPLORE_DASHBOARD_PATH) {
    return pathname === EXPLORE_DASHBOARD_PATH
  }

  if (pathname === targetPath || pathname.startsWith(`${targetPath}/`)) {
    return true
  }
  return false
}
