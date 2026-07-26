import { and, desc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { resolveModerationReportContext } from '../lib/moderation-report-context.js'
import {
  executeModerationReportAction,
  ReportActionError,
} from '../lib/moderation-report-actions.js'
import {
  requireDb,
  requirePlatformModerator,
  requireTrustSafetyAdmin,
  requireUser,
} from '../lib/moderation-route-auth.js'

const REPORT_STATUSES = ['OPEN', 'TRIAGED', 'RESOLVED', 'DISMISSED'] as const

function normalizeStatus(raw: string): (typeof REPORT_STATUSES)[number] | null {
  const u = raw.trim().toUpperCase()
  return (REPORT_STATUSES as readonly string[]).includes(u) ? (u as (typeof REPORT_STATUSES)[number]) : null
}

export async function registerModerationReportsRoutes(app: FastifyInstance) {
  app.get('/api/v1/moderation/summary', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const [openReports] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.reports)
      .where(eq(schema.reports.status, 'OPEN'))

    const [openFlags] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.profileReviewFlags)
      .where(eq(schema.profileReviewFlags.status, 'OPEN'))

    return reply.send({
      openReports: openReports?.count ?? 0,
      openProfileFlags: openFlags?.count ?? 0,
    })
  })

  app.get('/api/v1/moderation/reports', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { status?: string; targetType?: string; limit?: string; offset?: string }
    const statusFilter = q.status?.trim().toUpperCase()
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100)
    const offset = Math.max(Number(q.offset) || 0, 0)
    const targetTypeFilter = q.targetType?.trim()

    const conditions = []
    if (statusFilter && statusFilter !== 'ALL') {
      const normalized = normalizeStatus(statusFilter)
      if (!normalized) return reply.status(400).send({ error: 'Invalid status filter' })
      conditions.push(eq(schema.reports.status, normalized))
    }
    if (targetTypeFilter) {
      conditions.push(eq(schema.reports.targetType, targetTypeFilter))
    }

    const rows = await db
      .select({
        id: schema.reports.id,
        targetType: schema.reports.targetType,
        targetId: schema.reports.targetId,
        category: schema.reports.category,
        status: schema.reports.status,
        createdAt: schema.reports.createdAt,
        reporterId: schema.reports.reporterId,
        reporterUsername: schema.users.username,
      })
      .from(schema.reports)
      .innerJoin(schema.users, eq(schema.reports.reporterId, schema.users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.reports.createdAt))
      .limit(limit)
      .offset(offset)

    const items = await Promise.all(
      rows.map(async (row) => {
        const context = await resolveModerationReportContext(row.targetType, row.targetId)
        return {
          ...row,
          context,
        }
      })
    )

    return reply.send({ items, limit, offset })
  })

  app.get('/api/v1/moderation/reports/:reportId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { reportId } = req.params as { reportId: string }
    const [row] = await db
      .select({
        id: schema.reports.id,
        targetType: schema.reports.targetType,
        targetId: schema.reports.targetId,
        category: schema.reports.category,
        body: schema.reports.body,
        status: schema.reports.status,
        meta: schema.reports.meta,
        createdAt: schema.reports.createdAt,
        reporterId: schema.reports.reporterId,
        reporterUsername: schema.users.username,
      })
      .from(schema.reports)
      .innerJoin(schema.users, eq(schema.reports.reporterId, schema.users.id))
      .where(eq(schema.reports.id, reportId))
      .limit(1)

    if (!row) return reply.status(404).send({ error: 'Not found' })

    const context = await resolveModerationReportContext(row.targetType, row.targetId)
    return reply.send({ report: { ...row, context } })
  })

  const patchBody = z.object({
    status: z.enum(['OPEN', 'TRIAGED', 'RESOLVED', 'DISMISSED']),
    note: z.string().max(4000).optional(),
  })

  app.patch('/api/v1/moderation/reports/:reportId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { reportId } = req.params as { reportId: string }
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [existing] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.id, reportId))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const prevMeta =
      existing.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
        ? (existing.meta as Record<string, unknown>)
        : {}
    const nextMeta = {
      ...prevMeta,
      ...(parsed.data.note !== undefined ? { moderatorNote: parsed.data.note } : {}),
      lastActionBy: user.userId,
      lastActionAt: new Date().toISOString(),
    }

    const [updated] = await db
      .update(schema.reports)
      .set({
        status: parsed.data.status,
        meta: nextMeta,
      })
      .where(eq(schema.reports.id, reportId))
      .returning()

    return reply.send({ report: updated })
  })

  const reportActionBody = z.object({
    action: z.enum(['delete_content', 'suspend_subject', 'delete_and_suspend']),
    note: z.string().trim().min(1).max(8000),
    preserveEvidence: z.boolean().optional(),
    hardDelete: z.boolean().optional(),
    suspendPermanent: z.boolean().optional(),
  })

  app.post('/api/v1/moderation/reports/:reportId/actions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyAdmin(user.userId, reply))) return

    const { reportId } = req.params as { reportId: string }
    const parsed = reportActionBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    try {
      const result = await executeModerationReportAction({
        actorUserId: user.userId,
        reportId,
        action: parsed.data.action,
        note: parsed.data.note,
        preserveEvidence: parsed.data.preserveEvidence,
        hardDelete: parsed.data.hardDelete,
        suspendPermanent: parsed.data.suspendPermanent,
      })
      return reply.send(result)
    } catch (err) {
      if (err instanceof ReportActionError) {
        return reply.status(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })
}
