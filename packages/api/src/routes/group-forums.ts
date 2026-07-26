import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { shouldEmitGroupForumThreadFeedActivity, type GroupMemberListVisibility } from '@c2k/shared'
import { getModerationQueue } from '../lib/moderation-queue.js'
import { touchGroupActivity } from '../lib/group-activity.js'
import { emitActivity } from '../lib/feed-activities.js'
import { isUserScopeBanned } from '../lib/org-moderation-access.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

async function resolveGroupId(groupKey: string): Promise<string | null> {
  if (UUID_RE.test(groupKey)) return groupKey
  const [row] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.slug, groupKey))
    .limit(1)
  return row?.id ?? null
}

async function getGroupMembership(
  groupId: string,
  userId: string
): Promise<{ role: string } | null> {
  const [row] = await db
    .select({ role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1)
  return row ?? null
}

async function canViewGroup(
  g: typeof schema.groups.$inferSelect,
  viewerUserId: string | null
): Promise<boolean> {
  if (g.visibility === 'public') return true
  if (!viewerUserId) return false
  const m = await getGroupMembership(g.id, viewerUserId)
  return Boolean(m)
}

export async function registerGroupForumRoutes(app: FastifyInstance) {
  app.get('/api/v1/groups/:groupKey/forum/categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupKey } = req.params as { groupKey: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewGroup(g, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select()
      .from(schema.forumCategories)
      .where(eq(schema.forumCategories.groupId, groupId))
      .orderBy(asc(schema.forumCategories.sortOrder), asc(schema.forumCategories.name))
    return reply.send({ items: rows })
  })

  const forumCategoryBody = z.object({
    name: z.string().min(1).max(255),
    sortOrder: z.number().int().optional(),
  })
  app.post('/api/v1/groups/:groupKey/forum/categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupKey } = req.params as { groupKey: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const m = await getGroupMembership(groupId, user.userId)
    const canModerate =
      g.ownerId === user.userId ||
      (m && ['owner', 'admin', 'moderator'].includes(m.role.toLowerCase()))
    if (!canModerate) return reply.status(403).send({ error: 'Forbidden' })
    const parsed = forumCategoryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.forumCategories)
      .values({
        groupId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ category: row })
  })

  const forumCategoryPatchBody = z.object({
    name: z.string().min(1).max(255).optional(),
    sortOrder: z.number().int().optional(),
  })

  app.patch('/api/v1/groups/:groupKey/forum/categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupKey, categoryId } = req.params as { groupKey: string; categoryId: string }
    if (!UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const m = await getGroupMembership(groupId, user.userId)
    const canModerate =
      g.ownerId === user.userId ||
      (m && ['owner', 'admin', 'moderator'].includes(m.role.toLowerCase()))
    if (!canModerate) return reply.status(403).send({ error: 'Forbidden' })
    const parsed = forumCategoryPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [cat] = await db
      .select()
      .from(schema.forumCategories)
      .where(and(eq(schema.forumCategories.id, categoryId), eq(schema.forumCategories.groupId, groupId)))
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    const [updated] = await db
      .update(schema.forumCategories)
      .set({
        name: parsed.data.name ?? cat.name,
        sortOrder: parsed.data.sortOrder ?? cat.sortOrder,
      })
      .where(eq(schema.forumCategories.id, categoryId))
      .returning()
    return reply.send({ category: updated })
  })

  app.delete('/api/v1/groups/:groupKey/forum/categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupKey, categoryId } = req.params as { groupKey: string; categoryId: string }
    if (!UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const m = await getGroupMembership(groupId, user.userId)
    const canModerate =
      g.ownerId === user.userId ||
      (m && ['owner', 'admin', 'moderator'].includes(m.role.toLowerCase()))
    if (!canModerate) return reply.status(403).send({ error: 'Forbidden' })
    const [cat] = await db
      .select()
      .from(schema.forumCategories)
      .where(and(eq(schema.forumCategories.id, categoryId), eq(schema.forumCategories.groupId, groupId)))
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    await db.delete(schema.forumCategories).where(eq(schema.forumCategories.id, categoryId))
    return reply.send({ ok: true })
  })

  app.get('/api/v1/groups/:groupKey/forum/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupKey } = req.params as { groupKey: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    const q = req.query as { categoryId?: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewGroup(g, viewerId))) return reply.status(404).send({ error: 'Not found' })
    let whereClause: SQL = eq(schema.forumThreads.groupId, groupId)
    if (q.categoryId && UUID_RE.test(q.categoryId)) {
      whereClause = and(whereClause, eq(schema.forumThreads.categoryId, q.categoryId))!
    }
    const rows = await db
      .select({
        id: schema.forumThreads.id,
        title: schema.forumThreads.title,
        categoryId: schema.forumThreads.categoryId,
        authorId: schema.forumThreads.authorId,
        createdAt: schema.forumThreads.createdAt,
        updatedAt: schema.forumThreads.updatedAt,
        username: schema.users.username,
      })
      .from(schema.forumThreads)
      .innerJoin(schema.users, eq(schema.forumThreads.authorId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.forumThreads.updatedAt))
      .limit(100)
    return reply.send({ items: rows })
  })

  const forumThreadBody = z.object({
    title: z.string().min(1).max(512),
    categoryId: z.string().uuid().optional(),
    body: z.string().min(1).max(20000),
  })
  app.post('/api/v1/groups/:groupKey/forum/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupKey } = req.params as { groupKey: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId) return reply.status(404).send({ error: 'Not found' })
    if (!(await getGroupMembership(groupId, user.userId))) {
      return reply.status(403).send({ error: 'Members only' })
    }
    if (await isUserScopeBanned('group', groupId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this group' })
    }
    const parsed = forumThreadBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const [membership] = await db
      .select({
        role: schema.groupMembers.role,
        memberListVisibility: schema.groupMembers.memberListVisibility,
      })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        groupId,
        categoryId: parsed.data.categoryId,
        title: parsed.data.title,
        authorId: user.userId,
      })
      .returning()
    if (!thread) return reply.status(500).send({ error: 'Failed' })
    const [post] = await db
      .insert(schema.forumPosts)
      .values({
        threadId: thread.id,
        authorId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    try {
      await getModerationQueue().add('group_forum_post', {
        postId: post!.id,
        threadId: thread.id,
        groupId,
      })
    } catch {
      /* optional */
    }
    await touchGroupActivity(groupId)
    if (
      membership &&
      shouldEmitGroupForumThreadFeedActivity(
        {
          memberListVisibility: (membership.memberListVisibility ?? 'visible') as GroupMemberListVisibility,
        },
        membership.role,
      )
    ) {
      emitActivity({
        actorId: user.userId,
        verb: 'group_thread_created',
        objectType: 'forum_thread',
        objectId: thread.id,
        metadata: {
          groupId,
          groupName: g.name,
          groupSlug: g.slug,
          threadTitle: thread.title,
          groupVisibility: g.visibility,
        },
      })
    }
    return reply.send({ thread, post })
  })

  app.get('/api/v1/groups/:groupKey/forum/threads/:threadId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupKey, threadId } = req.params as { groupKey: string; threadId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId || !UUID_RE.test(threadId)) return reply.status(400).send({ error: 'Invalid id' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewGroup(g, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.groupId, groupId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const mem = viewerId ? await getGroupMembership(groupId, viewerId) : null
    const role = mem?.role?.toLowerCase() ?? ''
    const canSeeHidden = role === 'owner' || role === 'admin' || role === 'moderator'
    const postWhere = canSeeHidden
      ? eq(schema.forumPosts.threadId, threadId)
      : and(eq(schema.forumPosts.threadId, threadId), isNull(schema.forumPosts.hiddenAt))
    const posts = await db
      .select({
        id: schema.forumPosts.id,
        body: schema.forumPosts.body,
        authorId: schema.forumPosts.authorId,
        createdAt: schema.forumPosts.createdAt,
        hiddenAt: schema.forumPosts.hiddenAt,
        username: schema.users.username,
      })
      .from(schema.forumPosts)
      .innerJoin(schema.users, eq(schema.forumPosts.authorId, schema.users.id))
      .where(postWhere)
      .orderBy(asc(schema.forumPosts.createdAt))
    return reply.send({ thread, posts })
  })

  const forumPostBody = z.object({ body: z.string().min(1).max(20000) })
  app.post('/api/v1/groups/:groupKey/forum/threads/:threadId/posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupKey, threadId } = req.params as { groupKey: string; threadId: string }
    const groupId = await resolveGroupId(groupKey)
    if (!groupId || !UUID_RE.test(threadId)) return reply.status(400).send({ error: 'Invalid id' })
    const mem = await getGroupMembership(groupId, user.userId)
    if (!mem) return reply.status(403).send({ error: 'Members only' })
    if (await isUserScopeBanned('group', groupId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this group' })
    }
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.groupId, groupId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const role = mem.role?.toLowerCase() ?? ''
    const modBypass = role === 'owner' || role === 'admin' || role === 'moderator'
    if (thread.lockedAt && !modBypass) {
      return reply.status(403).send({ error: 'Thread is locked' })
    }
    const parsed = forumPostBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.forumPosts)
      .values({
        threadId,
        authorId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    await db
      .update(schema.forumThreads)
      .set({ updatedAt: new Date() })
      .where(eq(schema.forumThreads.id, threadId))
    await touchGroupActivity(groupId)
    return reply.send({ ok: true })
  })
}
