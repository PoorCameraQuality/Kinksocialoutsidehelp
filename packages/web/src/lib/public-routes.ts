/** Routes reachable without a real session (login wall). */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
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
])

const PUBLIC_PREFIXES = [
  '/forgot-password',
  '/reset-password',
  '/email/unsubscribe',
  '/email/confirm',
  '/policies',
] as const

export function isPublicWebPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
