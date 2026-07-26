import {
  isKnownPolicyReason,
  mapLegacyReportCategoryToPolicyReason,
  policyReasonSchema,
  POLICY_REASONS,
} from '@c2k/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createReport,
  listReporterModerationReports,
  ReportTargetValidationError,
} from '../lib/moderation-ts-intake.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

const createReportBody = z
  .object({
    targetType: z.string().min(1).max(64),
    targetId: z.string().min(1).max(256),
    policyReason: policyReasonSchema.optional(),
    /** Legacy intake field - mapped to policyReason when policyReason omitted. */
    category: z.string().min(1).max(64).optional(),
    note: z.string().max(8000).optional(),
    /** Legacy alias for note. */
    body: z.string().max(8000).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.policyReason && !data.category) {
      ctx.addIssue({
        code: 'custom',
        message: 'policyReason or category is required',
        path: ['policyReason'],
      })
    }
    if (data.policyReason === POLICY_REASONS.other && !(data.note?.trim() || data.body?.trim())) {
      ctx.addIssue({
        code: 'custom',
        message: 'note is required when policyReason is OTHER',
        path: ['note'],
      })
    }
  })

function resolvePolicyReason(body: z.infer<typeof createReportBody>) {
  if (body.policyReason) {
    return { reason: body.policyReason, requiresRetriage: false as const }
  }
  const mapped = mapLegacyReportCategoryToPolicyReason(body.category!)
  if (!mapped) return null
  return mapped
}

export async function registerModerationTsReportsRoutes(app: FastifyInstance) {
  app.post('/api/v1/moderation/reports', { ...rateLimitRoute('reports') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const parsed = createReportBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const resolved = resolvePolicyReason(parsed.data)
    if (!resolved) return reply.status(400).send({ error: 'Invalid policy reason or category' })
    if (!isKnownPolicyReason(resolved.reason)) {
      return reply.status(400).send({ error: 'Invalid policy reason' })
    }

    try {
      const result = await createReport({
        reporterId: user.userId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        policyReason: resolved.reason,
        note: parsed.data.note ?? parsed.data.body ?? null,
      })

      return reply.send({
        caseId: result.caseId,
        reportId: result.reportId,
        id: result.reportId,
        status: result.status,
        queue: result.queue,
        severity: result.severity,
        duplicate: result.duplicate,
        requiresRetriage: resolved.requiresRetriage,
      })
    } catch (err) {
      if (err instanceof ReportTargetValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/api/v1/me/moderation/reports', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const q = req.query as { limit?: string }
    const limit = Number(q.limit) || 50
    const reports = await listReporterModerationReports(user.userId, limit)
    return reply.send({
      reports: reports.map((row) => ({
        reportId: row.reportId,
        caseId: row.caseId,
        id: row.reportId,
        targetType: row.targetType,
        targetId: row.targetId,
        policyReason: row.policyReason,
        status: row.status,
        queue: row.queue,
        createdAt: row.createdAt,
      })),
    })
  })
}
