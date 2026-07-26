import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const ORG_EVENT_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

export function isVirtualHttpsJoinLocation(eventFormat: string, location: string | null | undefined): boolean {
  if (eventFormat !== 'virtual' || !location?.trim()) return false
  return /^https?:\/\//i.test(location.trim())
}

export type VirtualJoinRow = {
  id: string
  hostId: string
  organizationId: string | null
  eventFormat: string
}

/**
 * Events where the viewer may see the raw virtual join URL (host, org moderator+, or going/maybe RSVP).
 */
export async function virtualJoinLinkVisibleEventIds(
  viewerId: string | null,
  rows: VirtualJoinRow[]
): Promise<Set<string>> {
  const visible = new Set<string>()
  if (!viewerId) return visible

  const virtualRows = rows.filter((r) => r.eventFormat === 'virtual')
  if (virtualRows.length === 0) return visible

  for (const r of virtualRows) {
    if (r.hostId === viewerId) visible.add(r.id)
  }

  const orgIds = [...new Set(virtualRows.map((r) => r.organizationId).filter(Boolean))] as string[]
  if (orgIds.length > 0) {
    const memberships = await db
      .select({
        organizationId: schema.organizationMembers.organizationId,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.userId, viewerId),
          inArray(schema.organizationMembers.organizationId, orgIds)
        )
      )
    const modOrgs = new Set(
      memberships
        .filter((m) => (ORG_EVENT_ROLE_RANK[m.role] ?? 0) >= ORG_EVENT_ROLE_RANK.MODERATOR)
        .map((m) => m.organizationId)
    )
    for (const r of virtualRows) {
      if (r.organizationId && modOrgs.has(r.organizationId)) visible.add(r.id)
    }
  }

  const pending = virtualRows.filter((r) => !visible.has(r.id)).map((r) => r.id)
  if (pending.length === 0) return visible

  const rsvpHits = await db
    .select({ eventId: schema.eventRsvps.eventId })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.userId, viewerId),
        inArray(schema.eventRsvps.eventId, pending),
        inArray(schema.eventRsvps.status, ['going', 'maybe'])
      )
    )
  for (const h of rsvpHits) visible.add(h.eventId)

  return visible
}

export async function viewerCanPatchEvent(
  viewerId: string,
  ev: { hostId: string; organizationId: string | null }
): Promise<boolean> {
  if (viewerId === ev.hostId) return true
  if (!ev.organizationId) return false
  const [mem] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, ev.organizationId),
        eq(schema.organizationMembers.userId, viewerId)
      )
    )
    .limit(1)
  const rank = mem ? ORG_EVENT_ROLE_RANK[mem.role] ?? 0 : 0
  return rank >= ORG_EVENT_ROLE_RANK.MODERATOR
}
