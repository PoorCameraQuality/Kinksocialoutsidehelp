import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { viewerCanPatchEvent } from '../lib/virtual-event-join-visibility.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function loadEvent(eventId: string) {
  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
  return row ?? null
}

async function canModerateEvent(
  event: typeof schema.events.$inferSelect,
  userId: string
): Promise<boolean> {
  if (event.hostId === userId) return true
  return viewerCanPatchEvent(userId, event)
}

export async function registerEventModerationRoutes(app: FastifyInstance) {
  app.post('/api/v1/events/:eventId/forum/posts/:postId/hide', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, postId } = req.params as { eventId: string; postId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid id' })
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (!(await canModerateEvent(event, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const [post] = await db
      .select({ id: schema.forumPosts.id, threadId: schema.forumPosts.threadId })
      .from(schema.forumPosts)
      .where(eq(schema.forumPosts.id, postId))
      .limit(1)
    if (!post) return reply.status(404).send({ error: 'Post not found' })

    const [thread] = await db
      .select({ eventId: schema.forumThreads.eventId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, post.threadId))
      .limit(1)
    if (thread?.eventId !== eventId) return reply.status(403).send({ error: 'Wrong event scope' })

    await db
      .update(schema.forumPosts)
      .set({ hiddenAt: new Date(), hiddenByUserId: user.userId })
      .where(eq(schema.forumPosts.id, postId))

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'event',
      scopeId: eventId,
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

  app.post('/api/v1/events/:eventId/forum/threads/:threadId/moderate', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, threadId } = req.params as { eventId: string; threadId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid id' })
    const event = await loadEvent(eventId)
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (!(await canModerateEvent(event, user.userId))) return reply.status(403).send({ error: 'Forbidden' })

    const parsed = threadModBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [thread] = await db
      .select({ eventId: schema.forumThreads.eventId })
      .from(schema.forumThreads)
      .where(eq(schema.forumThreads.id, threadId))
      .limit(1)
    if (thread?.eventId !== eventId) return reply.status(403).send({ error: 'Wrong event scope' })

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
        scopeType: 'event',
        scopeId: eventId,
        verb: MODERATION_AUDIT_VERBS.threadLocked,
        targetType: 'forum_thread',
        targetId: threadId,
      })
    }

    return reply.send({ ok: true })
  })
}
