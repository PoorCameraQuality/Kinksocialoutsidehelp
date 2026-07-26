import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { putMeIsoBodySchema } from '../lib/iso-validation.js'

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

async function loadIsoImages(userId: string) {
  return db
    .select({ sortOrder: schema.userIsoImages.sortOrder, url: schema.userIsoImages.url })
    .from(schema.userIsoImages)
    .where(eq(schema.userIsoImages.userId, userId))
    .orderBy(asc(schema.userIsoImages.sortOrder))
}

async function loadPinnedConventionIds(userId: string) {
  const rows = await db
    .select({ conventionId: schema.conventionIsoListings.conventionId })
    .from(schema.conventionIsoListings)
    .where(eq(schema.conventionIsoListings.userId, userId))
  return rows.map((r) => r.conventionId)
}

export async function registerIsoRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/iso', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const [post] = await db.select().from(schema.userIsoPosts).where(eq(schema.userIsoPosts.userId, user.userId)).limit(1)
    const images = await loadIsoImages(user.userId)
    const pinnedConventionIds = await loadPinnedConventionIds(user.userId)
    return reply.send({
      post: post ?? null,
      images,
      pinnedConventionIds,
    })
  })

  app.put('/api/v1/me/iso', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = putMeIsoBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const { body, visibility, acceptDmsViaIso, images } = parsed.data
    const now = new Date()
    await db
      .insert(schema.userIsoPosts)
      .values({
        userId: user.userId,
        body,
        visibility,
        acceptDmsViaIso,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.userIsoPosts.userId,
        set: {
          body,
          visibility,
          acceptDmsViaIso,
          updatedAt: now,
        },
      })
    await db.delete(schema.userIsoImages).where(eq(schema.userIsoImages.userId, user.userId))
    if (images.length > 0) {
      await db.insert(schema.userIsoImages).values(
        images.map((url, i) => ({
          userId: user.userId,
          sortOrder: i,
          url,
          createdAt: now,
        })),
      )
    }
    const [post] = await db.select().from(schema.userIsoPosts).where(eq(schema.userIsoPosts.userId, user.userId)).limit(1)
    const outImages = await loadIsoImages(user.userId)
    return reply.send({ post, images: outImages })
  })
}
