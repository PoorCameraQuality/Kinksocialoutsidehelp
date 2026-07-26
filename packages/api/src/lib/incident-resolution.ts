import type { FastifyReply } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

type IncidentFinding =
  | 'NO_VIOLATION'
  | 'INSUFFICIENT_INFO'
  | 'CONCERNING_PATTERN'
  | 'LOCAL_RULE_VIOLATION'
  | 'SPAM_OR_DISRUPTION'
  | 'BOUNDARY_WARNING'
  | 'CONFIRMED_SPAM'
  | 'CONFIRMED_HARASSMENT'
  | 'CONFIRMED_CONSENT_VIOLATION'
  | 'CONFIRMED_SEVERE_SAFETY_VIOLATION'
  | 'RETALIATION_OR_BAD_FAITH_REPORT'
  | 'ESCALATED_TO_PLATFORM'

type SignalSpec = {
  signalType: string
  visibility: 'PLATFORM_MOD' | 'SCOPED_MOD' | 'SITE_ADMIN_ONLY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  targetUserId?: 'primary' | 'reporter'
}

const FINDING_SIGNALS: Partial<Record<IncidentFinding, SignalSpec>> = {
  CONCERNING_PATTERN: {
    signalType: 'CONCERNING_PATTERN',
    visibility: 'PLATFORM_MOD',
    severity: 'LOW',
    targetUserId: 'primary',
  },
  BOUNDARY_WARNING: {
    signalType: 'BOUNDARY_WARNING',
    visibility: 'SCOPED_MOD',
    severity: 'LOW',
    targetUserId: 'primary',
  },
  LOCAL_RULE_VIOLATION: {
    signalType: 'LOCAL_RULE_VIOLATION',
    visibility: 'SCOPED_MOD',
    severity: 'MEDIUM',
    targetUserId: 'primary',
  },
  SPAM_OR_DISRUPTION: {
    signalType: 'SPAM_OR_DISRUPTION',
    visibility: 'SCOPED_MOD',
    severity: 'MEDIUM',
    targetUserId: 'primary',
  },
  CONFIRMED_SPAM: {
    signalType: 'CONFIRMED_SPAM',
    visibility: 'PLATFORM_MOD',
    severity: 'MEDIUM',
    targetUserId: 'primary',
  },
  CONFIRMED_HARASSMENT: {
    signalType: 'CONFIRMED_HARASSMENT',
    visibility: 'PLATFORM_MOD',
    severity: 'HIGH',
    targetUserId: 'primary',
  },
  CONFIRMED_CONSENT_VIOLATION: {
    signalType: 'CONFIRMED_CONSENT_VIOLATION',
    visibility: 'PLATFORM_MOD',
    severity: 'HIGH',
    targetUserId: 'primary',
  },
  CONFIRMED_SEVERE_SAFETY_VIOLATION: {
    signalType: 'CONFIRMED_SEVERE_SAFETY_VIOLATION',
    visibility: 'SITE_ADMIN_ONLY',
    severity: 'CRITICAL',
    targetUserId: 'primary',
  },
  RETALIATION_OR_BAD_FAITH_REPORT: {
    signalType: 'BAD_FAITH_REPORT',
    visibility: 'PLATFORM_MOD',
    severity: 'MEDIUM',
    targetUserId: 'reporter',
  },
}

