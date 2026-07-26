import type { SessionPayload } from '@c2k/shared/session-token'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Returns the PostgreSQL `users.id` when session `sub` is a UUID.
 * Returns null for missing sessions or mock/demo username subjects — never use
 * raw `payload.sub` as a DB foreign key without this gate.
 */
export function getViewerUserId(payload: SessionPayload | null | undefined): string | null {
  if (!payload?.sub) return null
  return UUID_RE.test(payload.sub) ? payload.sub : null
}
