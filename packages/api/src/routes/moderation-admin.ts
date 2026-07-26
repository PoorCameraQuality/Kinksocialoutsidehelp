import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { executeModerationAction } from '../lib/moderation-action-execute.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { resolveOrganizationId } from '../lib/org-moderation-access.js'
import {
  requireDb,
  requirePlatformModerator,
  requireSiteAdmin,
  requireUser,
} from '../lib/moderation-route-auth.js'

export async function registerModerationAdminRoutes(app: FastifyInstance) {
  app.get('/api/v1/moderation/audit', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { scopeType?: string; limit?: string }
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 200)

    const rows = await db
      .select()
      .from(schema.moderationAuditEvents)
      .orderBy(desc(schema.moderationAuditEvents.createdAt))
      .limit(limit)

    return reply.send({ items: rows })
  })

  app.post('/api/v1/moderation/admin/organizations/:orgKey/freeze', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireSiteAdmin(user.userId, reply))) return

    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })

    const [action] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: 'FREEZE_ORG',
        targetType: 'organization',
        targetId: orgId,
        proposedByUserId: user.userId,
        status: 'EXECUTED',
        requiredApprovals: 1,
        executedAt: new Date(),
        overrideByUserId: user.userId,
        overrideReason: 'Site admin immediate freeze',
      })
      .returning()

    await executeModerationAction(action, user.userId, {
      overrideReason: 'Site admin immediate freeze',
    })

    return reply.send({ ok: true, actionId: action.id })
  })

  const identityBanBody = z.object({
    userId: z.string().uuid(),
    reason: z.string().min(1).max(255),
    ipPrefix: z.string().max(64).optional(),
  })

  app.post('/api/v1/moderation/admin/identity-bans', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireSiteAdmin(user.userId, reply))) return

    const parsed = identityBanBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [action] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: 'IDENTITY_BAN',
        targetType: 'user',
        targetId: parsed.data.userId,
        proposedByUserId: user.userId,
        status: 'EXECUTED',
        requiredApprovals: 1,
        payload: { reason: parsed.data.reason, ipPrefix: parsed.data.ipPrefix ?? '0.0.0.0/0' },
        executedAt: new Date(),
        overrideByUserId: user.userId,
        overrideReason: 'Site admin emergency identity ban',
      })
      .returning()

    await executeModerationAction(action, user.userId, {
      overrideReason: 'Site admin emergency identity ban',
    })

    return reply.send({ ok: true, actionId: action.id })
  })

  app.post('/api/v1/moderation/admin/users/:userId/suspend', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireSiteAdmin(user.userId, reply))) return

    const { userId: targetUserId } = req.params as { userId: string }
    const body = z.object({ reason: z.string().max(2000).optional() }).safeParse(req.body ?? {})

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      scopeId: null,
      verb: MODERATION_AUDIT_VERBS.userSuspended,
      targetType: 'user',
      targetId: targetUserId,
      payload: body.success ? { reason: body.data.reason } : {},
    })

    return reply.send({ ok: true, note: 'Suspend recorded in audit; full account lock uses identity ban.' })
  })
}
