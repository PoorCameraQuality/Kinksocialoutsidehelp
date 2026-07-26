/** Header search vs page-scoped search - UI-DISC-2 route policy. */

const SCOPED_SEARCH_PREFIXES = ['/events', '/groups', '/conventions', '/education', '/people'] as const

/** Hide header global search when the page owns scoped list search. */
export function hideHeaderSearchForPath(pathname: string): boolean {
  return SCOPED_SEARCH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
