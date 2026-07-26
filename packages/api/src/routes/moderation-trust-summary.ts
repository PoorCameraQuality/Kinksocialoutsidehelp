import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getIncidentSummaryForUser } from '../lib/incident-clustering.js'
import { buildModeratorTrustSummary } from '../lib/trust-summary.js'
import { updateTrustSignalModReview } from '../lib/trust-integrity-signals.js'
import { z } from 'zod'
import { isSiteAdmin } from '../lib/platform-staff.js'
import { registerIncidentResolutionRoutes } from '../lib/incident-resolution.js'
import {
  requireDb,
  requirePlatformModerator,
  requireUser,
} from '../lib/moderation-route-auth.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function registerModerationTrustSummaryRoutes(app: FastifyInstance) {
  registerIncidentResolutionRoutes(app, {
    requireDb,
    requireUser,
    requirePlatformModerator,
  })

  app.get('/api/v1/moderation/users/:userId/trust-summary', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { userId } = req.params as { userId: string }
    if (!UUID_RE.test(userId)) {
      return reply.status(400).send({ error: 'Invalid user id' })
    }

    const viewerIsSiteAdmin = await isSiteAdmin(user.userId)
    const summary = await buildModeratorTrustSummary(userId, { viewerIsSiteAdmin })
    if (!summary) return reply.status(404).send({ error: 'User not found' })

    return reply.send(summary)
  })

  const signalReviewBody = z.object({
    modReviewStatus: z.enum(['REVIEWED', 'DISMISSED', 'ESCALATED']),
  })

  app.patch('/api/v1/moderation/trust-signals/:signalId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { signalId } = req.params as { signalId: string }
    if (!UUID_RE.test(signalId)) return reply.status(400).send({ error: 'Invalid signal id' })

    const parsed = signalReviewBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const ok = await updateTrustSignalModReview(signalId, parsed.data.modReviewStatus, user.userId)
    if (!ok) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/moderation/users/:userId/incidents', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { userId } = req.params as { userId: string }
    if (!UUID_RE.test(userId)) {
      return reply.status(400).send({ error: 'Invalid user id' })
    }

    const summary = await getIncidentSummaryForUser(userId)
    return reply.send({ status: 'available', ...summary })
  })

  app.get('/api/v1/moderation/cases/:caseId/incidents', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    if (!UUID_RE.test(caseId)) {
      return reply.status(400).send({ error: 'Invalid case id' })
    }

    const [caseRow] = await db
      .select({ targetUserId: schema.moderationCases.targetUserId })
      .from(schema.moderationCases)
      .where(eq(schema.moderationCases.id, caseId))
      .limit(1)
    if (!caseRow?.targetUserId) {
      return reply.send({ status: 'unavailable', reason: 'No subject user on case' })
    }

    const incidents = await db
      .select({
        id: schema.moderationIncidents.id,
        status: schema.moderationIncidents.status,
        policyReason: schema.moderationIncidents.policyReason,
        platformEscalatedAt: schema.moderationIncidents.platformEscalatedAt,
        platformCaseId: schema.moderationIncidents.platformCaseId,
        metadata: schema.moderationIncidents.metadata,
      })
      .from(schema.moderationIncidents)
      .where(eq(schema.moderationIncidents.primaryUserId, caseRow.targetUserId))

    const items = []
    for (const inc of incidents) {
      const reports = await db
        .select({
          id: schema.incidentReports.id,
          isDuplicate: schema.incidentReports.isDuplicate,
          relationshipContext: schema.incidentReports.relationshipContext,
        })
        .from(schema.incidentReports)
        .where(eq(schema.incidentReports.incidentId, inc.id))
      const independentReporters = reports.filter((r) => !r.isDuplicate).length
      const meta =
        typeof inc.metadata === 'object' && inc.metadata ? (inc.metadata as Record<string, unknown>) : {}
      items.push({
        id: inc.id,
        status: inc.status,
        policyReason: inc.policyReason,
        linkedReportCount: reports.length,
        independentReporterCount: independentReporters,
        duplicateBurst: reports.some((r) => r.isDuplicate),
        burstWindowDetected: Boolean(meta.burstWindowDetected),
        possibleDogpile: Boolean(meta.possibleDogpile),
        sameTextCount: typeof meta.sameTextCount === 'number' ? meta.sameTextCount : 0,
        platformEscalated: Boolean(inc.platformEscalatedAt),
        linkedToThisCase: inc.platformCaseId === caseId,
      })
    }

    return reply.send({ status: 'available', incidents: items })
  })
}
