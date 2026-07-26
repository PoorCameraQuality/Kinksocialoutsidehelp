import { eq } from 'drizzle-orm'
import { schema } from '../db/index.js'

export type EventListScopeQuery = {
  groupId?: string
  organizationId?: string
  hostId?: string
}

/**
 * True when `GET /api/v1/events` is used for unscoped global discovery
 * (browse / explore / home pools) — not group, org, or host-scoped lists.
 */
export function isGlobalPublicEventDiscoveryQuery(q: EventListScopeQuery): boolean {
  const groupId = typeof q.groupId === 'string' ? q.groupId.trim() : ''
  const organizationId = typeof q.organizationId === 'string' ? q.organizationId.trim() : ''
  const hostId = typeof q.hostId === 'string' ? q.hostId.trim() : ''
  return !groupId && !organizationId && !hostId
}

/** SQL filter for global discovery: public events only (matches trending + venue lists). */
export function globalPublicEventDiscoveryFilter() {
  return eq(schema.events.visibility, 'public')
}
