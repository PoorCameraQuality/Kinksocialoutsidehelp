/**
 * Play-space lounge channels + aggregated “my chat rooms” for Dancecard Messages.
 */
import { and, asc, count, desc, eq, gt, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { db, schema } from '../db/index.js'
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

async function requireExistingDbUser(req: FastifyRequest, reply: FastifyReply) {
  const actor = requireAuthenticatedDbUser(req, reply)
  if (!actor) return null
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, actor.userId), isNull(schema.users.deletedAt)))
    .limit(1)
  if (!rows[0]) {
    reply.status(401).send({ error: 'Session user is missing. Sign out and sign back in.' })
    return null
  }
  return actor
}

async function loadSpaceByKey(key: string) {
  const bySlug = await db
    .select()
    .from(schema.playSpaces)
    .where(eq(schema.playSpaces.slug, key.toLowerCase()))
    .limit(1)
  if (bySlug[0]) return bySlug[0]
  if (!z.string().uuid().safeParse(key).success) return null
  const byId = await db.select().from(schema.playSpaces).where(eq(schema.playSpaces.id, key)).limit(1)
  return byId[0] ?? null
}

async function requireMember(
  req: FastifyRequest,
  reply: FastifyReply,
  space: typeof schema.playSpaces.$inferSelect,
) {
  const actor = await requireExistingDbUser(req, reply)
  if (!actor) return null
  const [m] = await db
    .select()
    .from(schema.playSpaceMembers)
    .where(
      and(
        eq(schema.playSpaceMembers.playSpaceId, space.id),
        eq(schema.playSpaceMembers.userId, actor.userId),
      ),
    )
    .limit(1)
  if (!m) {
    reply.status(403).send({ error: 'Join this play space to continue' })
    return null
  }
  return { userId: actor.userId, role: m.role }
}

async function ensurePlaySpaceChannels(playSpaceId: string) {
  let rows = await db
    .select()
    .from(schema.playSpaceHubChannels)
    .where(eq(schema.playSpaceHubChannels.playSpaceId, playSpaceId))
    .orderBy(asc(schema.playSpaceHubChannels.sortOrder), asc(schema.playSpaceHubChannels.name))
  if (rows.length === 0) {
    await db.insert(schema.playSpaceHubChannels).values([
      {
        playSpaceId,
        slug: 'general',
        name: 'General',
        kind: 'CHAT',
        sortOrder: 0,
      },
      {
        playSpaceId,
        slug: 'announcements',
        name: 'Announcements',
        kind: 'ANNOUNCEMENTS',
        sortOrder: 1,
      },
    ])
    rows = await db
      .select()
      .from(schema.playSpaceHubChannels)
      .where(eq(schema.playSpaceHubChannels.playSpaceId, playSpaceId))
      .orderBy(asc(schema.playSpaceHubChannels.sortOrder), asc(schema.playSpaceHubChannels.name))
  }
  return rows
}

async function unreadForPlayChannel(userId: string, channelId: string): Promise<number> {
  const [read] = await db
    .select({ lastReadAt: schema.playSpaceHubChannelReads.lastReadAt })
    .from(schema.playSpaceHubChannelReads)
    .where(
      and(
        eq(schema.playSpaceHubChannelReads.userId, userId),
        eq(schema.playSpaceHubChannelReads.channelId, channelId),
      ),
    )
    .limit(1)
  const since = read?.lastReadAt ?? new Date(0)
  const [row] = await db
    .select({ n: count() })
    .from(schema.playSpaceHubChannelMessages)
    .where(
      and(
        eq(schema.playSpaceHubChannelMessages.channelId, channelId),
        gt(schema.playSpaceHubChannelMessages.createdAt, since),
      ),
    )
  return Number(row?.n ?? 0)
}

