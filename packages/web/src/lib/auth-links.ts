import { safeInternalPath } from '@c2k/shared'
import { isDancecardHost, isDancecardStayPath } from '@/lib/dancecard-host'

/** Default destination after login/signup/onboarding for the current host. */
export function defaultPostAuthPath(): string {
  return isDancecardHost() ? '/play' : '/home'
}

/**
 * Normalize a post-auth redirect for the current host.
 * On dancecard.*, keep stay-paths; coerce bare community dumps (`/home`, `/explore`)
 * to `/play` so we never hard-bounce through ApexRedirect after sign-in.
 * Explicit community deep-links (e.g. `/events/123`) are kept and leave once.
 */
export function coercePostAuthPath(redirectPath?: string | null): string {
  const safe = safeInternalPath(redirectPath ?? undefined) ?? defaultPostAuthPath()
  if (!isDancecardHost()) return safe
  const pathOnly = safe.split(/[?#]/)[0] || '/'
  const search = safe.includes('?') ? `?${safe.split('?')[1]!.split('#')[0]}` : ''
  if (isDancecardStayPath(pathOnly, search)) return safe
  if (pathOnly === '/home' || pathOnly === '/explore' || pathOnly === '/') return '/play'
  return safe
}

/** Canonical sign-in URL with optional post-login redirect. */
export function buildLoginHref(redirectPath?: string | null): string {
  const safe = safeInternalPath(redirectPath ?? undefined)
  if (safe) {
    return `/login?redirect=${encodeURIComponent(safe)}`
  }
  return '/login'
}

/** Canonical sign-up URL (login route, signup tab). */
export function buildSignupHref(redirectPath?: string | null): string {
  const base = buildLoginHref(redirectPath)
  return base.includes('?') ? `${base}&signup=1` : `${base}?signup=1`
}

/** Map legacy `?next=` / `?login=1` landing queries onto the `/login` route search. */
export function loginRedirectSearchParams(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const legacyNext = params.get('next')
  if (legacyNext && !params.get('redirect')) {
    const safe = safeInternalPath(legacyNext)
    if (safe) params.set('redirect', safe)
  }
  params.delete('next')
  params.delete('login')
  const out = params.toString()
  return out ? `?${out}` : ''
}

/** Full `/login…` href from a landing-style search string (legacy bookmarks). */
export function buildLoginHrefFromLegacySearch(search: string): string {
  const qs = loginRedirectSearchParams(search)
  return qs ? `/login${qs}` : '/login'
}
