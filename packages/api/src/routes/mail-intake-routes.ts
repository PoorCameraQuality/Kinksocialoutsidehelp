import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import {
  canViewMailIntakeItem,
  canViewMailIntakeTab,
  mailboxKeyFromAddress,
  visibilitiesForTab,
  type MailIntakeTab,
} from '../lib/mail-intake-auth.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

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

const TAB_VALUES = ['support', 'legal', 'business', 'abuse', 'security'] as const

const patchBody = z.object({
  status: z.enum(['new', 'triaged', 'assigned', 'waiting', 'closed']).optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  linkedUserId: z.string().uuid().nullable().optional(),
  linkedModerationCaseId: z.string().uuid().nullable().optional(),
  reason: z.string().min(1).max(8000),
})

export async function registerMailIntakeRoutes(app: FastifyInstance) {
  app.get('/api/v1/admin/mail-intake/summary', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const counts: Record<string, number> = {}
    for (const tab of TAB_VALUES) {
      if (!(await canViewMailIntakeTab(actor.userId, tab))) {
        counts[tab] = 0
        continue
      }
      const vis = visibilitiesForTab(tab)
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.mailIntakeItems)
        .where(and(eq(schema.mailIntakeItems.status, 'new'), inArray(schema.mailIntakeItems.visibility, vis)))
      counts[tab] = row?.n ?? 0
    }
    return reply.send({ newCounts: counts })
  })

  app.get('/api/v1/admin/mail-intake/:tab', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const tab = (req.params as { tab: string }).tab as MailIntakeTab
    if (!TAB_VALUES.includes(tab)) {
      return reply.status(400).send({ error: 'Invalid tab' })
    }
    if (!(await canViewMailIntakeTab(actor.userId, tab))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const q = req.query as { status?: string; limit?: string; offset?: string }
    const limit = Math.min(Number(q.limit) || 50, 100)
    const offset = Number(q.offset) || 0
    const vis = visibilitiesForTab(tab)
    const conditions = [inArray(schema.mailIntakeItems.visibility, vis)]
    if (q.status) {
      conditions.push(eq(schema.mailIntakeItems.status, q.status as typeof schema.mailIntakeItems.$inferSelect.status))
    }

    const rows = await db
      .select({
        id: schema.mailIntakeItems.id,
        mailbox: schema.mailIntakeItems.mailbox,
        fromName: schema.mailIntakeItems.fromName,
        fromEmail: schema.mailIntakeItems.fromEmail,
        subject: schema.mailIntakeItems.subject,
        receivedAt: schema.mailIntakeItems.receivedAt,
        status: schema.mailIntakeItems.status,
        priority: schema.mailIntakeItems.priority,
        assignedToUserId: schema.mailIntakeItems.assignedToUserId,
        linkedUserId: schema.mailIntakeItems.linkedUserId,
        linkedModerationCaseId: schema.mailIntakeItems.linkedModerationCaseId,
        visibility: schema.mailIntakeItems.visibility,
      })
      .from(schema.mailIntakeItems)
      .where(and(...conditions))
      .orderBy(desc(schema.mailIntakeItems.receivedAt))
      .limit(limit)
      .offset(offset)

    return reply.send({ items: rows, tab })
  })

  app.get('/api/v1/admin/mail-intake/item/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const { id } = req.params as { id: string }
    const [row] = await db.select().from(schema.mailIntakeItems).where(eq(schema.mailIntakeItems.id, id)).limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewMailIntakeItem(actor.userId, row))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    return reply.send({
      item: {
        ...row,
        tab: mailboxKeyFromAddress(row.mailbox),
      },
    })
  })

  app.patch('/api/v1/admin/mail-intake/item/:id', { ...rateLimitRoute('reports') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const { id } = req.params as { id: string }
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [existing] = await db.select().from(schema.mailIntakeItems).where(eq(schema.mailIntakeItems.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewMailIntakeItem(actor.userId, existing))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const [row] = await db
      .update(schema.mailIntakeItems)
      .set({
        status: parsed.data.status ?? existing.status,
        priority: parsed.data.priority ?? existing.priority,
        assignedToUserId:
          parsed.data.assignedToUserId !== undefined ? parsed.data.assignedToUserId : existing.assignedToUserId,
        linkedUserId: parsed.data.linkedUserId !== undefined ? parsed.data.linkedUserId : existing.linkedUserId,
        linkedModerationCaseId:
          parsed.data.linkedModerationCaseId !== undefined ?
            parsed.data.linkedModerationCaseId
          : existing.linkedModerationCaseId,
        updatedAt: new Date(),
      })
      .where(eq(schema.mailIntakeItems.id, id))
      .returning()

    await recordModerationAudit({
      actorUserId: actor.userId,
      scopeType: 'platform',
      verb: 'mail_intake_update',
      targetType: 'mail_intake_item',
      targetId: id,
      payload: { reason: parsed.data.reason, status: parsed.data.status },
    })

    return reply.send({ item: row })
  })
}
