import type { FastifyInstance, FastifyReply } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { fetchTrendingItems } from '../lib/trending-rank.js'
import { TRENDING_SCHEMA_VERSION } from '../lib/trending-score.js'

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

/** Ranked mixed discover feed - see docs/TRENDING_SCORE.md. */
export async function registerTrendingRoutes(app: FastifyInstance) {
  app.get('/api/v1/trending', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { limit?: string; debug?: string }
    const limit = Math.min(40, Math.max(1, parseInt(String(q.limit ?? '24'), 10) || 24))
    const debug = q.debug === '1' && process.env.NODE_ENV !== 'production'
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)

    const items = await fetchTrendingItems({ limit, viewerId, debug })

    return reply.send({
      schemaVersion: TRENDING_SCHEMA_VERSION,
      doc: '/docs/TRENDING_SCORE.md',
      items,
    })
  })
}
