import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isOrgMember } from './org-visibility.js'

const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

type ChannelRow = {
  id: string
  organizationId: string
  requiresConventionId: string | null
}

/** True when viewer may read/post in this org channel (convention-gated or org-default rules). */
export async function viewerCanAccessOrgChannel(
  channel: ChannelRow,
  viewerId: string | null,
  org?: Pick<typeof schema.organizations.$inferSelect, 'id' | 'ownerId' | 'visibility'>,
): Promise<boolean> {
  if (!channel.requiresConventionId) {
    if (!viewerId) return false
    if (!org || org.visibility === 'PUBLIC') return true
    return isOrgMember(org as typeof schema.organizations.$inferSelect, viewerId)
  }
  if (!viewerId) return false
  const convId = channel.requiresConventionId
  const [conv] = await db
    .select({ organizationId: schema.conventions.organizationId })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, convId))
    .limit(1)
  if (!conv?.organizationId || conv.organizationId !== channel.organizationId) return false

  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, conv.organizationId),
        eq(schema.organizationMembers.userId, viewerId),
      ),
    )
    .limit(1)
  const canManage = Boolean(member && ORG_ROLE_RANK[member.role] >= ORG_ROLE_RANK.MODERATOR)

  const [grant] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, convId),
        eq(schema.conventionAccessGrants.userId, viewerId),
      ),
    )
    .limit(1)
  const hasPaidAccess = Boolean(grant && grant.paidConfirmed && grant.attendingConfirmed)
  const isStaff = Boolean(grant && (grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess))
  return canManage || hasPaidAccess || isStaff
}
