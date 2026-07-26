import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'
import { isAppHomeMainNavActive } from '@/lib/app-home-nav'
import { navLinkIsActive } from '@/lib/nav-link-active'

/** Personal left-rail link active state (My Kink Social - not global top nav). */
export function isHomeLeftRailLinkActive(href: string, pathname: string, search: string): boolean {
  if (href.startsWith('/home')) {
    return isAppHomeMainNavActive(href, pathname, search)
  }
  if (href.includes('mine=registrations') || href.includes('rsvp=1')) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    return pathname === '/events' && (params.get('mine') === 'registrations' || params.get('rsvp') === '1')
  }
  if (href === PEOPLE_DIRECTORY_PATH) {
    return pathname === PEOPLE_DIRECTORY_PATH || pathname.startsWith(`${PEOPLE_DIRECTORY_PATH}/`)
  }
  if (href === '/my-posts') {
    return pathname === '/my-posts' || pathname.startsWith('/my-posts/')
  }
  return navLinkIsActive(pathname, href)
}

export function isHomeLeftRailHomeActive(pathname: string, search: string): boolean {
  if (pathname !== '/home' && pathname !== '/feed' && pathname !== '/') return false
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const mode = params.get('mode') ?? 'discover'
  if (mode === 'following') return false
  const tab = params.get('tab') ?? 'Local'
  return tab === 'Local'
}
