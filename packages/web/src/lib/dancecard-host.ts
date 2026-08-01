import {
  applyAppearanceVarsToElement,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

/** True when the page is served from the Dancecard product subdomain. */
export function isDancecardHost(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  const h = hostname.toLowerCase()
  return h === 'dancecard.kink.social' || h.startsWith('dancecard.')
}

/** Play Spaces routes — use Dancecard chrome even on apex/localhost for preview. */
export function isPlayPath(pathname: string): boolean {
  return pathname === '/play' || pathname.startsWith('/play/')
}

export function isMessagingPath(pathname: string): boolean {
  return pathname === '/messaging' || pathname.startsWith('/messaging/')
}

export function isProfilePath(pathname: string): boolean {
  return pathname === '/profile' || pathname.startsWith('/profile/')
}

/** Me shell on Dancecard (not public /profile/:username pages). */
export function isDancecardMePath(pathname: string): boolean {
  return (
    pathname === '/profile' ||
    pathname.startsWith('/profile/edit') ||
    pathname === '/profile/complete' ||
    pathname.startsWith('/profile/complete/')
  )
}

/** True when URL search is the landing login focus (`?login=1`). */
export function isDancecardLoginLandingSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const login = params.get('login')
  return login === '1' || login === 'true'
}

/**
 * Public member ISO card on Dancecard (`/profile/:username?tab=ISO`).
 * Keeps board → full ISO deep links on the product host instead of bouncing to apex.
 */
export function isDancecardPublicIsoPath(pathname: string, search = ''): boolean {
  if (!pathname.startsWith('/profile/')) return false
  if (isDancecardMePath(pathname)) return false
  const segment = pathname.slice('/profile/'.length).split('/')[0] ?? ''
  if (!segment || segment === 'edit' || segment === 'complete') return false
  const raw = search.startsWith('?') ? search.slice(1) : search
  const tab = (new URLSearchParams(raw).get('tab') || '').toLowerCase()
  return tab === 'iso'
}

/**
 * Routes that stay on dancecard.* with wine chrome.
 * Everything else should hard-navigate to the apex community site.
 * @param search optional query string (`?tab=ISO` or `tab=ISO`) for ISO profile stay.
 */
export function isDancecardStayPath(pathname: string, search = ''): boolean {
  if (pathname === '/' || isPlayPath(pathname)) return true
  if (isMessagingPath(pathname)) return true
  if (isDancecardMePath(pathname)) return true
  if (isDancecardPublicIsoPath(pathname, search)) return true
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname === '/forgot-password' || pathname === '/reset-password') return true
  if (pathname === '/verify-email' || pathname.startsWith('/verify-email')) return true
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true
  if (pathname.startsWith('/email/')) return true
  if (pathname === '/adult-content-consent') return true
  return false
}

/**
 * Dancecard product surface: real subdomain stay-paths, or any `/play/*` path on apex (local preview).
 * Bottom nav Schedule/Spaces and related chrome follow this.
 */
export function isDancecardProductSurface(
  pathname: string,
  hostname?: string,
  search = '',
): boolean {
  if (isDancecardHost(hostname)) return isDancecardStayPath(pathname, search)
  return isPlayPath(pathname)
}

const DANCECARD_SESSION_CHROME_KEY = 'c2k-dancecard-product-chrome'

/** Remember a Dancecard browsing session so Messages/Me keep the wine palette on apex preview. */
export function markDancecardProductChrome(active: boolean): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (active) sessionStorage.setItem(DANCECARD_SESSION_CHROME_KEY, '1')
    else sessionStorage.removeItem(DANCECARD_SESSION_CHROME_KEY)
  } catch {
    /* private mode */
  }
}

export function hasDancecardProductChrome(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(DANCECARD_SESSION_CHROME_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Force Dancecard product appearance (Black Velvet) for Play / Chat / Me
 * (subdomain stay-paths, /play on apex, or sticky Messages/Me on apex preview).
 */
export function shouldForcePlaySurfaceAppearance(
  pathname: string,
  search = typeof window !== 'undefined' ? window.location.search : '',
): boolean {
  if (typeof window !== 'undefined' && isDancecardHost()) {
    return isDancecardStayPath(pathname, search)
  }
  if (isPlayPath(pathname)) {
    markDancecardProductChrome(true)
    return true
  }
  if (hasDancecardProductChrome() && (isMessagingPath(pathname) || isDancecardMePath(pathname))) {
    return true
  }
  // Left the product surface on apex — drop sticky product chrome
  if (
    hasDancecardProductChrome() &&
    !isPlayPath(pathname) &&
    !isMessagingPath(pathname) &&
    !isDancecardMePath(pathname)
  ) {
    markDancecardProductChrome(false)
  }
  return false
}

/** @deprecated Use shouldForcePlaySurfaceAppearance */
export const shouldForceVelvetRose = shouldForcePlaySurfaceAppearance

/** Apex community origin for “leave Dancecard → feed/explore” links. */
export function apexSiteOrigin(): string {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !/dancecard\./i.test(fromEnv)) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname.startsWith('dancecard.')) {
      return `${protocol}//${hostname.slice('dancecard.'.length)}`
    }
  }
  return 'https://kink.social'
}

