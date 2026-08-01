/**
 * Play Space ISO board + pickup-play matchmaker (Dancecard hub).
 */
import { and, asc, eq, isNull, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  DEFAULT_PICKUP_PLAY_FORM_SCHEMA,
  getIsoReadiness,
  MATCHMAKER_DECK_MIN_SCORE,
  buildMatchmakerDeckSummary,
} from '@c2k/shared'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { canViewerReadIsoVisibility, isoEligibleForConventionBoard } from '../lib/iso-access.js'

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

async function loadSpaceByKey(key: string) {
  const bySlug = await db
    .select()
    .from(schema.playSpaces)
    .where(eq(schema.playSpaces.slug, key.toLowerCase()))
    .limit(1)
  if (bySlug[0]) return bySlug[0]
  const uuidOk = z.string().uuid().safeParse(key)
  if (!uuidOk.success) return null
  const byId = await db.select().from(schema.playSpaces).where(eq(schema.playSpaces.id, key)).limit(1)
  return byId[0] ?? null
}

async function membership(spaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(schema.playSpaceMembers)
    .where(
      and(eq(schema.playSpaceMembers.playSpaceId, spaceId), eq(schema.playSpaceMembers.userId, userId)),
    )
    .limit(1)
  return rows[0] ?? null
}

async function requireMember(
  req: FastifyRequest,
  reply: FastifyReply,
  space: typeof schema.playSpaces.$inferSelect,
): Promise<{ userId: string; isOwner: boolean } | null> {
  const actor = requireAuthenticatedDbUser(req, reply)
  if (!actor) return null
  const m = await membership(space.id, actor.userId)
  if (!m && space.ownerUserId !== actor.userId) {
    reply.status(403).send({ error: 'Join this play space to use ISO and Matchmaker' })
    return null
  }
  return { userId: actor.userId, isOwner: space.ownerUserId === actor.userId || m?.role === 'owner' }
}

function orderedPair(a: string, b: string): { userLow: string; userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a }
}

async function ensureMatchmakerSettings(playSpaceId: string) {
  const [row] = await db
    .select()
    .from(schema.playSpaceMatchmakerSettings)
    .where(eq(schema.playSpaceMatchmakerSettings.playSpaceId, playSpaceId))
    .limit(1)
  if (row) return row
  await db
    .insert(schema.playSpaceMatchmakerSettings)
    .values({
      playSpaceId,
      enabled: true,
      formSchema: { ...DEFAULT_PICKUP_PLAY_FORM_SCHEMA },
    })
    .onConflictDoNothing()
  const [again] = await db
    .select()
    .from(schema.playSpaceMatchmakerSettings)
    .where(eq(schema.playSpaceMatchmakerSettings.playSpaceId, playSpaceId))
    .limit(1)
  return again ?? { playSpaceId, enabled: true, formSchema: { ...DEFAULT_PICKUP_PLAY_FORM_SCHEMA } }
}

