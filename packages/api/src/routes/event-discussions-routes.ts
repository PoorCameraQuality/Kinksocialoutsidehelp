import { and, asc, desc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'

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

async function loadEvent(eventId: string) {
  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
  return row ?? null
}

async function viewerHasGoingRsvp(eventId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.eventRsvps.id })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.eventId, eventId),
        eq(schema.eventRsvps.userId, userId),
        eq(schema.eventRsvps.status, 'going')
      )
    )
    .limit(1)
  return Boolean(row)
}

async function canViewEventDiscussion(
  event: typeof schema.events.$inferSelect,
  viewerId: string | null
): Promise<boolean> {
  if (event.visibility === 'public') return true
  if (!viewerId) return false
  if (event.hostId === viewerId) return true
  return viewerHasGoingRsvp(event.id, viewerId)
}

async function canPostEventDiscussion(
  event: typeof schema.events.$inferSelect,
  viewerId: string
): Promise<boolean> {
  if (event.hostId === viewerId) return true
  return viewerHasGoingRsvp(event.id, viewerId)
}

export async function registerEventDiscussionRoutes(app: FastifyInstance) {
  app.get('/api/v1/events/:eventId/discussions/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid id' })
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewEventDiscussion(event, viewerId))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const rows = await db
      .select({
        id: schema.forumThreads.id,
        title: schema.forumThreads.title,
        authorId: schema.forumThreads.authorId,
        createdAt: schema.forumThreads.createdAt,
        updatedAt: schema.forumThreads.updatedAt,
        username: schema.users.username,
      })
      .from(schema.forumThreads)
      .innerJoin(schema.users, eq(schema.forumThreads.authorId, schema.users.id))
      .where(eq(schema.forumThreads.eventId, eventId))
      .orderBy(desc(schema.forumThreads.updatedAt))
      .limit(100)
    return reply.send({ items: rows })
  })

  const threadBody = z.object({
    title: z.string().min(1).max(512),
    body: z.string().min(1).max(20000),
  })

  app.post('/api/v1/events/:eventId/discussions/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid id' })
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Not found' })
    if (!(await canPostEventDiscussion(event, user.userId))) {
      return reply.status(403).send({ error: 'RSVP required to post' })
    }
    const parsed = threadBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        eventId,
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
    return reply.send({ thread, post })
  })

  app.get('/api/v1/events/:eventId/discussions/threads/:threadId/posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId, threadId } = req.params as { eventId: string; threadId: string }
    if (!UUID_RE.test(eventId) || !UUID_RE.test(threadId)) {
      return reply.status(400).send({ error: 'Invalid id' })
    }
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewEventDiscussion(event, viewerId))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.eventId, eventId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select({
        id: schema.forumPosts.id,
        body: schema.forumPosts.body,
        authorId: schema.forumPosts.authorId,
        createdAt: schema.forumPosts.createdAt,
        username: schema.users.username,
      })
      .from(schema.forumPosts)
      .innerJoin(schema.users, eq(schema.forumPosts.authorId, schema.users.id))
      .where(eq(schema.forumPosts.threadId, threadId))
      .orderBy(asc(schema.forumPosts.createdAt))
      .limit(200)
    return reply.send({ items: rows, thread })
  })

  const postBody = z.object({ body: z.string().min(1).max(20000) })

  app.post('/api/v1/events/:eventId/discussions/threads/:threadId/posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, threadId } = req.params as { eventId: string; threadId: string }
    if (!UUID_RE.test(eventId) || !UUID_RE.test(threadId)) {
      return reply.status(400).send({ error: 'Invalid id' })
    }
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Not found' })
    if (!(await canPostEventDiscussion(event, user.userId))) {
      return reply.status(403).send({ error: 'RSVP required to reply' })
    }
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.eventId, eventId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const parsed = postBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [post] = await db
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
    return reply.send({ post })
  })
}
