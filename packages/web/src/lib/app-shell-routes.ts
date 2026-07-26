/** Tier A routes migrated into the mobile AppShell (Pass 1). */
const TIER_A_ROOTS = ['/home', '/explore', '/events', '/messaging', '/profile'] as const

export function isTierAAppShellRoute(pathname: string): boolean {
  if (pathname.startsWith('/profile/edit')) return false
  return TIER_A_ROOTS.some(
    (root) => pathname === root || (root === '/profile' && pathname.startsWith('/profile/')),
  )
}

/** Mobile create FAB surfaces (Tier A + feed-adjacent). Hidden on Messages — use inbox CTAs instead. */
export function showCreateFabForPath(pathname: string): boolean {
  if (!isTierAAppShellRoute(pathname)) return false
  if (pathname.startsWith('/profile/edit')) return false
  if (pathname === '/messaging' || pathname.startsWith('/messaging/')) return false
  return true
}