export async function registerPlaySpaceIsoMatchmakerRoutes(app: FastifyInstance) {
  app.get('/api/v1/play-spaces/:key/iso-board', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!viewerId) return reply.status(401).send({ error: 'Unauthorized' })
    const m = await membership(space.id, viewerId)
    if (!m && space.ownerUserId !== viewerId) {
      return reply.status(403).send({ error: 'Join this play space to view the ISO board' })
    }
    const isOwner = space.ownerUserId === viewerId
    const listingConds = [
      eq(schema.playSpaceIsoListings.playSpaceId, space.id),
      ...(isOwner ? [] : [isNull(schema.playSpaceIsoListings.removedByStaffAt)]),
    ]
    const rows = await db
      .select({
        userId: schema.playSpaceIsoListings.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        body: schema.userIsoPosts.body,
        structured: schema.userIsoPosts.structured,
        visibility: schema.userIsoPosts.visibility,
        acceptDmsViaIso: schema.userIsoPosts.acceptDmsViaIso,
        removedByStaffAt: schema.playSpaceIsoListings.removedByStaffAt,
      })
      .from(schema.playSpaceIsoListings)
      .innerJoin(schema.users, eq(schema.users.id, schema.playSpaceIsoListings.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .innerJoin(schema.userIsoPosts, eq(schema.userIsoPosts.userId, schema.playSpaceIsoListings.userId))
      .where(and(...listingConds))
      .orderBy(asc(schema.playSpaceIsoListings.createdAt))

    const items = rows
      .filter((r) =>
        isoEligibleForConventionBoard(r.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
          viewerId,
          isOwner: r.userId === viewerId,
        }),
      )
      .filter((r) =>
        canViewerReadIsoVisibility(r.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
          viewerId,
          isOwner: r.userId === viewerId,
        }),
      )
      .map((r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        body: r.body,
        structured: r.structured ?? {},
        acceptDmsViaIso: r.acceptDmsViaIso,
        staffRemoved: Boolean(r.removedByStaffAt),
      }))

    return reply.send({ boardEnabled: true, items, canManage: isOwner })
  })

  app.get('/api/v1/play-spaces/:key/iso-board/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const [row] = await db
      .select({ id: schema.playSpaceIsoListings.id })
      .from(schema.playSpaceIsoListings)
      .where(
        and(
          eq(schema.playSpaceIsoListings.playSpaceId, space.id),
          eq(schema.playSpaceIsoListings.userId, actor.userId),
        ),
      )
      .limit(1)
    return reply.send({ listed: Boolean(row) })
  })

  app.put('/api/v1/play-spaces/:key/iso-board/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const parsed = z.object({ listed: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.listed) {
      const [iso] = await db
        .select()
        .from(schema.userIsoPosts)
        .where(eq(schema.userIsoPosts.userId, actor.userId))
        .limit(1)
      if (!iso) {
        return reply.status(400).send({ error: 'Save your ISO card before listing it on this board' })
      }
      if (iso.visibility === 'PRIVATE') {
        return reply.status(400).send({ error: 'Change visibility to Members or Public before listing' })
      }
      const readiness = getIsoReadiness(iso.structured, iso.body ?? '', iso.visibility)
      if (!readiness.canList) {
        return reply.status(400).send({
          error: readiness.missing.length
            ? `Finish the basics before listing: ${readiness.missing.join(', ')}`
            : 'Save a useful ISO card before listing it on this board',
        })
      }
      await db
        .insert(schema.playSpaceIsoListings)
        .values({ playSpaceId: space.id, userId: actor.userId })
        .onConflictDoNothing()
      await db
        .update(schema.playSpaceIsoListings)
        .set({ removedByStaffAt: null, removedByUserId: null })
        .where(
          and(
            eq(schema.playSpaceIsoListings.playSpaceId, space.id),
            eq(schema.playSpaceIsoListings.userId, actor.userId),
          ),
        )
    } else {
      await db
        .delete(schema.playSpaceIsoListings)
        .where(
          and(
            eq(schema.playSpaceIsoListings.playSpaceId, space.id),
            eq(schema.playSpaceIsoListings.userId, actor.userId),
          ),
        )
    }
    return reply.send({ ok: true, listed: parsed.data.listed })
  })

  app.get('/api/v1/play-spaces/:key/matchmaker', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const settings = await ensureMatchmakerSettings(space.id)
    return reply.send({
      settings: {
        playSpaceId: space.id,
        enabled: settings.enabled,
        formSchema: settings.formSchema ?? { ...DEFAULT_PICKUP_PLAY_FORM_SCHEMA },
      },
    })
  })

  app.put('/api/v1/play-spaces/:key/matchmaker/settings', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    if (!actor.isOwner) return reply.status(403).send({ error: 'Only the space owner can change matchmaker settings' })
    const parsed = z
      .object({
        enabled: z.boolean(),
        formSchema: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.playSpaceMatchmakerSettings)
      .values({
        playSpaceId: space.id,
        enabled: parsed.data.enabled,
        formSchema: (parsed.data.formSchema ?? { ...DEFAULT_PICKUP_PLAY_FORM_SCHEMA }) as Record<
          string,
          unknown
        >,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.playSpaceMatchmakerSettings.playSpaceId,
        set: {
          enabled: parsed.data.enabled,
          formSchema: (parsed.data.formSchema ?? { ...DEFAULT_PICKUP_PLAY_FORM_SCHEMA }) as Record<
            string,
            unknown
          >,
          updatedAt: new Date(),
        },
      })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/play-spaces/:key/matchmaker/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const [row] = await db
      .select()
      .from(schema.playSpaceMatchmakerResponses)
      .where(
        and(
          eq(schema.playSpaceMatchmakerResponses.playSpaceId, space.id),
          eq(schema.playSpaceMatchmakerResponses.userId, actor.userId),
        ),
      )
      .limit(1)
    return reply.send({ answers: row?.answers ?? null })
  })

  app.put('/api/v1/play-spaces/:key/matchmaker/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const settings = await ensureMatchmakerSettings(space.id)
    if (!settings.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    const parsed = z.object({ answers: z.record(z.string(), z.unknown()) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.playSpaceMatchmakerResponses)
      .values({
        playSpaceId: space.id,
        userId: actor.userId,
        answers: parsed.data.answers,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.playSpaceMatchmakerResponses.playSpaceId,
          schema.playSpaceMatchmakerResponses.userId,
        ],
        set: { answers: parsed.data.answers, updatedAt: new Date() },
      })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/play-spaces/:key/matchmaker/deck', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const settings = await ensureMatchmakerSettings(space.id)
    if (!settings.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    const [me] = await db
      .select()
      .from(schema.playSpaceMatchmakerResponses)
      .where(
        and(
          eq(schema.playSpaceMatchmakerResponses.playSpaceId, space.id),
          eq(schema.playSpaceMatchmakerResponses.userId, actor.userId),
        ),
      )
      .limit(1)
    if (!me) return reply.status(400).send({ error: 'Complete the matchmaker quiz first' })
    const others = await db
      .select({
        userId: schema.playSpaceMatchmakerResponses.userId,
        answers: schema.playSpaceMatchmakerResponses.answers,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.playSpaceMatchmakerResponses)
      .innerJoin(schema.users, eq(schema.users.id, schema.playSpaceMatchmakerResponses.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          eq(schema.playSpaceMatchmakerResponses.playSpaceId, space.id),
          ne(schema.playSpaceMatchmakerResponses.userId, actor.userId),
        ),
      )
      .limit(80)
    const swiped = await db
      .select({ targetId: schema.playSpaceMatchmakerSwipes.targetId })
      .from(schema.playSpaceMatchmakerSwipes)
      .where(
        and(
          eq(schema.playSpaceMatchmakerSwipes.playSpaceId, space.id),
          eq(schema.playSpaceMatchmakerSwipes.actorId, actor.userId),
        ),
      )
    const swipedSet = new Set(swiped.map((s) => s.targetId))
    const deck = others
      .filter((o) => !swipedSet.has(o.userId))
      .map((o) => {
        const summary = buildMatchmakerDeckSummary(me.answers, o.answers)
        return {
          userId: o.userId,
          username: o.username,
          displayName: o.displayName,
          avatarUrl: o.avatarUrl,
          matchScore: summary.score,
          fitBand: summary.fitBand,
          reasons: summary.reasons,
          sceneFeel: summary.sceneFeel,
          summary: summary.reasons,
        }
      })
      .filter((o) => o.matchScore >= MATCHMAKER_DECK_MIN_SCORE)
      .sort((a, b) => b.matchScore - a.matchScore)
    return reply.send({
      items: deck.slice(0, 25),
      remainingCandidates: deck.length,
      exhausted: deck.length === 0,
    })
  })

  app.post('/api/v1/play-spaces/:key/matchmaker/swipe', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const actor = await requireMember(req, reply, space)
    if (!actor) return
    const settings = await ensureMatchmakerSettings(space.id)
    if (!settings.enabled) return reply.status(400).send({ error: 'Matchmaker not enabled' })
    const parsed = z
      .object({ targetId: z.string().uuid(), liked: z.boolean() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.targetId === actor.userId) return reply.status(400).send({ error: 'Invalid target' })
    await db
      .insert(schema.playSpaceMatchmakerSwipes)
      .values({
        playSpaceId: space.id,
        actorId: actor.userId,
        targetId: parsed.data.targetId,
        liked: parsed.data.liked,
      })
      .onConflictDoUpdate({
        target: [
          schema.playSpaceMatchmakerSwipes.playSpaceId,
          schema.playSpaceMatchmakerSwipes.actorId,
          schema.playSpaceMatchmakerSwipes.targetId,
        ],
        set: { liked: parsed.data.liked },
      })
    if (parsed.data.liked) {
      const [reverse] = await db
        .select()
        .from(schema.playSpaceMatchmakerSwipes)
        .where(
          and(
            eq(schema.playSpaceMatchmakerSwipes.playSpaceId, space.id),
            eq(schema.playSpaceMatchmakerSwipes.actorId, parsed.data.targetId),
            eq(schema.playSpaceMatchmakerSwipes.targetId, actor.userId),
            eq(schema.playSpaceMatchmakerSwipes.liked, true),
          ),
        )
        .limit(1)
      if (reverse) {
        const pair = orderedPair(actor.userId, parsed.data.targetId)
        try {
          await db.insert(schema.playSpaceMatchmakerMatches).values({
            playSpaceId: space.id,
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
}