export async function resolveIncidentFinding(input: {
  incidentId: string
  finding: IncidentFinding
  status: 'RESOLVED' | 'CLOSED_NO_VIOLATION'
  reviewedBy: string
  resolutionNote?: string | null
}): Promise<{ incidentId: string; signalsCreated: number }> {
  const [incident] = await db
    .select()
    .from(schema.moderationIncidents)
    .where(eq(schema.moderationIncidents.id, input.incidentId))
    .limit(1)
  if (!incident) throw new Error('Incident not found')

  await db
    .update(schema.moderationIncidents)
    .set({
      finding: input.finding,
      status: input.status,
      reviewedBy: input.reviewedBy,
      resolvedAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...(typeof incident.metadata === 'object' && incident.metadata ? incident.metadata : {}),
        resolutionNote: input.resolutionNote ?? null,
      },
    })
    .where(eq(schema.moderationIncidents.id, input.incidentId))

  await db.insert(schema.incidentActions).values({
    incidentId: input.incidentId,
    actionType: 'FINDING_RECORDED',
    targetUserId: incident.primaryUserId,
    scopeType: incident.scopeType,
    scopeId: incident.scopeId,
    createdBy: input.reviewedBy,
    metadata: { finding: input.finding, status: input.status },
  })

  let signalsCreated = 0
  const spec = FINDING_SIGNALS[input.finding]
  if (spec) {
    let targetUserId = incident.primaryUserId
    if (spec.targetUserId === 'reporter') {
      const [reporter] = await db
        .select({ userId: schema.incidentParticipants.userId })
        .from(schema.incidentParticipants)
        .where(
          and(
            eq(schema.incidentParticipants.incidentId, input.incidentId),
            eq(schema.incidentParticipants.role, 'REPORTER')
          )
        )
        .limit(1)
      if (!reporter) return { incidentId: input.incidentId, signalsCreated: 0 }
      targetUserId = reporter.userId
    }

    const [existing] = await db
      .select({ id: schema.trustSignalEvents.id })
      .from(schema.trustSignalEvents)
      .where(
        and(
          eq(schema.trustSignalEvents.sourceType, 'incident_finding'),
          eq(schema.trustSignalEvents.sourceId, input.incidentId),
          eq(schema.trustSignalEvents.signalType, spec.signalType)
        )
      )
      .limit(1)

    if (!existing) {
      await db.insert(schema.trustSignalEvents).values({
        userId: targetUserId,
        scopeType: incident.scopeType,
        scopeId: incident.scopeId,
        signalType: spec.signalType,
        sourceType: 'incident_finding',
        sourceId: input.incidentId,
        severity: spec.severity,
        confidence: 0.85,
        visibility: spec.visibility,
        status: 'ACTIVE',
        createdBy: input.reviewedBy,
        metadata: { finding: input.finding },
      })
      signalsCreated = 1

      const rollupScope = await db
        .select({ id: schema.trustSignalRollups.id, cautionSignalCount: schema.trustSignalRollups.cautionSignalCount })
        .from(schema.trustSignalRollups)
        .where(
          and(
            eq(schema.trustSignalRollups.userId, targetUserId),
            incident.scopeType && incident.scopeId
              ? and(
                  eq(schema.trustSignalRollups.scopeType, incident.scopeType),
                  eq(schema.trustSignalRollups.scopeId, incident.scopeId)
                )
              : undefined
          )
        )
        .limit(1)

      if (rollupScope[0]) {
        await db
          .update(schema.trustSignalRollups)
          .set({
            cautionSignalCount: (rollupScope[0].cautionSignalCount ?? 0) + 1,
            lastRecomputedAt: new Date(),
          })
          .where(eq(schema.trustSignalRollups.id, rollupScope[0].id))
      }
    }
  }

  if (input.finding === 'ESCALATED_TO_PLATFORM') {
    await db
      .update(schema.moderationIncidents)
      .set({ platformEscalatedAt: new Date(), status: 'ESCALATED' })
      .where(eq(schema.moderationIncidents.id, input.incidentId))
  }

  return { incidentId: input.incidentId, signalsCreated }
}

export function registerIncidentResolutionRoutes(
  app: import('fastify').FastifyInstance,
  auth: {
    requireDb: (reply: FastifyReply) => boolean
    requireUser: (req: import('fastify').FastifyRequest, reply: FastifyReply) => { userId: string } | null
    requirePlatformModerator: (userId: string, reply: FastifyReply) => Promise<boolean>
  }
) {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  app.patch('/api/v1/moderation/incidents/:incidentId', async (req, reply) => {
    if (!auth.requireDb(reply)) return
    const user = auth.requireUser(req, reply)
    if (!user) return
    if (!(await auth.requirePlatformModerator(user.userId, reply))) return

    const { incidentId } = req.params as { incidentId: string }
    if (!UUID_RE.test(incidentId)) return reply.status(400).send({ error: 'Invalid incident id' })

    const body = req.body as { finding?: IncidentFinding; status?: 'RESOLVED' | 'CLOSED_NO_VIOLATION'; note?: string }
    if (!body.finding || !body.status) return reply.status(400).send({ error: 'finding and status required' })

    try {
      const result = await resolveIncidentFinding({
        incidentId,
        finding: body.finding,
        status: body.status,
        reviewedBy: user.userId,
        resolutionNote: body.note ?? null,
      })
      return reply.send(result)
    } catch {
      return reply.status(404).send({ error: 'Incident not found' })
    }
  })
}
