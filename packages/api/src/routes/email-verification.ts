import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import {
  getEmailVerificationStatus,
  sendEmailVerificationForUser,
  verifyEmailWithSecret,
} from '../lib/email-verification.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

export async function registerEmailVerificationRoutes(app: FastifyInstance) {
  app.get('/api/v1/auth/email/status', async (req, reply) => {
    if (!useDatabase()) return reply.status(503).send({ error: 'Database not enabled' })
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    const status = await getEmailVerificationStatus(userId)
    return reply.send(status)
  })

  app.post(
    '/api/v1/auth/email/send-verification',
    { ...rateLimitRoute('emailVerificationSend') },
    async (req, reply) => {
      if (!useDatabase()) return reply.status(503).send({ error: 'Database not enabled' })
      const viewer = resolveViewerFromRequest(req)
      const userId = getViewerUserId(viewer.payload)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const result = await sendEmailVerificationForUser({ userId, log: req.log })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true, emailMasked: result.emailMasked })
    },
  )

  app.post(
    '/api/v1/auth/email/verify',
    { ...rateLimitRoute('emailVerificationConfirm') },
    async (req, reply) => {
      if (!useDatabase()) return reply.status(503).send({ error: 'Database not enabled' })
      const parsed = z
        .object({
          code: z.string().trim().min(4).max(12).optional(),
          token: z.string().trim().min(8).max(256).optional(),
        })
        .safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
      if (!parsed.data.code && !parsed.data.token) {
        return reply.status(400).send({ error: 'Code or token required' })
      }

      const viewer = resolveViewerFromRequest(req)
      const userId = getViewerUserId(viewer.payload)
      if (parsed.data.code && !userId) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const result = await verifyEmailWithSecret({
        userId,
        token: parsed.data.token,
        code: parsed.data.code,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true, verified: true })
    },
  )
}