/** Absolute apex URL for a path (and optional query/hash). */
export function apexSiteHref(path = '/'): string {
  const raw = path.startsWith('/') ? path : `/${path}`
  return `${apexSiteOrigin()}${raw}`
}

/** Public Dancecard product origin (subdomain in production). */
export function dancecardPublicOrigin(): string {
  const fromEnv = (import.meta.env.VITE_DANCECARD_PUBLIC_WEB_URL as string | undefined)?.replace(
    /\/$/,
    '',
  )
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname.startsWith('dancecard.')) return `${protocol}//${hostname}`
    if (hostname === 'kink.social' || hostname === 'www.kink.social') {
      return `${protocol}//dancecard.kink.social`
    }
  }
  return 'https://dancecard.kink.social'
}

/**
 * Main-site entry to Dancecard. Uses the product subdomain on kink.social;
 * stays on `/play` for local preview and when already on dancecard.*.
 */
export function dancecardEntryHref(path = '/play'): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined') {
    if (isDancecardHost()) return p
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return p
    if (
      h !== 'kink.social' &&
      h !== 'www.kink.social' &&
      !(import.meta.env.VITE_DANCECARD_PUBLIC_WEB_URL as string | undefined)
    ) {
      return p
    }
  }
  return `${dancecardPublicOrigin()}${p}`
}

/**
 * Resolve a site nav href when the SPA is on dancecard.*:
 * product paths stay; community paths leave for apex.
 */
export function resolveCrossHostNavHref(href: string): string {
  if (isExternalHref(href)) return href
  const pathOnly = href.split(/[?#]/)[0] || '/'
  const suffix = href.slice(pathOnly.length)
  const search = suffix.startsWith('?') ? suffix.split('#')[0]! : ''
  if (pathOnly === '/play' || pathOnly.startsWith('/play/')) {
    if (typeof window !== 'undefined' && isDancecardHost()) return href
    const entry = dancecardEntryHref(pathOnly)
    return isExternalHref(entry) ? `${entry}${suffix}` : href
  }
  if (
    typeof window !== 'undefined' &&
    isDancecardHost() &&
    !isDancecardStayPath(pathOnly, search)
  ) {
    return apexSiteHref(href)
  }
  return href
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

const DANCECARD_OG_PATH = '/og-dancecard.png'
const DANCECARD_OG_ALT = 'Public Dancecard — Schedule your kink fun with ease. kink.social'
const DANCECARD_TITLE = 'Public Dancecard | Kink Social'
const DANCECARD_DESCRIPTION =
  'Schedule your kink fun with ease. Share availability, compare schedules, and reserve scenes.'

function setMeta(attr: 'property' | 'name', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Point the document manifest, theme-color, share meta, and Black Velvet tokens
 * at Dancecard when on that host — before React hydrates.
 */
export function applyDancecardDocumentChrome(): void {
  if (typeof document === 'undefined' || !isDancecardHost()) return

  markDancecardProductChrome(true)

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = '/manifest-dancecard.json'

  const theme = document.querySelector('meta[name="theme-color"]')
  if (theme) theme.setAttribute('content', '#0C0C10')

  const ogImage = `${window.location.origin}${DANCECARD_OG_PATH}`
  setMeta('property', 'og:site_name', 'Dancecard · Kink Social')
  setMeta('property', 'og:title', DANCECARD_TITLE)
  setMeta('property', 'og:description', DANCECARD_DESCRIPTION)
  setMeta('property', 'og:image', ogImage)
  setMeta('property', 'og:image:width', '1024')
  setMeta('property', 'og:image:height', '576')
  setMeta('property', 'og:image:alt', DANCECARD_OG_ALT)
  setMeta('property', 'og:url', `${window.location.origin}/`)
  setMeta('name', 'twitter:title', DANCECARD_TITLE)
  setMeta('name', 'twitter:description', DANCECARD_DESCRIPTION)
  setMeta('name', 'twitter:image', ogImage)
  setMeta('name', 'twitter:image:alt', DANCECARD_OG_ALT)

  const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (apple) apple.href = DANCECARD_OG_PATH

  document.title = document.title.includes('Dancecard') ? document.title : DANCECARD_TITLE

  const path = window.location.pathname
  // Only paint product chrome on stay-paths (community routes bounce to apex).
  if (!isDancecardStayPath(path, window.location.search)) return

  const preset = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const root = document.documentElement
  root.setAttribute('data-dc-appearance', PLAY_SURFACE_APPEARANCE)
  root.dataset.dcTheme = 'event'
  root.style.colorScheme = preset.mode
  applyAppearanceVarsToElement(root, preset.vars)
}
