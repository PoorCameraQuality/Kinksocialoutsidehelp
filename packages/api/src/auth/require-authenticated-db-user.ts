import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveViewerFromRequest } from './resolve-viewer.js'
import { getViewerUserId } from './viewer-user-id.js'

export type RequireAuthenticatedDbUserOptions = {
  /** Default: `Unauthorized` */
  unauthorizedError?: string
  /** Default: `Invalid session` — used when `sub` is present but not a user UUID (e.g. mock fallback). */
  invalidSessionError?: string
}

/**
 * Require a signed-in viewer whose session `sub` is a real DB user UUID.
 *
 * Mock/fallback auth may set `sub` to a demo username. That must never be used as
 * a PostgreSQL `user_id` FK. Callers that need a database actor must use this helper
 * (or `getViewerUserId`) rather than `payload.sub` directly.
 *
 * @returns `{ userId }` or `null` after sending 401.
 */
export function requireAuthenticatedDbUser(
  req: FastifyRequest,
  reply: FastifyReply,
  options?: RequireAuthenticatedDbUserOptions,
): { userId: string } | null {
  const unauthorizedError = options?.unauthorizedError ?? 'Unauthorized'
  const invalidSessionError = options?.invalidSessionError ?? 'Invalid session'
  const viewer = resolveViewerFromRequest(req)
  if (!viewer.authenticated || !viewer.payload?.sub) {
    reply.status(401).send({ error: unauthorizedError })
    return null
  }
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: invalidSessionError })
    return null
  }
  return { userId }
}
