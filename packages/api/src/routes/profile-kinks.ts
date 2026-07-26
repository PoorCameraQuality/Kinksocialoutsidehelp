import { and, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PROFILE_KINK_MAX } from '@c2k/shared'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { ensureProfileForUserId } from '../lib/ensure-profile.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const kinkRowSchema = z.object({
  kinkTagId: z.string().uuid(),
  interestStatus: z.enum(['into', 'curious', 'soft_limit', 'hard_limit', 'not_into']),
  activity: z.string().max(255).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

const putBodySchema = z.array(kinkRowSchema)

export async function registerProfileKinksRoutes(app: FastifyInstance) {
  app.get('/api/profile/me/kinks', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile kinks API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const prof = await ensureProfileForUserId(userId)
    const rows = await db
      .select({
        kinkTagId: schema.profileKinks.kinkTagId,
        interestStatus: schema.profileKinks.interestStatus,
        activity: schema.profileKinks.activity,
        note: schema.profileKinks.note,
        slug: schema.kinkTags.slug,
        displayName: schema.kinkTags.displayName,
      })
      .from(schema.profileKinks)
      .innerJoin(schema.kinkTags, eq(schema.profileKinks.kinkTagId, schema.kinkTags.id))
      .where(eq(schema.profileKinks.profileId, prof.id))

    return reply.send({ kinks: rows })
  })

  app.put('/api/profile/me/kinks', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile kinks API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    if (await rejectIfUserIdentityBanned(userId, reply)) return
    const parsed = putBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    if (parsed.data.length > PROFILE_KINK_MAX) {
      return reply.status(400).send({ error: `At most ${PROFILE_KINK_MAX} kinks allowed` })
    }
    const seen = new Set<string>()
    const deduped = parsed.data.filter((row) => {
      if (seen.has(row.kinkTagId)) return false
      seen.add(row.kinkTagId)
      return true
    })
    const prof = await ensureProfileForUserId(userId)

    const tagIds = [...new Set(deduped.map((r) => r.kinkTagId))]
    if (tagIds.length === 0) {
      await db.delete(schema.profileKinks).where(eq(schema.profileKinks.profileId, prof.id))
      return reply.send({ kinks: [] })
    }

    const validTags = await db
      .select({ id: schema.kinkTags.id })
      .from(schema.kinkTags)
      .where(and(eq(schema.kinkTags.active, true), inArray(schema.kinkTags.id, tagIds)))

    const validSet = new Set(validTags.map((t) => t.id))
    for (const id of tagIds) {
      if (!validSet.has(id)) {
        return reply.status(400).send({ error: `Unknown or inactive kink tag: ${id}` })
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.profileKinks).where(eq(schema.profileKinks.profileId, prof.id))
      if (deduped.length === 0) return
      const now = new Date()
      await tx.insert(schema.profileKinks).values(
        deduped.map((r) => ({
          profileId: prof.id,
          kinkTagId: r.kinkTagId,
          interestStatus: r.interestStatus,
          activity: r.activity ?? null,
          note: r.note ?? null,
          updatedAt: now,
        }))
      )
    })

    const rows = await db
      .select({
        kinkTagId: schema.profileKinks.kinkTagId,
        interestStatus: schema.profileKinks.interestStatus,
        activity: schema.profileKinks.activity,
        note: schema.profileKinks.note,
        slug: schema.kinkTags.slug,
        displayName: schema.kinkTags.displayName,
      })
      .from(schema.profileKinks)
      .innerJoin(schema.kinkTags, eq(schema.profileKinks.kinkTagId, schema.kinkTags.id))
      .where(eq(schema.profileKinks.profileId, prof.id))

    return reply.send({ kinks: rows })
  })
}
