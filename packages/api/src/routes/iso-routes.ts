import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { putMeIsoBodySchema } from '../lib/iso-validation.js'
import { normalizeIsoStructured } from '@c2k/shared'
import {
  MediaUploadValidationError,
  promoteQuarantineToScopeBrandingUrl,
} from '../lib/media-pipeline.js'
import { alphaUploadDisabledResponse, isAlphaUploadDisabled } from '../lib/alpha-upload-policy.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

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
    const structured = normalizeIsoStructured(parsed.data.structured ?? {})
    const now = new Date()
    await db
      .insert(schema.userIsoPosts)
      .values({
        userId: user.userId,
        body,
        structured,
        visibility,
        acceptDmsViaIso,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.userIsoPosts.userId,
        set: {
          body,
          structured,
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

  /** Promote a staged /api/upload image to a public URL for ISO slots. */
  app.post('/api/v1/me/iso/images', { ...rateLimitRoute('upload') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (isAlphaUploadDisabled('profile_media')) {
      return alphaUploadDisabledResponse(reply, 'profile_media')
    }
    const parsed = z
      .object({ quarantineKey: z.string().min(1).max(2048) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const url = await promoteQuarantineToScopeBrandingUrl({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        scopePath: `users/${user.userId}/iso`,
        assetName: 'iso',
      })
      return reply.send({ url })
    } catch (err) {
      if (err instanceof MediaUploadValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      const e = err as { message?: string }
      req.log?.error({ err }, 'ISO image attach failed')
      return reply.status(502).send({ error: e.message ?? 'Could not attach ISO image' })
    }
  })
}
