import { and, asc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const querySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(250).optional().default(50),
})

export async function registerKinkTagRoutes(app: FastifyInstance) {
  app.get('/api/kink-tags', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Kink tags API requires USE_DATABASE=true' })
    }
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query' })
    }
    const { q, limit } = parsed.data
    const term = q?.trim()
    const where = term
      ? and(
          eq(schema.kinkTags.active, true),
          sql`(${schema.kinkTags.displayName} ILIKE ${'%' + term + '%'} OR ${schema.kinkTags.slug} ILIKE ${'%' + term + '%'})`
        )
      : eq(schema.kinkTags.active, true)

    const rows = await db
      .select({
        id: schema.kinkTags.id,
        slug: schema.kinkTags.slug,
        displayName: schema.kinkTags.displayName,
        description: schema.kinkTags.description,
        sortOrder: schema.kinkTags.sortOrder,
      })
      .from(schema.kinkTags)
      .where(where)
      .orderBy(asc(schema.kinkTags.sortOrder), asc(schema.kinkTags.displayName))
      .limit(limit)

    return reply.send({ tags: rows })
  })
}
