import { and, desc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { executeModerationAction } from '../lib/moderation-action-execute.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { notifyModerationActionPending } from '../lib/moderation-notify.js'
import { isSiteAdmin, isTrustSafetyAdmin } from '../lib/platform-staff.js'
import {
  requireDb,
  requirePlatformModerator,
  requireSiteAdmin,
  requireUser,
} from '../lib/moderation-route-auth.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

const proposeBody = z.object({
  actionType: z.string().min(1).max(64),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(256),
  payload: z.record(z.unknown()).optional(),
  reportId: z.string().uuid().optional(),
  requiredApprovals: z.number().int().min(1).max(5).optional(),
})

export async function registerModerationActionsRoutes(app: FastifyInstance) {
  app.get('/api/v1/moderation/actions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { status?: string }
    const statusAlias: Record<string, (typeof schema.moderationActions.$inferSelect)['status']> = {
      PENDING: 'PENDING_APPROVAL',
      PENDING_APPROVAL: 'PENDING_APPROVAL',
      APPROVED: 'APPROVED',
      EXECUTED: 'EXECUTED',
      REJECTED: 'REJECTED',
      OVERRIDDEN: 'OVERRIDDEN',
    }
    const statusRaw = statusAlias[q.status?.trim().toUpperCase() ?? ''] ?? 'PENDING_APPROVAL'

    const rows = await db
      .select({
        id: schema.moderationActions.id,
        actionType: schema.moderationActions.actionType,
        targetType: schema.moderationActions.targetType,
        targetId: schema.moderationActions.targetId,
        status: schema.moderationActions.status,
        proposedByUserId: schema.moderationActions.proposedByUserId,
        proposerUsername: schema.users.username,
        requiredApprovals: schema.moderationActions.requiredApprovals,
        overrideByUserId: schema.moderationActions.overrideByUserId,
        overrideReason: schema.moderationActions.overrideReason,
        createdAt: schema.moderationActions.createdAt,
        approvalCount: sql<number>`(
          SELECT count(*)::int FROM moderation_action_approvals
          WHERE action_id = ${schema.moderationActions.id}
        )`,
      })
      .from(schema.moderationActions)
      .innerJoin(schema.users, eq(schema.moderationActions.proposedByUserId, schema.users.id))
      .where(eq(schema.moderationActions.status, statusRaw))
      .orderBy(desc(schema.moderationActions.createdAt))
      .limit(100)

    return reply.send({ items: rows })
  })

  app.get('/api/v1/moderation/actions/:actionId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { actionId } = req.params as { actionId: string }
    const [action] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)
    if (!action) return reply.status(404).send({ error: 'Not found' })

    const approvals = await db
      .select({
        userId: schema.moderationActionApprovals.userId,
        username: schema.users.username,
        createdAt: schema.moderationActionApprovals.createdAt,
      })
      .from(schema.moderationActionApprovals)
      .innerJoin(schema.users, eq(schema.moderationActionApprovals.userId, schema.users.id))
      .where(eq(schema.moderationActionApprovals.actionId, actionId))

    return reply.send({ action, approvals })
  })

  app.post('/api/v1/moderation/actions', { ...rateLimitRoute('moderationActions') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const parsed = proposeBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const siteAdminOnly = ['IDENTITY_BAN', 'FREEZE_ORG']
    const trustSafetyOnly = ['SUSPEND_USER', 'DELETE_CONTENT']
    if (siteAdminOnly.includes(parsed.data.actionType) && !(await isSiteAdmin(user.userId))) {
      return reply.status(403).send({ error: 'Site admin only for this action type' })
    }
    if (trustSafetyOnly.includes(parsed.data.actionType) && !(await isTrustSafetyAdmin(user.userId))) {
      return reply.status(403).send({ error: 'Trust & safety admin only for this action type' })
    }

    const [row] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: parsed.data.actionType,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        proposedByUserId: user.userId,
        payload: parsed.data.payload ?? {},
        reportId: parsed.data.reportId ?? null,
        requiredApprovals: parsed.data.requiredApprovals ?? 2,
      })
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.actionProposed,
      targetType: 'moderation_action',
      targetId: row.id,
      payload: { actionType: row.actionType },
    })

    await notifyModerationActionPending(row.id, user.userId)
    return reply.send({ action: row })
  })

  app.post(
    '/api/v1/moderation/reports/:reportId/propose-action',
    { ...rateLimitRoute('moderationActions') },
    async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { reportId } = req.params as { reportId: string }
    const parsed = proposeBody.omit({ reportId: true }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const siteAdminOnly = ['IDENTITY_BAN', 'FREEZE_ORG']
    const trustSafetyOnly = ['SUSPEND_USER', 'DELETE_CONTENT']
    if (siteAdminOnly.includes(parsed.data.actionType) && !(await isSiteAdmin(user.userId))) {
      return reply.status(403).send({ error: 'Site admin only for this action type' })
    }
    if (trustSafetyOnly.includes(parsed.data.actionType) && !(await isTrustSafetyAdmin(user.userId))) {
      return reply.status(403).send({ error: 'Trust & safety admin only for this action type' })
    }

    const [row] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: parsed.data.actionType,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        proposedByUserId: user.userId,
        payload: parsed.data.payload ?? {},
        reportId,
        requiredApprovals: parsed.data.requiredApprovals ?? 2,
      })
      .returning()

    await notifyModerationActionPending(row.id, user.userId)
    return reply.send({ action: row })
  })

  const rejectBody = z.object({ note: z.string().max(4000).optional() })

  app.post(
    '/api/v1/moderation/actions/:actionId/approve',
    { ...rateLimitRoute('moderationActions') },
    async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { actionId } = req.params as { actionId: string }
    const [action] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)
    if (!action) return reply.status(404).send({ error: 'Not found' })
    if (action.status !== 'PENDING_APPROVAL') {
      return reply.status(400).send({ error: 'Action not pending approval' })
    }
    if (action.proposedByUserId === user.userId) {
      return reply.status(400).send({ error: 'Proposer cannot approve their own action' })
    }

    const [existingApproval] = await db
      .select()
      .from(schema.moderationActionApprovals)
      .where(
        and(
          eq(schema.moderationActionApprovals.actionId, actionId),
          eq(schema.moderationActionApprovals.userId, user.userId)
        )
      )
      .limit(1)
    if (!existingApproval) {
      await db.insert(schema.moderationActionApprovals).values({ actionId, userId: user.userId })
    }

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.actionApproved,
      targetType: 'moderation_action',
      targetId: actionId,
    })

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.moderationActionApprovals)
      .where(eq(schema.moderationActionApprovals.actionId, actionId))

    if (count >= action.requiredApprovals) {
      await executeModerationAction(action, user.userId)
    } else {
      await db
        .update(schema.moderationActions)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(schema.moderationActions.id, actionId))
    }

    const [updated] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)

    return reply.send({ action: updated, approvalCount: count })
  },
  )

  app.post(
    '/api/v1/moderation/actions/:actionId/reject',
    { ...rateLimitRoute('moderationActions') },
    async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { actionId } = req.params as { actionId: string }
    const parsed = rejectBody.safeParse(req.body ?? {})

    const [existing] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)
    if (!existing || existing.status !== 'PENDING_APPROVAL') {
      return reply.status(404).send({ error: 'Not found or not pending' })
    }
    const prevPayload =
      existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : {}
    const [updated] = await db
      .update(schema.moderationActions)
      .set({
        status: 'REJECTED',
        updatedAt: new Date(),
        payload: {
          ...prevPayload,
          rejectNote: parsed.success ? parsed.data.note : undefined,
          rejectedBy: user.userId,
        },
      })
      .where(eq(schema.moderationActions.id, actionId))
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Not found or not pending' })

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.actionRejected,
      targetType: 'moderation_action',
      targetId: actionId,
    })

    return reply.send({ action: updated })
  },
  )

  const overrideBody = z.object({ reason: z.string().min(1).max(4000) })

  app.post(
    '/api/v1/moderation/actions/:actionId/execute-now',
    { ...rateLimitRoute('moderationActions') },
    async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireSiteAdmin(user.userId, reply))) return

    const { actionId } = req.params as { actionId: string }
    const parsed = overrideBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Override reason required' })

    const [action] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)
    if (!action) return reply.status(404).send({ error: 'Not found' })

    await executeModerationAction(action, user.userId, { overrideReason: parsed.data.reason })
    const [updated] = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId))
      .limit(1)

    return reply.send({ action: updated })
  },
  )
}
