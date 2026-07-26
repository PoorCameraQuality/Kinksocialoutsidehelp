/**
 * Routes that do not need a login when VITE_AUTH_ALLOW_FALLBACK is false.
 * This is auth public, not SEO indexability.
 * Indexable paths are in seo-policy.ts (KINK_SOCIAL_PUBLIC_SITEMAP_PATHS).
 * Keep in sync with API auth middleware.
 */
const PUBLIC_EXACT = new Set([
  '/',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/guidelines',
  '/accessibility',
  '/support',
])

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return false
}
