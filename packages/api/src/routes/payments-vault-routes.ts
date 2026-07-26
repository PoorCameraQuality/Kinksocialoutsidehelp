import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import {
  getPaymentsVaultStatus,
  lockPaymentsVault,
  setPaymentsVaultPassword,
  unlockPaymentsVault,
} from '../lib/payments-vault.js'

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

export async function registerPaymentsVaultRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/payments-vault', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    return getPaymentsVaultStatus(user.userId)
  })

  app.post(
    '/api/v1/me/payments-vault',
    { ...rateLimitRoute('paymentsVault') },
    async (req, reply) => {
      const user = requireUser(req, reply)
      if (!user) return
      const body = z
        .object({
          loginPassword: z.string().min(1).max(128),
          vaultPassword: z.string().min(1).max(128),
          confirmVaultPassword: z.string().min(1).max(128),
        })
        .safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
      if (body.data.vaultPassword !== body.data.confirmVaultPassword) {
        return reply.status(400).send({ error: 'Payments passwords do not match', code: 'vault_mismatch' })
      }
      const result = await setPaymentsVaultPassword(
        user.userId,
        body.data.loginPassword,
        body.data.vaultPassword,
      )
      if (!result.ok) return reply.status(400).send({ error: result.error, code: result.code })
      return getPaymentsVaultStatus(user.userId)
    },
  )

  app.post(
    '/api/v1/me/payments-vault/unlock',
    { ...rateLimitRoute('paymentsVault') },
    async (req, reply) => {
      const user = requireUser(req, reply)
      if (!user) return
      const body = z.object({ vaultPassword: z.string().min(1).max(128) }).safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
      const result = await unlockPaymentsVault(user.userId, body.data.vaultPassword)
      if (!result.ok) return reply.status(400).send({ error: result.error, code: result.code })
      return getPaymentsVaultStatus(user.userId)
    },
  )

  app.post('/api/v1/me/payments-vault/lock', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    await lockPaymentsVault(user.userId)
    return getPaymentsVaultStatus(user.userId)
  })
}
