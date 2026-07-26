import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  mediaShowWriteBodySchema,
  slugifyMediaTitle,
  validateListInMediaRequirements,
} from '../lib/media-show-schema.js'
import { requirePlatformModerator } from '../lib/moderation-route-auth.js'
import { enqueueMediaShowRssSync } from '../lib/media-rss-queue.js'

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

function optionalViewerId(req: FastifyRequest): string | null {
  return getViewerUserId(resolveViewerFromRequest(req).payload)
}

type ShowRow = typeof schema.mediaShows.$inferSelect
type EpisodeRow = typeof schema.mediaShowEpisodes.$inferSelect

async function loadOwner(userId: string) {
  const [row] = await db
    .select({
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1)
  return row ?? { username: '', displayName: null }
}

function shapeShow(row: ShowRow, owner: { username: string; displayName: string | null }) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    mediaFormat: row.mediaFormat,
    rssFeedUrl: row.rssFeedUrl,
    youtubeChannelUrl: row.youtubeChannelUrl,
    youtubePlaylistUrl: row.youtubePlaylistUrl,
    spotifyShowUrl: row.spotifyShowUrl,
    applePodcastsUrl: row.applePodcastsUrl,
    websiteUrl: row.websiteUrl,
    twitchUrl: row.twitchUrl,
    rumbleUrl: row.rumbleUrl,
    tags: row.tags ?? [],
    contentWarnings: row.contentWarnings ?? [],
    listInMedia: row.listInMedia,
    publicationStatus: row.publicationStatus,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    lastEpisodeSyncedAt: row.lastEpisodeSyncedAt?.toISOString() ?? null,
    ownerUserId: row.ownerUserId,
    ownerUsername: owner.username,
    ownerDisplayName: owner.displayName,
    presenterProfileUserId: row.presenterProfileUserId,
    organizationId: row.organizationId,
    groupId: row.groupId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function shapeEpisode(row: EpisodeRow) {
  return {
    id: row.id,
    showId: row.showId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
    externalAudioUrl: row.externalAudioUrl,
    youtubeVideoUrl: row.youtubeVideoUrl,
    spotifyEpisodeUrl: row.spotifyEpisodeUrl,
    appleEpisodeUrl: row.appleEpisodeUrl,
    websiteUrl: row.websiteUrl,
    createdAt: row.createdAt.toISOString(),
  }
}

async function ensureUniqueShowSlug(base: string, excludeId?: string): Promise<string> {
  const slug = base.slice(0, 160)
  for (let n = 0; n < 20; n++) {
    const candidate = n === 0 ? slug : `${slug.slice(0, 150)}-${n}`
    const [existing] = await db
      .select({ id: schema.mediaShows.id })
      .from(schema.mediaShows)
      .where(
        excludeId
          ? and(eq(schema.mediaShows.slug, candidate), sql`${schema.mediaShows.id} <> ${excludeId}`)
          : eq(schema.mediaShows.slug, candidate),
      )
      .limit(1)
    if (!existing) return candidate
  }
  return `${slug}-${Date.now()}`.slice(0, 160)
}

async function ensureUniqueEpisodeSlug(showId: string, base: string, excludeId?: string): Promise<string> {
  const slug = base.slice(0, 160)
  for (let n = 0; n < 20; n++) {
    const candidate = n === 0 ? slug : `${slug.slice(0, 150)}-${n}`
    const [existing] = await db
      .select({ id: schema.mediaShowEpisodes.id })
      .from(schema.mediaShowEpisodes)
      .where(
        excludeId
          ? and(
              eq(schema.mediaShowEpisodes.showId, showId),
              eq(schema.mediaShowEpisodes.slug, candidate),
              sql`${schema.mediaShowEpisodes.id} <> ${excludeId}`,
            )
          : and(eq(schema.mediaShowEpisodes.showId, showId), eq(schema.mediaShowEpisodes.slug, candidate)),
      )
      .limit(1)
    if (!existing) return candidate
  }
  return `${slug}-${Date.now()}`.slice(0, 160)
}

function viewerCanSeeShow(row: ShowRow, viewerId: string | null): boolean {
  if (row.publicationStatus === 'PUBLISHED' && row.listInMedia) return true
  if (viewerId && viewerId === row.ownerUserId) return true
  return false
}

function applyWriteUrls(body: z.infer<typeof mediaShowWriteBodySchema>) {
  const urlFields = [
    'rssFeedUrl',
    'youtubeChannelUrl',
    'youtubePlaylistUrl',
    'spotifyShowUrl',
    'applePodcastsUrl',
    'websiteUrl',
    'twitchUrl',
    'rumbleUrl',
    'coverImageUrl',
  ] as const
  const out: Record<string, string | null | undefined> = {}
  for (const key of urlFields) {
    const raw = body[key]
    if (raw === undefined) continue
    if (!raw) {
      out[key] = null
      continue
    }
    const url = String(raw)
    if (!url.startsWith('https://')) throw new Error(`Invalid HTTPS URL for ${key}`)
    out[key] = url
  }
  return out
}

export async function loadMediaShowsForPresenter(presenterUserId: string, limit = 12) {
  const rows = await db
    .select()
    .from(schema.mediaShows)
    .where(
      and(
        eq(schema.mediaShows.presenterProfileUserId, presenterUserId),
        eq(schema.mediaShows.publicationStatus, 'PUBLISHED'),
        eq(schema.mediaShows.listInMedia, true),
      ),
    )
    .orderBy(desc(schema.mediaShows.updatedAt))
    .limit(limit)
  const owner = await loadOwner(presenterUserId)
  return rows.map((r) => shapeShow(r, owner))
}

export async function registerMediaRoutes(app: FastifyInstance) {
  app.get('/api/v1/media/shows', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { q?: string; tag?: string; format?: string; limit?: string; cursor?: string }
    const limit = Math.min(50, Math.max(1, parseInt(String(q.limit ?? '24'), 10) || 24))
    const conditions = [
      eq(schema.mediaShows.listInMedia, true),
      eq(schema.mediaShows.publicationStatus, 'PUBLISHED'),
    ]
    if (q.format === 'podcast' || q.format === 'video' || q.format === 'hybrid') {
      conditions.push(eq(schema.mediaShows.mediaFormat, q.format))
    }
    if (q.tag?.trim()) {
      conditions.push(sql`${q.tag.trim().toLowerCase()} = ANY(${schema.mediaShows.tags})`)
    }
    if (q.q?.trim()) {
      const pattern = `%${q.q.trim()}%`
      conditions.push(
        or(ilike(schema.mediaShows.title, pattern), ilike(schema.mediaShows.description, pattern))!,
      )
    }
    if (q.cursor) {
      const d = new Date(q.cursor)
      if (!Number.isNaN(d.getTime())) {
        conditions.push(lt(schema.mediaShows.updatedAt, d))
      }
    }
    const rows = await db
      .select()
      .from(schema.mediaShows)
      .where(and(...conditions))
      .orderBy(desc(schema.mediaShows.updatedAt))
      .limit(limit + 1)
    const page = rows.slice(0, limit)
    const items = await Promise.all(
      page.map(async (row) => shapeShow(row, await loadOwner(row.ownerUserId))),
    )
    const nextCursor =
      rows.length > limit && page[page.length - 1] ? page[page.length - 1]!.updatedAt.toISOString() : null
    return reply.send({ items, nextCursor })
  })

  app.get('/api/v1/media/shows/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { slug } = req.params as { slug: string }
    const viewerId = optionalViewerId(req)
    const [row] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.slug, slug)).limit(1)
    if (!row || !viewerCanSeeShow(row, viewerId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const owner = await loadOwner(row.ownerUserId)
    return reply.send({ show: shapeShow(row, owner) })
  })

  app.get('/api/v1/media/shows/:slug/episodes', async (req, reply) => {
    if (!requireDb(reply)) return
    const { slug } = req.params as { slug: string }
    const viewerId = optionalViewerId(req)
    const [show] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.slug, slug)).limit(1)
    if (!show || !viewerCanSeeShow(show, viewerId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const episodes = await db
      .select()
      .from(schema.mediaShowEpisodes)
      .where(eq(schema.mediaShowEpisodes.showId, show.id))
      .orderBy(desc(schema.mediaShowEpisodes.publishedAt))
      .limit(100)
    return reply.send({ items: episodes.map(shapeEpisode) })
  })

  app.get('/api/v1/media/shows/:slug/episodes/:episodeSlug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { slug, episodeSlug } = req.params as { slug: string; episodeSlug: string }
    const viewerId = optionalViewerId(req)
    const [show] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.slug, slug)).limit(1)
    if (!show || !viewerCanSeeShow(show, viewerId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const [ep] = await db
      .select()
      .from(schema.mediaShowEpisodes)
      .where(
        and(eq(schema.mediaShowEpisodes.showId, show.id), eq(schema.mediaShowEpisodes.slug, episodeSlug)),
      )
      .limit(1)
    if (!ep) return reply.status(404).send({ error: 'Not found' })
    const owner = await loadOwner(show.ownerUserId)
    return reply.send({ show: shapeShow(show, owner), episode: shapeEpisode(ep) })
  })

  app.get('/api/v1/me/media/shows', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.mediaShows)
      .where(eq(schema.mediaShows.ownerUserId, user.userId))
      .orderBy(desc(schema.mediaShows.updatedAt))
    const owner = await loadOwner(user.userId)
    return reply.send({ items: rows.map((r) => shapeShow(r, owner)) })
  })

  app.post('/api/v1/me/media/shows', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = mediaShowWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    let urls: Record<string, string | null>
    try {
      urls = applyWriteUrls(parsed.data) as Record<string, string | null>
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Invalid URL' })
    }
    const baseSlug = parsed.data.slug?.trim() || slugifyMediaTitle(parsed.data.title)
    const slug = await ensureUniqueShowSlug(baseSlug || 'show')
    const [presenter] = await db
      .select({ userId: schema.presenterProfiles.userId })
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.userId))
      .limit(1)
    const [row] = await db
      .insert(schema.mediaShows)
      .values({
        ownerUserId: user.userId,
        presenterProfileUserId: presenter?.userId ?? null,
        organizationId: parsed.data.organizationId ?? null,
        groupId: parsed.data.groupId ?? null,
        slug,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() ?? null,
        mediaFormat: parsed.data.mediaFormat ?? 'podcast',
        tags: parsed.data.tags ?? [],
        contentWarnings: parsed.data.contentWarnings ?? [],
        ...urls,
      })
      .returning()
    if (!row) return reply.status(500).send({ error: 'Insert failed' })
    const owner = await loadOwner(user.userId)
    return reply.send({ show: shapeShow(row, owner) })
  })

  app.put('/api/v1/me/media/shows/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    if (!z.string().uuid().safeParse(id).success) return reply.status(400).send({ error: 'Invalid id' })
    const [existing] = await db
      .select()
      .from(schema.mediaShows)
      .where(and(eq(schema.mediaShows.id, id), eq(schema.mediaShows.ownerUserId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const parsed = mediaShowWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    let urls: Record<string, string | null> = {}
    try {
      urls = applyWriteUrls(parsed.data) as Record<string, string | null>
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Invalid URL' })
    }
    const slug =
      parsed.data.slug?.trim() ?
        await ensureUniqueShowSlug(slugifyMediaTitle(parsed.data.slug) || parsed.data.slug, id)
      : existing.slug
    const [row] = await db
      .update(schema.mediaShows)
      .set({
        title: parsed.data.title.trim(),
        slug,
        description: parsed.data.description?.trim() ?? null,
        mediaFormat: parsed.data.mediaFormat ?? existing.mediaFormat,
        tags: parsed.data.tags ?? existing.tags,
        contentWarnings: parsed.data.contentWarnings ?? existing.contentWarnings,
        organizationId:
          parsed.data.organizationId !== undefined ? parsed.data.organizationId : existing.organizationId,
        groupId: parsed.data.groupId !== undefined ? parsed.data.groupId : existing.groupId,
        ...urls,
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaShows.id, id))
      .returning()
    if (!row) return reply.status(500).send({ error: 'Update failed' })
    const owner = await loadOwner(user.userId)
    return reply.send({ show: shapeShow(row, owner) })
  })

  app.post('/api/v1/me/media/shows/:id/submit', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const [existing] = await db
      .select()
      .from(schema.mediaShows)
      .where(and(eq(schema.mediaShows.id, id), eq(schema.mediaShows.ownerUserId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const warnErr = validateListInMediaRequirements(existing.contentWarnings ?? [])
    if (warnErr) return reply.status(400).send({ error: warnErr })
    const hasLink =
      existing.rssFeedUrl ||
      existing.youtubeChannelUrl ||
      existing.spotifyShowUrl ||
      existing.applePodcastsUrl ||
      existing.websiteUrl
    if (!hasLink) {
      return reply.status(400).send({ error: 'Add at least one listen or watch link before submitting.' })
    }
    const [row] = await db
      .update(schema.mediaShows)
      .set({ submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.mediaShows.id, id))
      .returning()
    const owner = await loadOwner(user.userId)
    return reply.send({ show: shapeShow(row!, owner), ok: true })
  })

  app.post('/api/v1/moderation/media/shows/:id/approve', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return
    const { id } = req.params as { id: string }
    const [existing] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const warnErr = validateListInMediaRequirements(existing.contentWarnings ?? [])
    if (warnErr) return reply.status(400).send({ error: warnErr })
    const now = new Date()
    const [row] = await db
      .update(schema.mediaShows)
      .set({
        publicationStatus: 'PUBLISHED',
        listInMedia: true,
        approvedByUserId: user.userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.mediaShows.id, id))
      .returning()
    if (row?.rssFeedUrl && (row.mediaFormat === 'podcast' || row.mediaFormat === 'hybrid')) {
      await enqueueMediaShowRssSync(row.id)
    }
    const owner = await loadOwner(row!.ownerUserId)
    return reply.send({ show: shapeShow(row!, owner), ok: true })
  })

  app.get('/api/v1/presenters/:key/media', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, key))
      .limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })
    const items = await loadMediaShowsForPresenter(user.id, 24)
    return reply.send({ items })
  })
}
