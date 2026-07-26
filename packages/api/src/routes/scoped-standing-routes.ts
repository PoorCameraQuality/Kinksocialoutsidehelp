import { SCOPED_STANDINGS, type ScopedStanding } from '@c2k/shared'
import { and, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { getGroupMembership, resolveGroupManagerRole } from '../lib/group-access.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { resolveOrganizationId, requireOrgMinRole } from '../lib/org-moderation-access.js'
import { getScopedStandingView, setScopedStanding } from '../lib/scoped-standing.js'

const standingPatchSchema = z.object({
  standing: z.enum([
    SCOPED_STANDINGS.goodStanding,
    SCOPED_STANDINGS.needsAttention,
    SCOPED_STANDINGS.limited,
    SCOPED_STANDINGS.timedOut,
    SCOPED_STANDINGS.banned,
    SCOPED_STANDINGS.escalatedToPlatform,
  ]),
  reasonCategory: z.string().min(1).max(128),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
})

async function canModerateGroup(groupId: string, userId: string): Promise<boolean> {
  const [g] = await db
    .select({ id: schema.groups.id, ownerId: schema.groups.ownerId, organizationId: schema.groups.organizationId })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)
  if (!g) return false
  const mem = await getGroupMembership(groupId, userId)
  const role = resolveGroupManagerRole(g, mem, userId)
  if (role === 'owner' || role === 'admin' || role === 'moderator') return true
  if (g.organizationId) {
    const [org] = await db
      .select({ ownerId: schema.organizations.ownerId })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, g.organizationId))
      .limit(1)
    if (org?.ownerId === userId) return true
  }
  return false
}

