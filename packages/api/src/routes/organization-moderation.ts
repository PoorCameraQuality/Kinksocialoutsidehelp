import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { notifyModerationReportEscalated } from '../lib/moderation-notify.js'
import {
  isUserScopeBanned,
  requireOrgMinRole,
  resolveOrganizationId,
} from '../lib/org-moderation-access.js'
import { resolveReportScope } from '../lib/moderation-report-scope.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'

export async function registerOrganizationModerationRoutes(app: FastifyInstance) {
  app.get('/api/v1/organizations/:orgKey/reports', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const q = req.query as { status?: string }
    const statusFilter = q.status?.trim().toUpperCase()

    const rows = await db
      .select({
        id: schema.reports.id,
        targetType: schema.reports.targetType,
        targetId: schema.reports.targetId,
        category: schema.reports.category,
        status: schema.reports.status,
        createdAt: schema.reports.createdAt,
        reporterUsername: schema.users.username,
      })
      .from(schema.reports)
      .innerJoin(schema.users, eq(schema.reports.reporterId, schema.users.id))
      .where(
        and(
          eq(schema.reports.scopeType, 'organization'),
          eq(schema.reports.scopeId, orgId),
          statusFilter && statusFilter !== 'ALL' ? eq(schema.reports.status, statusFilter) : undefined
        )
      )
      .orderBy(desc(schema.reports.createdAt))
      .limit(100)

    return reply.send({ items: rows })
  })

  const patchReportBody = z.object({
    status: z.enum(['OPEN', 'TRIAGED', 'RESOLVED', 'DISMISSED']),
    note: z.string().max(4000).optional(),
  })

  app.patch('/api/v1/organizations/:orgKey/reports/:reportId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, reportId } = req.params as { orgKey: string; reportId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const parsed = patchReportBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [updated] = await db
      .update(schema.reports)
      .set({ status: parsed.data.status })
      .where(
        and(
          eq(schema.reports.id, reportId),
          eq(schema.reports.scopeType, 'organization'),
          eq(schema.reports.scopeId, orgId)
        )
      )
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Not found' })

    if (parsed.data.status === 'RESOLVED' || parsed.data.status === 'DISMISSED') {
      const { notifyReportReviewed } = await import('../lib/moderation-notify.js')
      await notifyReportReviewed(updated.reporterId, updated.id).catch(() => {})
    }

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'organization',
      scopeId: orgId,
      verb: MODERATION_AUDIT_VERBS.reportTriaged,
      targetType: 'report',
      targetId: reportId,
      payload: { status: parsed.data.status, note: parsed.data.note },
    })

    return reply.send({ report: updated })
  })

  app.post('/api/v1/organizations/:orgKey/forum/posts/:postId/hide', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, postId } = req.params as { orgKey: string; postId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const [post] = await db
      .select({ id: schema.forumPosts.id, threadId: schema.forumPosts.threadId })
      .from(schema.forumPosts)
      .where(eq(schema.forumPosts.id, postId))
      .limit(1)
    if (!post) return reply.status(404).send({ error: 'Post not found' })

    const [thread] = await db
      .select({ organizationId: schema.forumThreads.organizationId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, post.threadId))
      .limit(1)
    if (thread?.organizationId !== orgId) return reply.status(403).send({ error: 'Wrong org scope' })

    await db
      .update(schema.forumPosts)
      .set({ hiddenAt: new Date(), hiddenByUserId: user.userId })
      .where(eq(schema.forumPosts.id, postId))

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'organization',
      scopeId: orgId,
      verb: MODERATION_AUDIT_VERBS.contentHidden,
      targetType: 'forum_post',
      targetId: postId,
    })

    return reply.send({ ok: true })
  })

  const threadModBody = z.object({
    locked: z.boolean().optional(),
    pinned: z.boolean().optional(),
  })

  app.post('/api/v1/organizations/:orgKey/forum/threads/:threadId/moderate', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, threadId } = req.params as { orgKey: string; threadId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const parsed = threadModBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [thread] = await db
      .select({ organizationId: schema.forumThreads.organizationId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, threadId))
      .limit(1)
    if (thread?.organizationId !== orgId) return reply.status(403).send({ error: 'Wrong org scope' })

    await db
      .update(schema.forumThreads)
      .set({
        ...(parsed.data.locked !== undefined
          ? {
              lockedAt: parsed.data.locked ? new Date() : null,
              lockedByUserId: parsed.data.locked ? user.userId : null,
            }
          : {}),
        ...(parsed.data.pinned !== undefined ? { pinnedAt: parsed.data.pinned ? new Date() : null } : {}),
      })
      .where(eq(schema.forumThreads.id, threadId))

    if (parsed.data.locked) {
      await recordModerationAudit({
        actorUserId: user.userId,
        scopeType: 'organization',
        scopeId: orgId,
        verb: MODERATION_AUDIT_VERBS.threadLocked,
        targetType: 'forum_thread',
        targetId: threadId,
      })
    }

    return reply.send({ ok: true })
  })

  app.post(
    '/api/v1/organizations/:orgKey/channels/:channelId/messages/:messageId/hide',
    async (req, reply) => {
      if (!requireDb(reply)) return
      const user = requireUser(req, reply)
      if (!user) return
      const { orgKey, channelId, messageId } = req.params as {
        orgKey: string
        channelId: string
        messageId: string
      }
      const orgId = await resolveOrganizationId(orgKey)
      if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
      if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

      const [channel] = await db
        .select({ organizationId: schema.orgChannels.organizationId })
        .from(schema.orgChannels)
        .where(eq(schema.orgChannels.id, channelId))
        .limit(1)
      if (channel?.organizationId !== orgId) return reply.status(403).send({ error: 'Wrong org scope' })

      await db
        .update(schema.orgChannelMessages)
        .set({ hiddenAt: new Date(), hiddenByUserId: user.userId })
        .where(
          and(
            eq(schema.orgChannelMessages.id, messageId),
            eq(schema.orgChannelMessages.orgChannelId, channelId)
          )
        )

      await recordModerationAudit({
        actorUserId: user.userId,
        scopeType: 'organization',
        scopeId: orgId,
        verb: MODERATION_AUDIT_VERBS.contentHidden,
        targetType: 'org_channel_message',
        targetId: messageId,
      })

      return reply.send({ ok: true })
    }
  )

  const banBody = z.object({
    userId: z.string().uuid(),
    reason: z.string().max(2000).optional(),
    durationHours: z.number().int().min(1).max(24 * 365).optional(),
    escalateToPlatform: z.boolean().optional(),
  })

  app.post('/api/v1/organizations/:orgKey/bans', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const parsed = banBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null

    await db.insert(schema.scopeBans).values({
      scopeType: 'organization',
      scopeId: orgId,
      userId: parsed.data.userId,
      reason: parsed.data.reason ?? null,
      bannedByUserId: user.userId,
      active: true,
      expiresAt,
    })

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'organization',
      scopeId: orgId,
      verb: MODERATION_AUDIT_VERBS.scopeBanCreated,
      targetType: 'user',
      targetId: parsed.data.userId,
      payload: { reason: parsed.data.reason },
    })

    if (parsed.data.escalateToPlatform) {
      const [report] = await db
        .insert(schema.reports)
        .values({
          reporterId: user.userId,
          targetType: 'platform_organization',
          targetId: orgId,
          scopeType: 'organization',
          scopeId: orgId,
          category: 'safety',
          body: parsed.data.reason ?? 'Org ban escalated to platform',
        })
        .returning()
      await notifyModerationReportEscalated(report.id, 'platform_organization')
    }

    return reply.send({ ok: true })
  })

  app.delete('/api/v1/organizations/:orgKey/bans/:bannedUserId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, bannedUserId } = req.params as { orgKey: string; bannedUserId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    await db
      .update(schema.scopeBans)
      .set({ active: false })
      .where(
        and(
          eq(schema.scopeBans.scopeType, 'organization'),
          eq(schema.scopeBans.scopeId, orgId),
          eq(schema.scopeBans.userId, bannedUserId),
          eq(schema.scopeBans.active, true)
        )
      )

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'organization',
      scopeId: orgId,
      verb: MODERATION_AUDIT_VERBS.scopeBanRemoved,
      targetType: 'user',
      targetId: bannedUserId,
    })

    return reply.send({ ok: true })
  })

  app.get('/api/v1/organizations/:orgKey/moderation/audit', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'ADMIN', reply))) return

    const rows = await db
      .select()
      .from(schema.moderationAuditEvents)
      .where(
        and(
          eq(schema.moderationAuditEvents.scopeType, 'organization'),
          eq(schema.moderationAuditEvents.scopeId, orgId)
        )
      )
      .orderBy(desc(schema.moderationAuditEvents.createdAt))
      .limit(100)

    return reply.send({ items: rows })
  })

  app.get('/api/v1/organizations/:orgKey/bans', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })
    if (!(await requireOrgMinRole(orgId, user.userId, 'MODERATOR', reply))) return

    const rows = await db
      .select({
        id: schema.scopeBans.id,
        userId: schema.scopeBans.userId,
        username: schema.users.username,
        reason: schema.scopeBans.reason,
        createdAt: schema.scopeBans.createdAt,
      })
      .from(schema.scopeBans)
      .innerJoin(schema.users, eq(schema.scopeBans.userId, schema.users.id))
      .where(
        and(
          eq(schema.scopeBans.scopeType, 'organization'),
          eq(schema.scopeBans.scopeId, orgId),
          eq(schema.scopeBans.active, true)
        )
      )
      .orderBy(desc(schema.scopeBans.createdAt))

    return reply.send({ items: rows })
  })
}

export { isUserScopeBanned }
