import type { FastifyReply, FastifyRequest } from 'fastify'
import { SESSION_COOKIE_NAME } from '@c2k/shared/session-token'
import { corsOriginsFromEnv } from './cors-origins.js'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function allowedOrigins(): string[] {
  return corsOriginsFromEnv()
}

function pathExempt(path: string): boolean {
  // PR 3 (A4): /api/auth/ is intentionally NOT exempt — login CSRF (forced
  // login into an attacker account), forced logout, and password change all
  // require the same Origin/Referer discipline as other mutations.
  if (path.startsWith('/api/health')) return true
  if (path.startsWith('/api/ws')) return true
  // Stripe signed webhooks (no browser Origin).
  if (path === '/api/v1/webhooks/stripe' || path.startsWith('/api/v1/webhooks/stripe?')) return true
  return false
}

/**
 * Auth endpoints where a cross-site browser request is dangerous even WITHOUT
 * an existing session cookie (login CSRF logs the victim into the attacker's
 * account; register creates one). Enforced only when the request carries
 * browser provenance headers, so non-browser API clients keep working.
 */
const NO_COOKIE_BROWSER_CSRF_PATHS = new Set([
  '/api/auth/session',
  '/api/auth/register',
  // Cross-site reset requests can spam recovery email for known identifiers.
  '/api/auth/password-reset/request',
])

function originAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((a) => a === origin)
}

/**
 * Cookie-session CSRF guard: mutating requests with a session cookie must come from an allowed Origin/Referer.
 * Bearer-only clients (no session cookie) are exempt.
 */
export function enforceCookieCsrf(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!MUTATING.has(req.method)) return true
  const path = (req.url.split('?')[0] ?? '').replace(/\/+$/, '') || '/'
  if (pathExempt(path)) return true

  const secFetchSiteHeader = req.headers['sec-fetch-site']
  const secFetchSite = typeof secFetchSiteHeader === 'string' ? secFetchSiteHeader : ''
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  const referer = typeof req.headers.referer === 'string' ? req.headers.referer : ''

  const hasSessionCookie = Boolean(req.cookies?.[SESSION_COOKIE_NAME])
  if (!hasSessionCookie) {
    const hasBrowserProvenance = Boolean(secFetchSite || origin || referer)
    if (!(NO_COOKIE_BROWSER_CSRF_PATHS.has(path) && hasBrowserProvenance)) {
      return true
    }
  }

  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return true
  }

  if (secFetchSite === 'cross-site') {
    void reply.status(403).send({ error: 'Forbidden', code: 'csrf_cross_site' })
    return false
  }

  const allowed = allowedOrigins()
  if (origin) {
    if (!originAllowed(origin, allowed)) {
      void reply.status(403).send({ error: 'Forbidden', code: 'csrf_bad_origin' })
      return false
    }
    return true
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (!originAllowed(refOrigin, allowed)) {
        void reply.status(403).send({ error: 'Forbidden', code: 'csrf_bad_referer' })
        return false
      }
      return true
    } catch {
      void reply.status(403).send({ error: 'Forbidden', code: 'csrf_bad_referer' })
      return false
    }
  }

  // Browser said same-origin / user-initiated and sent no Origin/Referer
  // (some same-origin requests omit both) — trust the fetch metadata.
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return true
  }

  void reply.status(403).send({ error: 'Forbidden', code: 'csrf_missing_origin' })
  return false
}