export async function registerScopedStandingRoutes(app: FastifyInstance) {
  app.get('/api/v1/organizations/:orgKey/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, userId: memberId } = req.params as { orgKey: string; userId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const view = await getScopedStandingView(memberId, 'organization', orgId)
    return reply.send(view)
  })

  app.patch('/api/v1/organizations/:orgKey/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, userId: memberId } = req.params as { orgKey: string; userId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const parsed = standingPatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null
    const view = await setScopedStanding({
      userId: memberId,
      scopeType: 'organization',
      scopeId: orgId,
      standingAfter: parsed.data.standing as ScopedStanding,
      reasonCategory: parsed.data.reasonCategory,
      createdBy: user.userId,
      sourceType: 'org_mod_action',
      expiresAt,
    })
    return reply.send(view)
  })

  app.get('/api/v1/groups/:groupId/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId, userId: memberId } = req.params as { groupId: string; userId: string }
    if (!(await canModerateGroup(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const view = await getScopedStandingView(memberId, 'group', groupId)
    return reply.send(view)
  })

  app.patch('/api/v1/groups/:groupId/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId, userId: memberId } = req.params as { groupId: string; userId: string }
    if (!(await canModerateGroup(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = standingPatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null
    const view = await setScopedStanding({
      userId: memberId,
      scopeType: 'group',
      scopeId: groupId,
      standingAfter: parsed.data.standing as ScopedStanding,
      reasonCategory: parsed.data.reasonCategory,
      createdBy: user.userId,
      sourceType: 'group_mod_action',
      expiresAt,
    })
    return reply.send(view)
  })

  app.get('/api/v1/events/:eventId/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, userId: memberId } = req.params as { eventId: string; userId: string }
    const {
      canModerateEventScope,
      resolveEventStandingTarget,
      userParticipatesInEvent,
    } = await import('../lib/scoped-standing-targets.js')
    const target = await resolveEventStandingTarget(eventId)
    if (!target) return reply.status(404).send({ error: 'Event not found' })
    if (!(await canModerateEventScope(eventId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const participates = await userParticipatesInEvent(eventId, memberId)
    const view = await getScopedStandingView(memberId, 'event', target.scopeId)
    return reply.send({
      ...view,
      participation: {
        linked: participates,
        model: 'limited' as const,
        detail: participates
          ? null
          : 'Standing tools are available for this scope, but attendee membership is not fully linked yet.',
      },
    })
  })

  app.patch('/api/v1/events/:eventId/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, userId: memberId } = req.params as { eventId: string; userId: string }
    const { canModerateEventScope, resolveEventStandingTarget } = await import('../lib/scoped-standing-targets.js')
    const target = await resolveEventStandingTarget(eventId)
    if (!target) return reply.status(404).send({ error: 'Event not found' })
    if (!(await canModerateEventScope(eventId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = standingPatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null
    const view = await setScopedStanding({
      userId: memberId,
      scopeType: 'event',
      scopeId: target.scopeId,
      standingAfter: parsed.data.standing as ScopedStanding,
      reasonCategory: parsed.data.reasonCategory,
      createdBy: user.userId,
      sourceType: 'event_mod_action',
      expiresAt,
    })
    return reply.send(view)
  })

  app.get('/api/v1/conventions/:key/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, userId: memberId } = req.params as { key: string; userId: string }
    const {
      canModerateConventionScope,
      resolveConventionStandingTarget,
      userParticipatesInConvention,
    } = await import('../lib/scoped-standing-targets.js')
    const mod = await canModerateConventionScope(key, user.userId, reply)
    if (!mod) return
    const target = await resolveConventionStandingTarget(key)
    if (!target) return reply.status(404).send({ error: 'Convention not found' })
    const participates = await userParticipatesInConvention(target.scopeId, memberId)
    const view = await getScopedStandingView(memberId, 'convention', target.scopeId)
    return reply.send({
      ...view,
      participation: {
        linked: participates,
        model: 'limited' as const,
        detail: participates
          ? null
          : 'Standing tools are available for this scope, but attendee membership is not fully linked yet.',
      },
    })
  })

  app.patch('/api/v1/conventions/:key/members/:userId/standing', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, userId: memberId } = req.params as { key: string; userId: string }
    const { canModerateConventionScope, resolveConventionStandingTarget } = await import('../lib/scoped-standing-targets.js')
    const mod = await canModerateConventionScope(key, user.userId, reply)
    if (!mod) return
    const target = await resolveConventionStandingTarget(key)
    if (!target) return reply.status(404).send({ error: 'Convention not found' })
    const parsed = standingPatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null
    const view = await setScopedStanding({
      userId: memberId,
      scopeType: 'convention',
      scopeId: target.scopeId,
      standingAfter: parsed.data.standing as ScopedStanding,
      reasonCategory: parsed.data.reasonCategory,
      createdBy: user.userId,
      sourceType: 'convention_mod_action',
      expiresAt,
    })
    return reply.send(view)
  })

  app.get('/api/v1/me/trust/restrictions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { and, or, isNull, gt } = await import('drizzle-orm')
    const bans = await db
      .select({
        id: schema.scopeBans.id,
        scopeType: schema.scopeBans.scopeType,
        scopeId: schema.scopeBans.scopeId,
        reason: schema.scopeBans.reason,
        expiresAt: schema.scopeBans.expiresAt,
      })
      .from(schema.scopeBans)
      .where(
        and(
          eq(schema.scopeBans.userId, user.userId),
          eq(schema.scopeBans.active, true),
          or(isNull(schema.scopeBans.expiresAt), gt(schema.scopeBans.expiresAt, new Date()))
        )
      )
    const restrictions = await db
      .select()
      .from(schema.messagingRestrictions)
      .where(
        and(
          eq(schema.messagingRestrictions.userId, user.userId),
          eq(schema.messagingRestrictions.status, 'ACTIVE'),
          or(isNull(schema.messagingRestrictions.expiresAt), gt(schema.messagingRestrictions.expiresAt, new Date()))
        )
      )
    const scopedStandingRows = await db
      .select({
        scopeType: schema.trustSignalRollups.scopeType,
        scopeId: schema.trustSignalRollups.scopeId,
        scopedStanding: schema.trustSignalRollups.scopedStanding,
      })
      .from(schema.trustSignalRollups)
      .where(
        and(
          eq(schema.trustSignalRollups.userId, user.userId),
          sql`${schema.trustSignalRollups.scopedStanding} <> 'GOOD_STANDING'`
        )
      )

    const openAppeals = await db
      .select({
        id: schema.scopedModerationAppeals.id,
        scopeType: schema.scopedModerationAppeals.scopeType,
        scopeId: schema.scopedModerationAppeals.scopeId,
        status: schema.scopedModerationAppeals.status,
        createdAt: schema.scopedModerationAppeals.createdAt,
      })
      .from(schema.scopedModerationAppeals)
      .where(
        and(
          eq(schema.scopedModerationAppeals.userId, user.userId),
          eq(schema.scopedModerationAppeals.status, 'OPEN')
        )
      )

    return reply.send({
      scopeBans: bans.map((b) => ({
        id: b.id,
        scopeType: b.scopeType,
        scopeId: b.scopeId,
        reasonCategory: b.reason ?? 'scoped_restriction',
        expiresAt: b.expiresAt?.toISOString() ?? null,
        appealPath: '/settings/trust',
      })),
      messagingRestrictions: restrictions.map((r) => ({
        id: r.id,
        scopeType: null,
        scopeId: null,
        type: r.restrictionType,
        reasonCategory: r.reasonCategory,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        userNotice:
          'Your ability to start new conversations is temporarily limited because recent outreach looked unusually high or unwanted.',
        appealPath: '/settings/trust',
      })),
      scopedStandings: scopedStandingRows.map((s) => ({
        scopeType: s.scopeType,
        scopeId: s.scopeId,
        standing: s.scopedStanding,
        reasonCategory: 'scoped_standing',
        expiresAt: null,
        appealPath: '/settings/trust',
      })),
      openAppeals: openAppeals.map((a) => ({
        id: a.id,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        status: a.status,
        filedAt: a.createdAt.toISOString(),
      })),
    })
  })

  app.post('/api/v1/me/trust/appeals', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const body = z
      .object({
        scopeType: z.enum(['organization', 'group', 'event', 'convention']),
        scopeId: z.string().uuid(),
        sourceType: z.string().min(1),
        sourceId: z.string().uuid(),
        reason: z.string().min(10).max(4000),
      })
      .safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.scopedModerationAppeals)
      .values({
        userId: user.userId,
        scopeType: body.data.scopeType,
        scopeId: body.data.scopeId,
        sourceType: body.data.sourceType,
        sourceId: body.data.sourceId,
        reason: body.data.reason,
      })
      .returning()
    return reply.send({ appeal: row })
  })

  const appealResolveSchema = z.object({
    status: z.enum(['APPROVED', 'DENIED']),
    resolutionNote: z.string().max(4000).optional(),
  })

  app.patch('/api/v1/organizations/:orgKey/trust/appeals/:appealId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, appealId } = req.params as { orgKey: string; appealId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const parsed = appealResolveSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [appeal] = await db
      .select()
      .from(schema.scopedModerationAppeals)
      .where(
        and(
          eq(schema.scopedModerationAppeals.id, appealId),
          eq(schema.scopedModerationAppeals.scopeType, 'organization'),
          eq(schema.scopedModerationAppeals.scopeId, orgId)
        )
      )
      .limit(1)
    if (!appeal) return reply.status(404).send({ error: 'Appeal not found' })

    const [updated] = await db
      .update(schema.scopedModerationAppeals)
      .set({
        status: parsed.data.status,
        reviewedBy: user.userId,
        resolutionNote: parsed.data.resolutionNote ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(schema.scopedModerationAppeals.id, appealId))
      .returning()

    if (parsed.data.status === 'APPROVED') {
      await setScopedStanding({
        userId: appeal.userId,
        scopeType: 'organization',
        scopeId: orgId,
        standingAfter: SCOPED_STANDINGS.goodStanding,
        reasonCategory: 'appeal_overturned',
        createdBy: user.userId,
        sourceType: 'scoped_appeal',
        sourceId: appealId,
      })
    }

    return reply.send({ appeal: updated })
  })

  app.patch('/api/v1/groups/:groupId/trust/appeals/:appealId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId, appealId } = req.params as { groupId: string; appealId: string }
    if (!(await canModerateGroup(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = appealResolveSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [appeal] = await db
      .select()
      .from(schema.scopedModerationAppeals)
      .where(
        and(
          eq(schema.scopedModerationAppeals.id, appealId),
          eq(schema.scopedModerationAppeals.scopeType, 'group'),
          eq(schema.scopedModerationAppeals.scopeId, groupId)
        )
      )
      .limit(1)
    if (!appeal) return reply.status(404).send({ error: 'Appeal not found' })

    const [updated] = await db
      .update(schema.scopedModerationAppeals)
      .set({
        status: parsed.data.status,
        reviewedBy: user.userId,
        resolutionNote: parsed.data.resolutionNote ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(schema.scopedModerationAppeals.id, appealId))
      .returning()

    if (parsed.data.status === 'APPROVED') {
      await setScopedStanding({
        userId: appeal.userId,
        scopeType: 'group',
        scopeId: groupId,
        standingAfter: SCOPED_STANDINGS.goodStanding,
        reasonCategory: 'appeal_overturned',
        createdBy: user.userId,
        sourceType: 'scoped_appeal',
        sourceId: appealId,
      })
    }

    return reply.send({ appeal: updated })
  })

  app.get('/api/v1/organizations/:orgKey/trust/appeals', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const rows = await db
      .select()
      .from(schema.scopedModerationAppeals)
      .where(
        and(
          eq(schema.scopedModerationAppeals.scopeType, 'organization'),
          eq(schema.scopedModerationAppeals.scopeId, orgId),
          eq(schema.scopedModerationAppeals.status, 'OPEN')
        )
      )
    return reply.send({ appeals: rows })
  })

  app.get('/api/v1/groups/:groupId/trust/appeals', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    if (!(await canModerateGroup(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const rows = await db
      .select()
      .from(schema.scopedModerationAppeals)
      .where(
        and(
          eq(schema.scopedModerationAppeals.scopeType, 'group'),
          eq(schema.scopedModerationAppeals.scopeId, groupId),
          eq(schema.scopedModerationAppeals.status, 'OPEN')
        )
      )
    return reply.send({ appeals: rows })
  })
}
