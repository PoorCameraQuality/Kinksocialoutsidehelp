import { safeInternalPath } from '@c2k/shared'

/** Canonical sign-in URL on the landing page with optional post-login redirect. */
export function buildLoginHref(redirectPath?: string | null): string {
  const safe = safeInternalPath(redirectPath ?? undefined)
  if (safe) {
    return `/?login=1&redirect=${encodeURIComponent(safe)}`
  }
  return '/?login=1'
}

/** Map legacy `?next=` query to `redirect` for login alias route. */
export function loginRedirectSearchParams(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const legacyNext = params.get('next')
  if (legacyNext && !params.get('redirect')) {
    const safe = safeInternalPath(legacyNext)
    if (safe) params.set('redirect', safe)
    params.delete('next')
  }
  if (!params.has('login')) params.set('login', '1')
  const out = params.toString()
  return out ? `?${out}` : '?login=1'
}
