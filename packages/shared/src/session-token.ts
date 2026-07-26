import { createHmac, timingSafeEqual } from 'crypto'

/** HttpOnly cookie name for signed session payload. */
export const SESSION_COOKIE_NAME = 'c2k_session'

/** Session lifetime. Keep in sync with cookie maxAge in auth routes. */
export const SESSION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type SessionPayload = {
  /** Display or mock viewer username */
  username: string
  /** Stable id. Mock auth may use the same value as username. */
  sub: string
  /** Session version. Cookie is invalid after password reset when the server bumps session_version. */
  sv?: number
  /** Issued-at, ms epoch (set by encodeSession). */
  iat?: number
  /**
   * Expiry, ms epoch. decodeSession rejects tokens past this moment, and
   * tokens without an expiry (fail closed - legacy cookies require re-login).
   */
  exp?: number
}

function getSecret(): string {
  return process.env.AUTH_SECRET ?? 'dev-insecure-auth-secret-change-me-in-env'
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

/**
 * Encodes session for Set-Cookie (base64url).
 * Stamps `iat`/`exp` unless the caller provides them (tests may craft expired tokens).
 */
export function encodeSession(payload: SessionPayload): string {
  const now = Date.now()
  const stamped: SessionPayload = {
    iat: now,
    exp: now + SESSION_TOKEN_TTL_MS,
    ...payload,
  }
  const json = JSON.stringify(stamped)
  const sig = sign(json)
  return Buffer.from(JSON.stringify({ json, sig })).toString('base64url')
}

export function decodeSession(token: string): SessionPayload | null {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { json: string; sig: string }
    const expected = sign(raw.json)
    const a = Buffer.from(raw.sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(raw.json) as SessionPayload
    // Server-side expiry (launch-hardening PR 3, A1): cookie maxAge alone is
    // browser-enforced only. Tokens without `exp` are legacy and fail closed.
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null
    return payload
  } catch {
    return null
  }
}