async function unreadForConventionHubChannel(userId: string, channelId: string): Promise<number> {
  const [read] = await db
    .select({ lastReadAt: schema.conventionHubChannelReads.lastReadAt })
    .from(schema.conventionHubChannelReads)
    .where(
      and(
        eq(schema.conventionHubChannelReads.userId, userId),
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
  return Number(row?.n ?? 0)
}

export async function registerPlaySpaceHubChannelsRoutes(app: FastifyInstance) {
  /** Aggregated rooms for Dancecard Chat & Messages. */
  app.get('/api/v1/me/chat-rooms', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return

    const items: Array<{
      scope: 'play-space' | 'convention'
      key: string
      title: string
      href: string
      channels: Array<{
        id: string
        slug: string
        name: string
        kind: string
        unreadCount: number
      }>
    }> = []

    const memberships = await db
      .select({
        id: schema.playSpaces.id,
        slug: schema.playSpaces.slug,
        title: schema.playSpaces.title,
      })
      .from(schema.playSpaceMembers)
      .innerJoin(schema.playSpaces, eq(schema.playSpaceMembers.playSpaceId, schema.playSpaces.id))
      .where(eq(schema.playSpaceMembers.userId, actor.userId))
      .orderBy(asc(schema.playSpaces.title))

    for (const space of memberships) {
      const channels = await ensurePlaySpaceChannels(space.id)
      const mapped = await Promise.all(
        channels.map(async (c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          kind: c.kind,
          unreadCount: await unreadForPlayChannel(actor.userId, c.id),
        })),
      )
      items.push({
        scope: 'play-space',
        key: space.slug,
        title: space.title,
        href: `/play/${encodeURIComponent(space.slug)}`,
        channels: mapped,
      })
    }

    const pins = await db
      .select({
        slug: schema.conventions.slug,
        name: schema.conventions.name,
        conventionId: schema.conventions.id,
      })
      .from(schema.conventionPins)
      .innerJoin(schema.conventions, eq(schema.conventionPins.conventionId, schema.conventions.id))
      .where(eq(schema.conventionPins.userId, actor.userId))
      .orderBy(desc(schema.conventionPins.pinnedAt))

    for (const pin of pins) {
      const resolved = await getConventionWithAccess(pin.slug, actor.userId)
      if ('notFound' in resolved || 'forbidden' in resolved || !resolved.canView) continue
      const hubRows = await db
        .select()
        .from(schema.conventionHubChannels)
        .where(eq(schema.conventionHubChannels.conventionId, pin.conventionId))
        .orderBy(asc(schema.conventionHubChannels.sortOrder), asc(schema.conventionHubChannels.name))
      const mapped = await Promise.all(
        hubRows.map(async (c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          kind: c.kind,
          unreadCount: await unreadForConventionHubChannel(actor.userId, c.id),
        })),
      )
      items.push({
        scope: 'convention',
        key: pin.slug,
        title: pin.name,
        href: `/conventions/${encodeURIComponent(pin.slug)}?tab=Chat`,
        channels: mapped,
      })
    }

    return reply.send({ items })
  })

  app.get('/api/v1/play-spaces/:key/hub-channels', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const rows = await ensurePlaySpaceChannels(space.id)
    return reply.send({
      source: 'play-space',
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        sortOrder: r.sortOrder,
      })),
    })
  })

  app.get('/api/v1/play-spaces/:key/hub-channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [ch] = await db
      .select()
      .from(schema.playSpaceHubChannels)
      .where(
        and(
          eq(schema.playSpaceHubChannels.id, channelId),
          eq(schema.playSpaceHubChannels.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    const rows = await db
      .select({
        id: schema.playSpaceHubChannelMessages.id,
        body: schema.playSpaceHubChannelMessages.body,
        parentMessageId: schema.playSpaceHubChannelMessages.parentMessageId,
        createdAt: schema.playSpaceHubChannelMessages.createdAt,
        senderId: schema.playSpaceHubChannelMessages.senderId,
        username: schema.users.username,
      })
      .from(schema.playSpaceHubChannelMessages)
      .innerJoin(schema.users, eq(schema.playSpaceHubChannelMessages.senderId, schema.users.id))
      .where(eq(schema.playSpaceHubChannelMessages.channelId, channelId))
      .orderBy(asc(schema.playSpaceHubChannelMessages.createdAt))
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

  app.post('/api/v1/play-spaces/:key/hub-channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ body: z.string().min(1).max(8000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [ch] = await db
      .select()
      .from(schema.playSpaceHubChannels)
      .where(
        and(
          eq(schema.playSpaceHubChannels.id, channelId),
          eq(schema.playSpaceHubChannels.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    if (ch.kind === 'ANNOUNCEMENTS' && member.role !== 'owner') {
      return reply.status(403).send({ error: 'Only the space owner can post announcements' })
    }
    const [row] = await db
      .insert(schema.playSpaceHubChannelMessages)
      .values({
        channelId,
        senderId: actor.userId,
        body: parsed.data.body.trim(),
      })
      .returning()
    return reply.status(201).send({ message: row })
  })

  app.post(
    '/api/v1/play-spaces/:key/hub-channels/:channelId/messages/:messageId/replies',
    async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = await requireExistingDbUser(req, reply)
      if (!actor) return
      const { key, channelId, messageId } = req.params as {
        key: string
        channelId: string
        messageId: string
      }
      if (!UUID_RE.test(channelId) || !UUID_RE.test(messageId)) {
        return reply.status(400).send({ error: 'Invalid id' })
      }
      const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
      const space = await loadSpaceByKey(key)
      if (!space) return reply.status(404).send({ error: 'Play space not found' })
      const member = await requireMember(req, reply, space)
      if (!member) return
      const [parent] = await db
        .select()
        .from(schema.playSpaceHubChannelMessages)
        .where(
          and(
            eq(schema.playSpaceHubChannelMessages.id, messageId),
            eq(schema.playSpaceHubChannelMessages.channelId, channelId),
          ),
        )
        .limit(1)
      if (!parent) return reply.status(404).send({ error: 'Parent not found' })
      const [row] = await db
        .insert(schema.playSpaceHubChannelMessages)
        .values({
          channelId,
          senderId: actor.userId,
          body: parsed.data.body.trim(),
          parentMessageId: messageId,
        })
        .returning()
      return reply.status(201).send({ message: row })
    },
  )

  app.post('/api/v1/play-spaces/:key/hub-channels/:channelId/mark-read', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    await db
      .insert(schema.playSpaceHubChannelReads)
      .values({ userId: actor.userId, channelId, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.playSpaceHubChannelReads.userId, schema.playSpaceHubChannelReads.channelId],
        set: { lastReadAt: new Date() },
      })
    return reply.send({ ok: true })
  })
}
