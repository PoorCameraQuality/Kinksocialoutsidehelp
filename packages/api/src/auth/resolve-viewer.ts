import {
  decodeSession,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from '@c2k/shared/session-token'
import type { FastifyRequest } from 'fastify'
import { allowAuthFallback as allowAuthFallbackFromGuard } from '../lib/production-guard.js'

/** Must match `MOCK_VIEWER_USERNAME` in web `mock-seeds.ts`. */
const MOCK_VIEWER_USERNAME = 'RopeDreamer'

export function allowAuthFallback(): boolean {
  return allowAuthFallbackFromGuard()
}

export type ResolvedViewer = {
  authenticated: boolean
  fallback: boolean
  username: string | null
  /**
   * Session claims. When `authenticated` is true, `payload.sub` may still be a
   * non-UUID (legacy/mock). Never use `sub` as a DB `user_id` — call
   * `getViewerUserId` or `requireAuthenticatedDbUser`.
   */
  payload: SessionPayload | null
}

/**
 * Resolve cookie session or optional local demo fallback.
 * Fallback sets `authenticated: false` with a username `sub` for UI-only demos;
 * mutating API routes must still require a UUID via `requireAuthenticatedDbUser`.
 */
export function resolveViewerFromRequest(req: FastifyRequest): ResolvedViewer {
  const raw = req.cookies[SESSION_COOKIE_NAME]
  const decoded = raw ? decodeSession(raw) : null
  if (decoded) {
    return { authenticated: true, fallback: false, username: decoded.username, payload: decoded }
  }

  if (allowAuthFallback()) {
    return {
      authenticated: false,
      fallback: true,
      username: MOCK_VIEWER_USERNAME,
      payload: { username: MOCK_VIEWER_USERNAME, sub: MOCK_VIEWER_USERNAME },
    }
  }

  return { authenticated: false, fallback: false, username: null, payload: null }
}
