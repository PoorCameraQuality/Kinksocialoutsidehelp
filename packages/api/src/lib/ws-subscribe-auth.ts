/**
 * Authorize WebSocket `subscribe` scopes to match REST visibility for conventions and org chat.
 */
import { and, eq } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { isPublicProgramListing } from './convention-program-policy.js'
import { viewerCanAccessOrgChannel } from './convention-channel-access.js'
import { isUserScopeBanned } from './org-moderation-access.js'
import { parseOrgFeatureFlags } from './org-features.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

async function conventionScheduleAllowed(conventionId: string, userId: string | null): Promise<boolean> {
  if (!UUID_RE.test(conventionId)) return false
  const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, conventionId)).limit(1)
  if (!conv || !conv.organizationId) return false
  if (isPublicProgramListing(conv.settings)) return true
  if (!userId) return false
  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, conv.organizationId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  const [grant] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conv.id),
        eq(schema.conventionAccessGrants.userId, userId)
      )
    )
    .limit(1)
  const hasPaidAccess = Boolean(grant && grant.paidConfirmed && grant.attendingConfirmed)
  const isStaff = Boolean(grant && (grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess))
  const canManage = Boolean(member && ORG_ROLE_RANK[member.role] >= ORG_ROLE_RANK.MODERATOR)
  const canView = canManage || hasPaidAccess || isStaff
  return canView || canManage
}

async function orgChannelAllowed(orgId: string, channelId: string, userId: string | null): Promise<boolean> {
  if (!userId || !UUID_RE.test(orgId) || !UUID_RE.test(channelId)) return false
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
  if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled) return false
  const [mem] = await db
    .select({ id: schema.organizationMembers.id })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, orgId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  if (!mem) return false
  if (await isUserScopeBanned('organization', orgId, userId)) return false
  const [ch] = await db
    .select({
      id: schema.orgChannels.id,
      organizationId: schema.orgChannels.organizationId,
      requiresConventionId: schema.orgChannels.requiresConventionId,
    })
    .from(schema.orgChannels)
    .where(and(eq(schema.orgChannels.organizationId, orgId), eq(schema.orgChannels.id, channelId)))
    .limit(1)
  if (!ch) return false
  // PR 3 (Z1): convention-gated channels must apply the same per-channel rule
  // as HTTP reads — plain org membership is not enough for attendee channels.
  return viewerCanAccessOrgChannel(ch, userId, org)
}

async function orgAnnouncementsAllowed(orgId: string, userId: string | null): Promise<boolean> {
  if (!userId || !UUID_RE.test(orgId)) return false
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
  if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled) return false
  const [mem] = await db
    .select({ id: schema.organizationMembers.id })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, orgId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  if (!mem) return false
  if (await isUserScopeBanned('organization', orgId, userId)) return false
  return true
}

/**
 * Returns true if the viewer may receive realtime events for this scope (matches REST rules).
 */
export async function authorizeWebSocketSubscribe(req: FastifyRequest, scope: string): Promise<boolean> {
  if (!useDatabase()) return false

  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)

  const convSchedule = scope.match(/^convention:([0-9a-f-]{36}):schedule$/i)
  if (convSchedule?.[1]) {
    return conventionScheduleAllowed(convSchedule[1], userId)
  }

  const orgChannel = scope.match(/^org:([0-9a-f-]{36}):channel:([0-9a-f-]{36})$/i)
  if (orgChannel?.[1] && orgChannel[2]) {
    return orgChannelAllowed(orgChannel[1], orgChannel[2], userId)
  }

  const orgAnn = scope.match(/^org:([0-9a-f-]{36}):announcements$/i)
  if (orgAnn?.[1]) {
    return orgAnnouncementsAllowed(orgAnn[1], userId)
  }

  return false
}
