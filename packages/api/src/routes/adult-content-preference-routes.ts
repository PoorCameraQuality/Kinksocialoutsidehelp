import { adultContentPreferenceSchema } from '@c2k/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import {
  getAdultContentPreference,
  setAdultContentPreference,
} from '../lib/adult-content-preference.js'
import { replyIfViewerUserNotFound } from '../lib/user-settings-row.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    void reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    void reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

const patchBody = z
  .object({
    adultContentPreference: adultContentPreferenceSchema,
  })
  .strict()

export async function registerAdultContentPreferenceRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/adult-content-preference', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    try {
      const adultContentPreference = await getAdultContentPreference(actor.userId)
      return reply.send({ adultContentPreference })
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      throw e
    }
  })

  app.patch('/api/v1/me/adult-content-preference', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    try {
      const adultContentPreference = await setAdultContentPreference(
        actor.userId,
        parsed.data.adultContentPreference,
      )
      return reply.send({ adultContentPreference })
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      throw e
    }
  })
}
