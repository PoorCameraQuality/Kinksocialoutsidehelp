import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { getGroupMembership, resolveGroupManagerRole } from '../lib/group-access.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolveGroupId(groupKey: string): Promise<string | null> {
  if (UUID_RE.test(groupKey)) return groupKey
  return null
}

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

export async function registerGroupModerationRoutes(app: FastifyInstance) {
  app.get('/api/v1/groups/:groupId/reports', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey } = req.params as { groupId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

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
          eq(schema.reports.scopeType, 'group'),
          eq(schema.reports.scopeId, groupId),
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

  app.patch('/api/v1/groups/:groupId/reports/:reportId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey, reportId } = req.params as { groupId: string; reportId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const parsed = patchReportBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [updated] = await db
      .update(schema.reports)
      .set({ status: parsed.data.status })
      .where(
        and(
          eq(schema.reports.id, reportId),
          eq(schema.reports.scopeType, 'group'),
          eq(schema.reports.scopeId, groupId)
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
      scopeType: 'group',
      scopeId: groupId,
      verb: MODERATION_AUDIT_VERBS.reportTriaged,
      targetType: 'report',
      targetId: reportId,
      payload: { status: parsed.data.status, note: parsed.data.note },
    })

    return reply.send({ report: updated })
  })

  app.post('/api/v1/groups/:groupId/forum/posts/:postId/hide', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey, postId } = req.params as { groupId: string; postId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const [post] = await db
      .select({ threadId: schema.forumPosts.threadId })
      .from(schema.forumPosts)
      .where(eq(schema.forumPosts.id, postId))
      .limit(1)
    if (!post) return reply.status(404).send({ error: 'Post not found' })

    const [thread] = await db
      .select({ groupId: schema.forumThreads.groupId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, post.threadId))
      .limit(1)
    if (thread?.groupId !== groupId) return reply.status(403).send({ error: 'Wrong group scope' })

    await db
      .update(schema.forumPosts)
      .set({ hiddenAt: new Date(), hiddenByUserId: user.userId })
      .where(eq(schema.forumPosts.id, postId))

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'group',
      scopeId: groupId,
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

  app.post('/api/v1/groups/:groupId/forum/threads/:threadId/moderate', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey, threadId } = req.params as { groupId: string; threadId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const parsed = threadModBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [thread] = await db
      .select({ groupId: schema.forumThreads.groupId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, threadId))
      .limit(1)
    if (thread?.groupId !== groupId) return reply.status(403).send({ error: 'Wrong group scope' })

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
        scopeType: 'group',
        scopeId: groupId,
        verb: MODERATION_AUDIT_VERBS.threadLocked,
        targetType: 'forum_thread',
        targetId: threadId,
      })
    }

    return reply.send({ ok: true })
  })

  const banBody = z.object({
    userId: z.string().uuid(),
    reason: z.string().max(2000).optional(),
    durationHours: z.number().int().min(1).max(24 * 365).optional(),
    escalateToPlatform: z.boolean().optional(),
  })

  app.post('/api/v1/groups/:groupId/bans', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey } = req.params as { groupId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const parsed = banBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const expiresAt = parsed.data.durationHours
      ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
      : null

    await db.insert(schema.scopeBans).values({
      scopeType: 'group',
      scopeId: groupId,
      userId: parsed.data.userId,
      reason: parsed.data.reason ?? null,
      bannedByUserId: user.userId,
      active: true,
      expiresAt,
    })

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'group',
      scopeId: groupId,
      verb: MODERATION_AUDIT_VERBS.scopeBanCreated,
      targetType: 'user',
      targetId: parsed.data.userId,
      payload: { reason: parsed.data.reason, durationHours: parsed.data.durationHours },
    })

    if (parsed.data.escalateToPlatform) {
      const { notifyModerationReportEscalated } = await import('../lib/moderation-notify.js')
      const [report] = await db
        .insert(schema.reports)
        .values({
          reporterId: user.userId,
          targetType: 'platform_group',
          targetId: groupId,
          scopeType: 'group',
          scopeId: groupId,
          category: 'safety',
          body: parsed.data.reason ?? 'Group ban escalated to platform',
        })
        .returning()
      await notifyModerationReportEscalated(report.id, 'platform_group').catch(() => {})
    }

    return reply.send({ ok: true })
  })

  app.delete('/api/v1/groups/:groupId/bans/:bannedUserId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey, bannedUserId } = req.params as { groupId: string; bannedUserId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    await db
      .update(schema.scopeBans)
      .set({ active: false })
      .where(
        and(
          eq(schema.scopeBans.scopeType, 'group'),
          eq(schema.scopeBans.scopeId, groupId),
          eq(schema.scopeBans.userId, bannedUserId),
          eq(schema.scopeBans.active, true)
        )
      )

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'group',
      scopeId: groupId,
      verb: MODERATION_AUDIT_VERBS.scopeBanRemoved,
      targetType: 'user',
      targetId: bannedUserId,
    })

    return reply.send({ ok: true })
  })

  app.get('/api/v1/groups/:groupId/moderation/audit', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey } = req.params as { groupId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const rows = await db
      .select()
      .from(schema.moderationAuditEvents)
      .where(
        and(
          eq(schema.moderationAuditEvents.scopeType, 'group'),
          eq(schema.moderationAuditEvents.scopeId, groupId)
        )
      )
      .orderBy(desc(schema.moderationAuditEvents.createdAt))
      .limit(100)

    return reply.send({ items: rows })
  })

  app.get('/api/v1/groups/:groupId/bans', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId: groupKey } = req.params as { groupId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Group not found' })
    if (!(await canModerateGroup(groupId, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

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
          eq(schema.scopeBans.scopeType, 'group'),
          eq(schema.scopeBans.scopeId, groupId),
          eq(schema.scopeBans.active, true)
        )
      )
      .orderBy(desc(schema.scopeBans.createdAt))

    return reply.send({ items: rows })
  })
}
