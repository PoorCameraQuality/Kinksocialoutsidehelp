/** Routes reachable without a real session (login wall). */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/join',
  '/terms',
  '/privacy',
  '/guidelines',
  '/dmca',
  '/ncii',
  '/minor-safety',
  '/law-enforcement',
  '/adult-content-consent',
  '/vendor-organizer-terms',
  '/about',
  '/support',
  '/contact',
  '/security',
  '/community',
  '/verify-email',
])

const PUBLIC_PREFIXES = [
  '/forgot-password',
  '/reset-password',
  '/email/unsubscribe',
  '/email/confirm',
  '/verify-email',
  '/policies',
] as const

/** Guest dancecard compare/reserve links — no KS account required. */
function isDancecardSharePath(pathname: string): boolean {
  // /play/:slug/s/:token
  if (/^\/play\/[^/]+\/s\/[^/]+$/.test(pathname)) return true
  // /conventions/:slug/dancecard/s/:token
  if (/^\/conventions\/[^/]+\/dancecard\/s\/[^/]+$/.test(pathname)) return true
  return false
}

/** Reserved /play/* segments that are app routes, not space slugs. */
const PLAY_RESERVED_SEGMENTS = new Set(['schedule'])

/**
 * Play Spaces browse surfaces — join/create still soft-gate in-page.
 * Nested manage/schedule/reservations stay auth-gated.
 */
function isPublicPlayBrowsePath(pathname: string): boolean {
  if (pathname === '/play') return true
  const m = pathname.match(/^\/play\/([^/]+)$/)
  if (!m) return false
  if (PLAY_RESERVED_SEGMENTS.has(m[1])) return false
  return true
}

export function isPublicWebPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  if (isPublicPlayBrowsePath(pathname)) return true
  if (isDancecardSharePath(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
