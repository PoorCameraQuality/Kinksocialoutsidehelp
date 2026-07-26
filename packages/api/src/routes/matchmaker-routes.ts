import { and, eq, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'

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

/** Simple overlap score for JSON answers (numeric or string arrays). */
function scoreAnswers(a: unknown, b: unknown): number {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return 0
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  let score = 0
  let keys = 0
  for (const k of Object.keys(ao)) {
    if (!(k in bo)) continue
    keys++
    const x = ao[k]
    const y = bo[k]
    if (Array.isArray(x) && Array.isArray(y)) {
      const xs = new Set(x.map(String))
      const overlap = y.filter((v) => xs.has(String(v))).length
      score += overlap / Math.max(1, Math.max(xs.size, y.length))
    } else if (typeof x === 'number' && typeof y === 'number') {
      score += 1 - Math.min(1, Math.abs(x - y) / 5)
    } else if (x === y) {
      score += 1
    }
  }
  if (keys === 0) return 0
  return score / keys
}

function orderedPair(a: string, b: string): { userLow: string; userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a }
}

export async function registerMatchmakerRoutes(app: FastifyInstance) {
  app.get('/api/v1/events/:eventId/matchmaker', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [settings] = await db
      .select()
      .from(schema.eventMatchmakerSettings)
      .where(eq(schema.eventMatchmakerSettings.eventId, eventId))
      .limit(1)
    return reply.send({ settings: settings ?? { eventId, enabled: false, formSchema: {} } })
  })

  const settingsBody = z.object({
    enabled: z.boolean(),
    formSchema: z.record(z.string(), z.unknown()).optional(),
  })

  app.put('/api/v1/events/:eventId/matchmaker/settings', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (ev.hostId !== user.userId && ev.organizationId) {
      const [m] = await db
        .select({ role: schema.organizationMembers.role })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, ev.organizationId),
            eq(schema.organizationMembers.userId, user.userId)
          )
        )
        .limit(1)
      const rank: Record<string, number> = { OWNER: 5, ADMIN: 4, MODERATOR: 3, STAFF: 2, MEMBER: 1 }
      if (!m || (rank[m.role] ?? 0) < 3) return reply.status(403).send({ error: 'Forbidden' })
    } else if (ev.hostId !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = settingsBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.eventMatchmakerSettings)
      .values({
        eventId,
        enabled: parsed.data.enabled,
        formSchema: (parsed.data.formSchema ?? {}) as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.eventMatchmakerSettings.eventId,
        set: {
          enabled: parsed.data.enabled,
          formSchema: (parsed.data.formSchema ?? {}) as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })
    return reply.send({ ok: true })
  })

  const responseBody = z.object({
    answers: z.record(z.string(), z.unknown()),
  })

  app.put('/api/v1/events/:eventId/matchmaker/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [settings] = await db
      .select()
      .from(schema.eventMatchmakerSettings)
      .where(eq(schema.eventMatchmakerSettings.eventId, eventId))
      .limit(1)
    if (!settings?.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    const parsed = responseBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.eventMatchmakerResponses)
      .values({
        eventId,
        userId: user.userId,
        answers: parsed.data.answers,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.eventMatchmakerResponses.eventId, schema.eventMatchmakerResponses.userId],
        set: {
          answers: parsed.data.answers,
          updatedAt: new Date(),
        },
      })
    return reply.send({ ok: true })
  })

  const swipeBody = z.object({
    targetId: z.string().uuid(),
    liked: z.boolean(),
  })

  app.post('/api/v1/events/:eventId/matchmaker/swipe', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const parsed = swipeBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.targetId === user.userId) return reply.status(400).send({ error: 'Invalid target' })
    const [settings] = await db
      .select()
      .from(schema.eventMatchmakerSettings)
      .where(eq(schema.eventMatchmakerSettings.eventId, eventId))
      .limit(1)
    if (!settings?.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    await db
      .insert(schema.eventMatchmakerSwipes)
      .values({
        eventId,
        actorId: user.userId,
        targetId: parsed.data.targetId,
        liked: parsed.data.liked,
      })
      .onConflictDoUpdate({
        target: [
          schema.eventMatchmakerSwipes.eventId,
          schema.eventMatchmakerSwipes.actorId,
          schema.eventMatchmakerSwipes.targetId,
        ],
        set: { liked: parsed.data.liked },
      })
    if (parsed.data.liked) {
      const [reverse] = await db
        .select()
        .from(schema.eventMatchmakerSwipes)
        .where(
          and(
            eq(schema.eventMatchmakerSwipes.eventId, eventId),
            eq(schema.eventMatchmakerSwipes.actorId, parsed.data.targetId),
            eq(schema.eventMatchmakerSwipes.targetId, user.userId),
            eq(schema.eventMatchmakerSwipes.liked, true)
          )
        )
        .limit(1)
      if (reverse) {
        const pair = orderedPair(user.userId, parsed.data.targetId)
        try {
          await db.insert(schema.eventMatchmakerMatches).values({
            eventId,
            userLow: pair.userLow,
            userHigh: pair.userHigh,
          })
        } catch {
          /* duplicate */
        }
        return reply.send({ ok: true, matched: true })
      }
    }
    return reply.send({ ok: true, matched: false })
  })

  app.get('/api/v1/events/:eventId/matchmaker/deck', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [settings] = await db
      .select()
      .from(schema.eventMatchmakerSettings)
      .where(eq(schema.eventMatchmakerSettings.eventId, eventId))
      .limit(1)
    if (!settings?.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    const [me] = await db
      .select()
      .from(schema.eventMatchmakerResponses)
      .where(
        and(
          eq(schema.eventMatchmakerResponses.eventId, eventId),
          eq(schema.eventMatchmakerResponses.userId, user.userId)
        )
      )
      .limit(1)
    if (!me) return reply.status(400).send({ error: 'Submit your profile first' })
    const others = await db
      .select({
        userId: schema.eventMatchmakerResponses.userId,
        answers: schema.eventMatchmakerResponses.answers,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.eventMatchmakerResponses)
      .innerJoin(schema.users, eq(schema.eventMatchmakerResponses.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          eq(schema.eventMatchmakerResponses.eventId, eventId),
          ne(schema.eventMatchmakerResponses.userId, user.userId)
        )
      )
      .limit(50)
    const swiped = await db
      .select({ targetId: schema.eventMatchmakerSwipes.targetId })
      .from(schema.eventMatchmakerSwipes)
      .where(
        and(
          eq(schema.eventMatchmakerSwipes.eventId, eventId),
          eq(schema.eventMatchmakerSwipes.actorId, user.userId)
        )
      )
    const swipedSet = new Set(swiped.map((s) => s.targetId))
    const deck = others
      .filter((o) => !swipedSet.has(o.userId))
      .map((o) => ({
        userId: o.userId,
        username: o.username,
        displayName: o.displayName,
        avatarUrl: o.avatarUrl,
        matchScore: scoreAnswers(me.answers, o.answers),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
    return reply.send({ items: deck.slice(0, 20) })
  })
}
