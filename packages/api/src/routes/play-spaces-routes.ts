/**
 * Play Spaces — user-owned dancecard gatherings (not org conventions).
 * Routes: /api/v1/play-spaces
 */
import { randomBytes } from 'node:crypto'
import { and, asc, count, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import {
  filterScheduleItems,
  loadMyPlaySpaceSchedule,
  myScheduleToCsv,
  myScheduleToIcs,
} from '../lib/play-space-my-schedule.js'

function siteOriginFromEnv(): string {
  const raw =
    process.env.C2K_DANCECARD_PUBLIC_WEB_URL ??
    process.env.VITE_SITE_URL ??
    process.env.API_PUBLIC_URL ??
    'https://dancecard.kink.social'
  return raw.replace(/\/$/, '')
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'play-space'
}

async function uniquePlaySpaceSlug(base: string): Promise<string> {
  let candidate = base
  for (let i = 0; i < 20; i++) {
    const existing = await db
      .select({ id: schema.playSpaces.id })
      .from(schema.playSpaces)
      .where(eq(schema.playSpaces.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
    candidate = `${base}-${i + 2}`
  }
  return `${base}-${randomBytes(3).toString('hex')}`
}

function mintInviteCode(): string {
  return randomBytes(9).toString('base64url')
}

function optionalUserId(req: FastifyRequest): string | null {
  const viewer = resolveViewerFromRequest(req)
  if (!viewer.authenticated) return null
  return getViewerUserId(viewer.payload)
}

function mapSpaceRow(
  row: typeof schema.playSpaces.$inferSelect,
  extras: {
    memberCount?: number
    isMember?: boolean
    myRole?: string | null
    inviteCode?: string | null
  } = {},
) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    locationLabel: row.locationLabel,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    memberCount: extras.memberCount ?? 0,
    isMember: extras.isMember ?? false,
    myRole: extras.myRole ?? null,
    createdAt: row.createdAt.toISOString(),
    ...(extras.inviteCode !== undefined ? { inviteCode: extras.inviteCode } : {}),
  }
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

async function memberCount(spaceId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(schema.playSpaceMembers)
    .where(eq(schema.playSpaceMembers.playSpaceId, spaceId))
  return Number(rows[0]?.n ?? 0)
}

async function requireExistingDbUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string } | null> {
  const actor = requireAuthenticatedDbUser(req, reply)
  if (!actor) return null
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, actor.userId), isNull(schema.users.deletedAt)))
    .limit(1)
  if (!rows[0]) {
    reply.status(401).send({
      error: 'Session user is missing. Sign out and sign back in with kink.social, then try again.',
    })
    return null
  }
  return actor
}

async function requireSpaceMember(
  req: FastifyRequest,
  reply: FastifyReply,
  space: typeof schema.playSpaces.$inferSelect,
): Promise<{ userId: string; role: string } | null> {
  const actor = await requireExistingDbUser(req, reply)
  if (!actor) return null
  const m = await membership(space.id, actor.userId)
  if (!m) {
    reply.status(403).send({ error: 'Join this play space to continue' })
    return null
  }
  return { userId: actor.userId, role: m.role }
}

const createBody = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(4000).optional().nullable(),
  locationLabel: z.string().trim().max(512).optional().nullable(),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  timezone: z.string().trim().min(1).max(64).default('America/New_York'),
  slug: z.string().trim().min(2).max(128).optional(),
})

