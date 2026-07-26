import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { requiresPrivilegedStepUp } from '../lib/legal-admin-auth.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { isSiteOwner } from '../lib/platform-staff.js'
import { getEmailFromUserRow } from '../lib/user-email.js'

async function requireSiteOwner(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isSiteOwner(userId))) {
    reply.status(403).send({ error: 'Forbidden. Owner access required' })
    return false
  }
  return true
}

/** PR 3 (Z2): sensitive reveals require a recent password step-up (POST /api/v1/admin/security/step-up). */
async function requireRecentStepUp(userId: string, reply: FastifyReply): Promise<boolean> {
  if (await requiresPrivilegedStepUp(userId)) {
    reply.status(403).send({ error: 'step_up_required', code: 'step_up_required' })
    return false
  }
  return true
}

const revealBody = z.object({
  field: z.enum(['email', 'registration_ip']),
  reason: z.string().min(10).max(500),
})

export async function registerAdminPrivacyRoutes(app: FastifyInstance) {
  app.post('/api/v1/admin/users/:userId/reveal-sensitive', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    if (!(await requireSiteOwner(actor.userId, reply))) return
    if (!(await requireRecentStepUp(actor.userId, reply))) return

    const { userId } = req.params as { userId: string }
    const parsed = revealBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body. Reason must be at least 10 characters' })
    }

    const [target] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        emailCiphertext: schema.users.emailCiphertext,
        emailKeyVersion: schema.users.emailKeyVersion,
        registrationIpPrefix: schema.users.registrationIpPrefix,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!target) return reply.status(404).send({ error: 'User not found' })

    let value: string | null = null
    if (parsed.data.field === 'email') {
      value = getEmailFromUserRow(target)
    } else {
      value = target.registrationIpPrefix ?? null
    }

    await recordModerationAudit({
      actorUserId: actor.userId,
      scopeType: 'platform',
      scopeId: null,
      verb: 'sensitive_data.reveal',
      targetType: 'user',
      targetId: userId,
      payload: {
        field: parsed.data.field,
        reason: parsed.data.reason,
        targetUsername: target.username,
      },
    })

    return reply.send({
      field: parsed.data.field,
      value,
      revealedAt: new Date().toISOString(),
    })
  })
}
