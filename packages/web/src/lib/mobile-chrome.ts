/** Routes where the member bottom nav should not appear (focused flows). */
export function suppressMobileBottomNav(pathname: string, search?: URLSearchParams | null): boolean {
  if (pathname.startsWith('/onboarding')) return true
  if (pathname.startsWith('/verify-email')) return true
  if (pathname.startsWith('/profile/edit')) return true
  if (pathname.endsWith('/door')) return true
  if (
    (pathname === '/messaging' || pathname.startsWith('/messaging/')) &&
    Boolean(search?.get('c')?.trim())
  ) {
    return true
  }
  return false
}

/** Event (and similar) pages with a fixed MobileActionBar above bottom nav. */
export function hasMobileStickyActionBar(pathname: string): boolean {
  if (pathname.startsWith('/conventions/') && pathname.split('/').filter(Boolean).length === 2) {
    return true
  }
  if (!pathname.startsWith('/events/')) return false
  if (pathname === '/events/create' || pathname.startsWith('/events/create/')) return false
  return true
}

/** Hide mobile FAB where a route supplies its own sticky bottom actions. */
export function suppressMobileCreateFab(pathname: string): boolean {
  if (pathname.startsWith('/profile/edit')) return true
  if (hasMobileStickyActionBar(pathname)) return true
  return false
}

/** Main `#main-content` padding class for mobile bottom clearance. */
export function mobileMainPadClass(pathname: string, showCreateFab: boolean, search?: URLSearchParams | null): string {
  if (pathname.endsWith('/door')) return 'pb-0'
  if (
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/profile/edit')
  ) {
    return 'c2k-onboarding-no-bottom-nav'
  }
  if (
    (pathname === '/messaging' || pathname.startsWith('/messaging/')) &&
    Boolean(search?.get('c')?.trim())
  ) {
    return 'pb-0'
  }
  if (hasMobileStickyActionBar(pathname)) {
    return 'c2k-main-mobile-pb-action'
  }
  return showCreateFab ? 'c2k-main-mobile-pb' : 'c2k-mobile-nav-pb'
}
