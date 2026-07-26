import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { canViewerReadProfile } from '../lib/profile-access.js'
import { loadPublicProfileConnections } from '../lib/profile-connections.js'
import { loadPublicProfileFollows } from '../lib/profile-social-summary.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

export async function registerProfileConnectionRoutes(app: FastifyInstance) {
  app.get('/api/profile/:username/connections', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile connections API requires USE_DATABASE=true' })
    }

    const { username } = req.params as { username: string }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    if (!profile) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === user.id
    if (!canViewerReadProfile(profile.visibility, { viewerId, isOwner })) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const { access, items } = await loadPublicProfileConnections(user.id, viewerId)
    if (!access.listVisible) {
      return reply.status(403).send({
        error: 'Connections list is private',
        totalCount: access.totalCount,
        mutualCount: access.mutualCount,
        listVisible: false,
      })
    }

    return reply.send({
      items,
      totalCount: access.totalCount,
      mutualCount: access.mutualCount,
      listVisible: true,
    })
  })

  app.get('/api/profile/:username/followers', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile followers API requires USE_DATABASE=true' })
    }

    const { username } = req.params as { username: string }
    const limitParam = (req.query as { limit?: string }).limit
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : undefined

    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    if (!profile) return reply.status(404).send({ error: 'Not found' })

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === user.id
    if (!canViewerReadProfile(profile.visibility, { viewerId, isOwner })) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const result = await loadPublicProfileFollows(user.id, 'followers', viewerId, limit)
    if (!result.listsVisible) {
      return reply.status(403).send({
        error: 'Followers list requires sign-in',
        totalCount: result.totalCount,
        listsVisible: false,
      })
    }

    return reply.send({
      items: result.items,
      totalCount: result.totalCount,
      listsVisible: true,
    })
  })

  app.get('/api/profile/:username/following', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile following API requires USE_DATABASE=true' })
    }

    const { username } = req.params as { username: string }
    const limitParam = (req.query as { limit?: string }).limit
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : undefined

    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    if (!profile) return reply.status(404).send({ error: 'Not found' })

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === user.id
    if (!canViewerReadProfile(profile.visibility, { viewerId, isOwner })) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const result = await loadPublicProfileFollows(user.id, 'following', viewerId, limit)
    if (!result.listsVisible) {
      return reply.status(403).send({
        error: 'Following list requires sign-in',
        totalCount: result.totalCount,
        listsVisible: false,
      })
    }

    return reply.send({
      items: result.items,
      totalCount: result.totalCount,
      listsVisible: true,
    })
  })
}
