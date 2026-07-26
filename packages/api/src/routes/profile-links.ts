import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

type LinkRow = typeof schema.profileLinks.$inferSelect

function isAllowedProfileLinkUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function mapLink(row: LinkRow) {
  return {
    id: row.id,
    url: row.url,
    label: row.label,
    sortOrder: row.sortOrder,
  }
}

async function loadLinksForUser(userId: string) {
  const rows = await db
    .select()
    .from(schema.profileLinks)
    .where(eq(schema.profileLinks.userId, userId))
    .orderBy(asc(schema.profileLinks.sortOrder), asc(schema.profileLinks.id))
  return rows.map(mapLink)
}

const createBody = z.object({
  url: z.string().min(1).max(2048),
  label: z.string().max(128).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const patchBody = z.object({
  url: z.string().min(1).max(2048).optional(),
  label: z.string().max(128).nullable().optional(),
})

const reorderBody = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export async function registerProfileLinkRoutes(app: FastifyInstance) {
  app.get('/api/profile/me/links', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile links API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    const links = await loadLinksForUser(userId)
    return reply.send({ links })
  })

  app.post('/api/profile/me/links', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile links API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    if (await rejectIfUserIdentityBanned(userId, reply)) return
    const parsed = createBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (!isAllowedProfileLinkUrl(parsed.data.url)) {
      return reply.status(400).send({ error: 'Link URL must use http or https' })
    }

    const existing = await loadLinksForUser(userId)
    const sortOrder = parsed.data.sortOrder ?? existing.length
    const [row] = await db
      .insert(schema.profileLinks)
      .values({
        userId,
        url: parsed.data.url.trim(),
        label: parsed.data.label?.trim() || null,
        sortOrder,
      })
      .returning()
    return reply.status(201).send({ link: mapLink(row!) })
  })

  app.patch('/api/profile/me/links/:id', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile links API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    if (await rejectIfUserIdentityBanned(userId, reply)) return
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.url !== undefined && !isAllowedProfileLinkUrl(parsed.data.url)) {
      return reply.status(400).send({ error: 'Link URL must use http or https' })
    }

    const [existing] = await db
      .select()
      .from(schema.profileLinks)
      .where(and(eq(schema.profileLinks.id, id), eq(schema.profileLinks.userId, userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const d = parsed.data
    const [updated] = await db
      .update(schema.profileLinks)
      .set({
        url: d.url !== undefined ? d.url.trim() : existing.url,
        label: d.label !== undefined ? d.label?.trim() || null : existing.label,
      })
      .where(eq(schema.profileLinks.id, id))
      .returning()
    return reply.send({ link: mapLink(updated!) })
  })

  app.delete('/api/profile/me/links/:id', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile links API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const [deleted] = await db
      .delete(schema.profileLinks)
      .where(and(eq(schema.profileLinks.id, id), eq(schema.profileLinks.userId, userId)))
      .returning()
    if (!deleted) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.post('/api/profile/me/links/reorder', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile links API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    if (await rejectIfUserIdentityBanned(userId, reply)) return
    const parsed = reorderBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const owned = await db
      .select({ id: schema.profileLinks.id })
      .from(schema.profileLinks)
      .where(eq(schema.profileLinks.userId, userId))
    const ownedIds = new Set(owned.map((r) => r.id))
    if (parsed.data.orderedIds.some((id) => !ownedIds.has(id))) {
      return reply.status(400).send({ error: 'Invalid link id in order list' })
    }

    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        db
          .update(schema.profileLinks)
          .set({ sortOrder: index })
          .where(and(eq(schema.profileLinks.id, id), eq(schema.profileLinks.userId, userId)))
      )
    )

    const links = await loadLinksForUser(userId)
    return reply.send({ links })
  })
}
