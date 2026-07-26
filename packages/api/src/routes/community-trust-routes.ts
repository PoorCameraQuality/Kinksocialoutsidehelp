import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildCommunityTrust, resolveUserIdByUsername } from '../lib/community-trust.js'
import { requireDb } from '../lib/moderation-route-auth.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function sendCommunityTrust(
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  username: string
) {
  const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
  const trust = await buildCommunityTrust(userId, { viewerUserId: viewerId, username })
  if (!trust) return reply.status(404).send({ error: 'Not found' })
  return reply.send(trust)
}

export async function registerCommunityTrustRoutes(app: FastifyInstance) {
  app.get('/api/v1/users/:userId/community-trust', async (req, reply) => {
    if (!requireDb(reply)) return
    const { userId } = req.params as { userId: string }
    if (!UUID_RE.test(userId)) return reply.status(400).send({ error: 'Invalid user id' })
    const [user] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })
    return sendCommunityTrust(req, reply, userId, user.username)
  })

  app.get('/api/v1/profile/:username/community-trust', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const resolved = await resolveUserIdByUsername(username)
    if (!resolved) return reply.status(404).send({ error: 'Not found' })
    return sendCommunityTrust(req, reply, resolved.id, resolved.username)
  })
}