const patchBody = z.object({
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  locationLabel: z.string().trim().max(512).optional().nullable(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

const entryBody = z.object({
  title: z.string().trim().min(1).max(255),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(512).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

const joinBody = z.object({
  inviteCode: z.string().trim().min(4).max(64).optional(),
})

export async function registerPlaySpaceRoutes(app: FastifyInstance) {
  /** Personal schedule across joined play spaces (must be before /:key). */
  app.get('/api/v1/play-spaces/me/schedule', async (req, reply) => {
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    const q = z
      .object({
        range: z.enum(['upcoming', 'past', 'all']).optional(),
        space: z.string().trim().max(128).optional(),
      })
      .safeParse(req.query)
    if (!q.success) return reply.status(400).send({ error: 'Invalid query' })

    const loaded = await loadMyPlaySpaceSchedule(actor.userId)
    const items = filterScheduleItems(loaded.items, {
      range: q.data.range ?? 'upcoming',
      spaceSlug: q.data.space,
    })
    return reply.send({ items, spaces: loaded.spaces })
  })

  app.get('/api/v1/play-spaces/me/schedule.ics', async (req, reply) => {
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    const q = z
      .object({
        range: z.enum(['upcoming', 'past', 'all']).optional(),
        space: z.string().trim().max(128).optional(),
      })
      .safeParse(req.query)
    if (!q.success) return reply.status(400).send({ error: 'Invalid query' })

    const loaded = await loadMyPlaySpaceSchedule(actor.userId)
    const items = filterScheduleItems(loaded.items, {
      range: q.data.range ?? 'upcoming',
      spaceSlug: q.data.space,
    })
    const ics = myScheduleToIcs(items, { siteOrigin: siteOriginFromEnv() })
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="dancecard-schedule.ics"')
      .send(ics)
  })

  app.get('/api/v1/play-spaces/me/schedule.csv', async (req, reply) => {
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    const q = z
      .object({
        range: z.enum(['upcoming', 'past', 'all']).optional(),
        space: z.string().trim().max(128).optional(),
      })
      .safeParse(req.query)
    if (!q.success) return reply.status(400).send({ error: 'Invalid query' })

    const loaded = await loadMyPlaySpaceSchedule(actor.userId)
    const items = filterScheduleItems(loaded.items, {
      range: q.data.range ?? 'all',
      spaceSlug: q.data.space,
    })
    const csv = myScheduleToCsv(items, siteOriginFromEnv())
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="dancecard-schedule.csv"')
      .send(csv)
  })

  /** Directory: public spaces (no auth) or mine (auth). */
  app.get('/api/v1/play-spaces', async (req, reply) => {
    const q = z
      .object({
        q: z.string().trim().max(120).optional(),
        mine: z.enum(['1', 'true']).optional(),
        upcoming: z.enum(['0', '1', 'true', 'false']).optional(),
      })
      .safeParse(req.query)
    if (!q.success) return reply.status(400).send({ error: 'Invalid query' })

    const userId = optionalUserId(req)
    if (q.data.mine && !userId) return reply.status(401).send({ error: 'Unauthorized' })

    const upcoming = q.data.upcoming !== '0' && q.data.upcoming !== 'false'
    const conditions = []

    if (q.data.mine && userId) {
      conditions.push(
        sql`${schema.playSpaces.id} IN (
          SELECT play_space_id FROM play_space_members WHERE user_id = ${userId}::uuid
        )`,
      )
    } else {
      conditions.push(eq(schema.playSpaces.visibility, 'public'))
    }

    if (upcoming) {
      conditions.push(gte(schema.playSpaces.endsAt, new Date()))
    }

    if (q.data.q) {
      const like = `%${q.data.q}%`
      conditions.push(
        or(
          ilike(schema.playSpaces.title, like),
          ilike(schema.playSpaces.locationLabel, like),
          ilike(schema.playSpaces.description, like),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(schema.playSpaces)
      .where(and(...conditions))
      .orderBy(asc(schema.playSpaces.startsAt))
      .limit(100)

    const items = await Promise.all(
      rows.map(async (row) => {
        const n = await memberCount(row.id)
        let isMember = false
        let myRole: string | null = null
        if (userId) {
          const m = await membership(row.id, userId)
          isMember = Boolean(m)
          myRole = m?.role ?? null
        }
        return mapSpaceRow(row, { memberCount: n, isMember, myRole })
      }),
    )

    return reply.send({ items })
  })

  app.post('/api/v1/play-spaces', async (req, reply) => {
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return

    const parsed = createBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return reply.status(400).send({ error: 'Invalid startsAt or endsAt' })
    }
    if (!(endsAt > startsAt)) return reply.status(400).send({ error: 'endsAt must be after startsAt' })

    const base = slugify(parsed.data.slug || parsed.data.title)
    const slug = await uniquePlaySpaceSlug(base)
    const inviteCode = parsed.data.visibility === 'public' ? null : mintInviteCode()

    const [row] = await db
      .insert(schema.playSpaces)
      .values({
        slug,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        locationLabel: parsed.data.locationLabel ?? null,
        visibility: parsed.data.visibility,
        ownerUserId: actor.userId,
        startsAt,
        endsAt,
        timezone: parsed.data.timezone,
        inviteCode,
      })
      .returning()

    await db.insert(schema.playSpaceMembers).values({
      playSpaceId: row.id,
      userId: actor.userId,
      role: 'owner',
    })

    return reply.status(201).send({
      ...mapSpaceRow(row, { memberCount: 1, isMember: true, myRole: 'owner', inviteCode: row.inviteCode }),
    })
  })

  app.get('/api/v1/play-spaces/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const userId = optionalUserId(req)
    const m = userId ? await membership(space.id, userId) : null

    if (space.visibility === 'private' && !m) {
      if (!userId) return reply.status(401).send({ error: 'Sign in to view this play space' })
      return reply.status(403).send({ error: 'Invite required to view this private play space' })
    }

    const n = await memberCount(space.id)
    return reply.send(
      mapSpaceRow(space, {
        memberCount: n,
        isMember: Boolean(m),
        myRole: m?.role ?? null,
        inviteCode: m?.role === 'owner' ? space.inviteCode : undefined,
      }),
    )
  })

  app.patch('/api/v1/play-spaces/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) {
      return reply.status(403).send({ error: 'Only the owner can edit this play space' })
    }

    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : space.startsAt
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : space.endsAt
    if (!(endsAt > startsAt)) return reply.status(400).send({ error: 'endsAt must be after startsAt' })

    let inviteCode = space.inviteCode
    if (parsed.data.visibility && parsed.data.visibility !== 'public' && !inviteCode) {
      inviteCode = mintInviteCode()
    }
    if (parsed.data.visibility === 'public') {
      inviteCode = null
    }

    const [row] = await db
      .update(schema.playSpaces)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.locationLabel !== undefined ? { locationLabel: parsed.data.locationLabel } : {}),
        ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
        ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
        startsAt,
        endsAt,
        inviteCode,
        updatedAt: new Date(),
      })
      .where(eq(schema.playSpaces.id, space.id))
      .returning()

    const n = await memberCount(row.id)
    return reply.send(
      mapSpaceRow(row, {
        memberCount: n,
        isMember: true,
        myRole: 'owner',
        inviteCode: row.inviteCode,
      }),
    )
  })

  app.post('/api/v1/play-spaces/:key/join', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return

    const parsed = joinBody.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const existing = await membership(space.id, actor.userId)
    if (existing) {
      return reply.send({ ok: true, alreadyMember: true, role: existing.role })
    }

    if (space.visibility === 'private' || space.visibility === 'unlisted') {
      if (!space.inviteCode || parsed.data.inviteCode !== space.inviteCode) {
        return reply.status(403).send({ error: 'Valid invite code required' })
      }
    }

    await db.insert(schema.playSpaceMembers).values({
      playSpaceId: space.id,
      userId: actor.userId,
      role: 'member',
    })

    return reply.status(201).send({ ok: true, alreadyMember: false, role: 'member' })
  })

  /** List my dancecard entries + optional peer entries for compare (members only). */
  app.get('/api/v1/play-spaces/:key/dancecard', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const member = await requireSpaceMember(req, reply, space)
    if (!member) return

    const q = z
      .object({
        peerUserId: z.string().uuid().optional(),
      })
      .safeParse(req.query)
    if (!q.success) return reply.status(400).send({ error: 'Invalid query' })

    const mine = await db
      .select()
      .from(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
          eq(schema.playSpaceDancecardEntries.userId, member.userId),
        ),
      )
      .orderBy(asc(schema.playSpaceDancecardEntries.startsAt))

    let peer: typeof mine = []
    if (q.data.peerUserId && q.data.peerUserId !== member.userId) {
      const peerMember = await membership(space.id, q.data.peerUserId)
      if (!peerMember) return reply.status(404).send({ error: 'Peer is not a member of this space' })
      peer = await db
        .select()
        .from(schema.playSpaceDancecardEntries)
        .where(
          and(
            eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
            eq(schema.playSpaceDancecardEntries.userId, q.data.peerUserId),
          ),
        )
        .orderBy(asc(schema.playSpaceDancecardEntries.startsAt))
    }

    const mapEntry = (e: (typeof mine)[number]) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      notes: e.notes,
      userId: e.userId,
    })

    return reply.send({
      space: mapSpaceRow(space, { isMember: true, myRole: member.role }),
      mine: mine.map(mapEntry),
      peer: peer.map(mapEntry),
    })
  })

  app.post('/api/v1/play-spaces/:key/dancecard', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const member = await requireSpaceMember(req, reply, space)
    if (!member) return

    const parsed = entryBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    if (!(endsAt > startsAt)) return reply.status(400).send({ error: 'endsAt must be after startsAt' })

    const [row] = await db
      .insert(schema.playSpaceDancecardEntries)
      .values({
        playSpaceId: space.id,
        userId: member.userId,
        title: parsed.data.title,
        startsAt,
        endsAt,
        location: parsed.data.location ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning()

    return reply.status(201).send({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      notes: row.notes,
      userId: row.userId,
    })
  })

  app.delete('/api/v1/play-spaces/:key/dancecard/:entryId', async (req, reply) => {
    const { key, entryId } = req.params as { key: string; entryId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const member = await requireSpaceMember(req, reply, space)
    if (!member) return

    const existing = await db
      .select()
      .from(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.id, entryId),
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!existing[0]) return reply.status(404).send({ error: 'Entry not found' })
    if (existing[0].userId !== member.userId && member.role !== 'owner') {
      return reply.status(403).send({ error: 'Not your dancecard entry' })
    }

    await db
      .delete(schema.playSpaceDancecardEntries)
      .where(eq(schema.playSpaceDancecardEntries.id, entryId))

    return reply.send({ ok: true })
  })

  /** Member roster (members only). */
  app.get('/api/v1/play-spaces/:key/members', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })

    const member = await requireSpaceMember(req, reply, space)
    if (!member) return

    const rows = await db
      .select({
        userId: schema.playSpaceMembers.userId,
        role: schema.playSpaceMembers.role,
        joinedAt: schema.playSpaceMembers.joinedAt,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.playSpaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.playSpaceMembers.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.playSpaceMembers.userId))
      .where(eq(schema.playSpaceMembers.playSpaceId, space.id))
      .orderBy(asc(schema.playSpaceMembers.joinedAt))

    return reply.send({
      items: rows.map((r) => ({
        userId: r.userId,
        role: r.role,
        joinedAt: r.joinedAt.toISOString(),
        username: r.username,
        displayName: r.displayName,
      })),
    })
  })
}
