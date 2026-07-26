import { APP_NAME } from '@c2k/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import {
  buildAccountWelcomeEmail,
  buildEmailTestPayload,
  emailStatusPayload,
  sendEventRsvpConfirmationEmail,
} from '../lib/transactional-email.js'
import { sendEmail } from '../lib/mailer.js'
import { getUserEmailById } from '../lib/user-email.js'

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

export async function registerEmailRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/email/status', async (req, reply) => {
    const actor = requireUser(req, reply)
    if (!actor) return
    return reply.send(emailStatusPayload())
  })

  const testBody = z.object({
    template: z.enum(['event_rsvp_confirm', 'account_welcome']).optional(),
  })

  app.post('/api/v1/me/email/test-send', async (req, reply) => {
    const actor = requireUser(req, reply)
    if (!actor) return
    const parsed = testBody.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const recipient = await getUserEmailById(actor.userId)
    if (!recipient) return reply.status(404).send({ error: 'User email not found' })

    const [user] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1)
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const template = parsed.data.template ?? 'event_rsvp_confirm'
    if (template === 'event_rsvp_confirm') {
      const sample = buildEmailTestPayload()
      const result = await sendEmail({
        to: recipient,
        subject: `[${APP_NAME} test] ${sample.subject}`,
        text: sample.text,
        html: sample.html,
      })
      return reply.send({ ok: result.ok, template, error: result.error ?? null })
    }
    if (template === 'account_welcome') {
      const sample = buildAccountWelcomeEmail({ to: recipient, username: user.username })
      const result = await sendEmail({
        to: recipient,
        subject: `[${APP_NAME} test] ${sample.subject}`,
        text: sample.text,
        html: sample.html,
      })
      return reply.send({ ok: result.ok, template, error: result.error ?? null })
    }

    return reply.status(400).send({ error: 'Unknown template' })
  })
}
