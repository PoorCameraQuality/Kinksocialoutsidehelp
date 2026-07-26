/**
 * Convention hub channels (C212) - chat/announcements scoped to a convention, not org_channels.
 */
import { and, asc, count, eq, gt } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { MODERATION_AUDIT_VERBS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { filterPinnedUsersForHubPush } from '../lib/hub-push-preferences.js'
import { sendWebPushToUsers } from '../lib/web-push-send.js'
import { requireHubConventionMutation, userHasHubConventionRead } from '../lib/convention-command-access.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { getConventionWithAccess } from './conventions-routes.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
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

export async function registerConventionHubChannelsRoutes(app: FastifyInstance) {
  app.get('/api/v1/conventions/:key/hub-channels', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const resolved = await getConventionWithAccess(key, userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Registration required' })
    let rows = await db
      .select()
      .from(schema.conventionHubChannels)
      .where(eq(schema.conventionHubChannels.conventionId, resolved.conv.id))
      .orderBy(asc(schema.conventionHubChannels.sortOrder), asc(schema.conventionHubChannels.name))
    if (
      rows.length === 0 &&
      userId &&
      ((await userHasHubConventionRead(resolved.conv, userId, 'staff_ops')) || resolved.isStaff)
    ) {
      await db.insert(schema.conventionHubChannels).values([
        {
          conventionId: resolved.conv.id,
          slug: 'general',
          name: 'General',
          kind: 'CHAT',
          sortOrder: 0,
        },
        {
          conventionId: resolved.conv.id,
          slug: 'announcements',
          name: 'Announcements',
          kind: 'ANNOUNCEMENTS',
          sortOrder: 1,
        },
      ])
      rows = await db
        .select()
        .from(schema.conventionHubChannels)
        .where(eq(schema.conventionHubChannels.conventionId, resolved.conv.id))
        .orderBy(asc(schema.conventionHubChannels.sortOrder), asc(schema.conventionHubChannels.name))
    }
    return reply.send({
      source: 'hub',
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        sortOrder: r.sortOrder,
      })),
    })
  })

  app.post('/api/v1/conventions/:key/hub-channels', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        slug: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        kind: z.enum(['CHAT', 'ANNOUNCEMENTS']).optional(),
        sortOrder: z.number().int().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.isStaff) {
      if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'staff_ops'))) return
    }
    const [row] = await db
      .insert(schema.conventionHubChannels)
      .values({
        conventionId: resolved.conv.id,
        slug: parsed.data.slug.trim().toLowerCase(),
        name: parsed.data.name.trim(),
        kind: parsed.data.kind ?? 'CHAT',
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send({ channel: row })
  })

  app.get('/api/v1/conventions/:key/hub-channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const resolved = await getConventionWithAccess(key, userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    const [ch] = await db
      .select()
      .from(schema.conventionHubChannels)
      .where(
        and(
          eq(schema.conventionHubChannels.id, channelId),
          eq(schema.conventionHubChannels.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    const rows = await db
      .select({
        id: schema.conventionHubChannelMessages.id,
        body: schema.conventionHubChannelMessages.body,
        parentMessageId: schema.conventionHubChannelMessages.parentMessageId,
        createdAt: schema.conventionHubChannelMessages.createdAt,
        senderId: schema.conventionHubChannelMessages.senderId,
        username: schema.users.username,
      })
      .from(schema.conventionHubChannelMessages)
      .innerJoin(schema.users, eq(schema.conventionHubChannelMessages.senderId, schema.users.id))
      .where(eq(schema.conventionHubChannelMessages.channelId, channelId))
      .orderBy(asc(schema.conventionHubChannelMessages.createdAt))
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        body: r.body,
        parentMessageId: r.parentMessageId,
        createdAt: r.createdAt,
        sender: { id: r.senderId, username: r.username },
      })),
    })
  })

  app.post('/api/v1/conventions/:key/hub-channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ body: z.string().min(1).max(8000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    const [ch] = await db
      .select()
      .from(schema.conventionHubChannels)
      .where(
        and(
          eq(schema.conventionHubChannels.id, channelId),
          eq(schema.conventionHubChannels.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    if (
      ch.kind === 'ANNOUNCEMENTS' &&
      !(await userHasHubConventionRead(resolved.conv, actor.userId, 'staff_ops')) &&
      !resolved.isStaff
    ) {
      return reply.status(403).send({ error: 'Staff only in announcements' })
    }
    const bodyText = parsed.data.body.trim()
    const [row] = await db
      .insert(schema.conventionHubChannelMessages)
      .values({
        channelId,
        senderId: actor.userId,
        body: bodyText,
      })
      .returning()
    if (ch.kind === 'ANNOUNCEMENTS' || ch.kind === 'CHAT') {
      const pushEnabled =
        ch.kind === 'ANNOUNCEMENTS'
          ? process.env.C2K_PUSH_ANNOUNCEMENTS !== 'false'
          : process.env.C2K_PUSH_CHAT !== 'false'
      if (pushEnabled) {
        const pins = await db
          .select({ userId: schema.conventionPins.userId })
          .from(schema.conventionPins)
          .where(eq(schema.conventionPins.conventionId, resolved.conv.id))
        const pinned = pins.map((p) => p.userId).filter((id) => id !== actor.userId)
        const channel = ch.kind === 'ANNOUNCEMENTS' ? 'announcements' : 'chat'
        const targets = await filterPinnedUsersForHubPush(pinned, channel)
        const webBase = (process.env.C2K_PUBLIC_WEB_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
        const tab = ch.kind === 'ANNOUNCEMENTS' ? 'Announcements' : 'Chat'
        void sendWebPushToUsers(targets, {
          title: `${resolved.conv.name}: ${ch.kind === 'ANNOUNCEMENTS' ? 'Announcement' : ch.name}`,
          body: bodyText.slice(0, 160),
          url: `${webBase}/conventions/${encodeURIComponent(resolved.conv.slug)}?tab=${tab}`,
        })
      }
    }
    return reply.status(201).send({ message: row })
  })

  app.post('/api/v1/conventions/:key/hub-channels/:channelId/messages/:messageId/replies', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, channelId, messageId } = req.params as {
      key: string
      channelId: string
      messageId: string
    }
    if (!UUID_RE.test(channelId) || !UUID_RE.test(messageId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    const [parent] = await db
      .select()
      .from(schema.conventionHubChannelMessages)
      .where(
        and(
          eq(schema.conventionHubChannelMessages.id, messageId),
          eq(schema.conventionHubChannelMessages.channelId, channelId),
        ),
      )
      .limit(1)
    if (!parent) return reply.status(404).send({ error: 'Parent not found' })
    const [row] = await db
      .insert(schema.conventionHubChannelMessages)
      .values({
        channelId,
        senderId: actor.userId,
        body: parsed.data.body.trim(),
        parentMessageId: messageId,
      })
      .returning()
    return reply.status(201).send({ message: row })
  })

  app.post('/api/v1/conventions/:key/hub-channels/:channelId/mark-read', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    await db
      .insert(schema.conventionHubChannelReads)
      .values({ userId: actor.userId, channelId, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.conventionHubChannelReads.userId, schema.conventionHubChannelReads.channelId],
        set: { lastReadAt: new Date() },
      })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/hub-channels/:channelId/unread-count', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    const [read] = await db
      .select({ lastReadAt: schema.conventionHubChannelReads.lastReadAt })
      .from(schema.conventionHubChannelReads)
      .where(
        and(
          eq(schema.conventionHubChannelReads.userId, actor.userId),
          eq(schema.conventionHubChannelReads.channelId, channelId),
        ),
      )
      .limit(1)
    const since = read?.lastReadAt ?? new Date(0)
    const [row] = await db
      .select({ n: count() })
      .from(schema.conventionHubChannelMessages)
      .where(
        and(
          eq(schema.conventionHubChannelMessages.channelId, channelId),
          gt(schema.conventionHubChannelMessages.createdAt, since),
        ),
      )
    return reply.send({ unreadCount: Number(row?.n ?? 0) })
  })

  app.post(
    '/api/v1/conventions/:key/hub-channels/:channelId/messages/:messageId/hide',
    async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = requireUser(req, reply)
      if (!actor) return
      const { key, channelId, messageId } = req.params as {
        key: string
        channelId: string
        messageId: string
      }
      if (!UUID_RE.test(channelId) || !UUID_RE.test(messageId)) {
        return reply.status(400).send({ error: 'Invalid id' })
      }
      const resolved = await getConventionWithAccess(key, actor.userId)
      if ('notFound' in resolved || 'forbidden' in resolved) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const isStaff =
        resolved.isStaff ||
        resolved.canManage ||
        (await userHasHubConventionRead(resolved.conv, actor.userId, 'staff_ops'))
      if (!isStaff) return reply.status(403).send({ error: 'Forbidden' })

      const [ch] = await db
        .select()
        .from(schema.conventionHubChannels)
        .where(
          and(
            eq(schema.conventionHubChannels.id, channelId),
            eq(schema.conventionHubChannels.conventionId, resolved.conv.id),
          ),
        )
        .limit(1)
      if (!ch) return reply.status(404).send({ error: 'Channel not found' })

      const [updated] = await db
        .update(schema.conventionHubChannelMessages)
        .set({ hiddenAt: new Date(), hiddenByUserId: actor.userId })
        .where(
          and(
            eq(schema.conventionHubChannelMessages.id, messageId),
            eq(schema.conventionHubChannelMessages.channelId, channelId),
          ),
        )
        .returning({ id: schema.conventionHubChannelMessages.id })

      if (!updated) return reply.status(404).send({ error: 'Message not found' })

      await recordModerationAudit({
        actorUserId: actor.userId,
        scopeType: 'convention',
        scopeId: resolved.conv.id,
        verb: MODERATION_AUDIT_VERBS.contentHidden,
        targetType: 'convention_hub_channel_message',
        targetId: messageId,
      })

      return reply.send({ ok: true })
    },
  )
}
