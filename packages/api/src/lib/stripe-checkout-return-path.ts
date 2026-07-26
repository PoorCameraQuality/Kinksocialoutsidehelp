import { publicWebBaseUrl } from './stripe.js'

const ALLOWED_PREFIXES = ['/conventions/', '/events/', '/orgs/', '/vendors/', '/settings/', '/organizer/']

/**
 * Sanitize client-supplied Checkout success/cancel paths.
 * Reject protocol-relative URLs, backslashes, and off-origin results.
 */
export function safeCheckoutReturnPath(path: string | undefined, fallback: string): string {
  if (!path || typeof path !== 'string') return fallback
  const trimmed = path.trim()
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    trimmed.includes('@') ||
    /\s/.test(trimmed) ||
    trimmed.includes('://')
  ) {
    return fallback
  }
  if (!ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p))) {
    return fallback
  }
  try {
    const base = publicWebBaseUrl()
    const resolved = new URL(trimmed, base.endsWith('/') ? base : `${base}/`)
    const baseOrigin = new URL(base).origin
    if (resolved.origin !== baseOrigin) return fallback
    return `${resolved.pathname}${resolved.search}`
  } catch {
    return fallback
  }
}
