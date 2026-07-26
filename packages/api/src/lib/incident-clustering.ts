import { createHash } from 'node:crypto'
import { isPlatformCriticalPolicyReason, type PolicyReason } from '@c2k/shared'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { ModerationReportTargetType } from './moderation-ts-target-validate.js'
import { resolveReportScope } from './moderation-report-scope.js'

const CLUSTER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const BURST_WINDOW_MS = 2 * 60 * 60 * 1000

function reportTextHash(note?: string | null): string | null {
  const normalized = note?.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized || normalized.length < 8) return null
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export type IncidentClusterResult = {
  incidentId: string
  linkedReportCount: number
  isNewIncident: boolean
  platformCritical: boolean
}

export async function attachReportToIncident(input: {
  caseId: string
  moderationReportId: string
  reporterId: string
  targetUserId: string | null
  policyReason: PolicyReason
  targetType: ModerationReportTargetType
  targetId: string
  note?: string | null
}): Promise<IncidentClusterResult | null> {
  if (!input.targetUserId) return null

  const scope = await resolveReportScope(input.targetType, input.targetId)
  const scopeType = scope?.scopeType as 'organization' | 'group' | 'event' | 'convention' | undefined
  const scopeId = scope?.scopeId ?? null
  const windowStart = new Date(Date.now() - CLUSTER_WINDOW_MS)

  const openStatuses = ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] as const

  const textHash = reportTextHash(input.note)

  const [existing] = await db
    .select({ id: schema.moderationIncidents.id, metadata: schema.moderationIncidents.metadata })
    .from(schema.moderationIncidents)
    .where(
      and(
        eq(schema.moderationIncidents.primaryUserId, input.targetUserId),
        eq(schema.moderationIncidents.policyReason, input.policyReason),
        inArray(schema.moderationIncidents.status, [...openStatuses]),
        gte(schema.moderationIncidents.createdAt, windowStart),
        scopeType && scopeId
          ? and(eq(schema.moderationIncidents.scopeType, scopeType), eq(schema.moderationIncidents.scopeId, scopeId))
          : undefined,
        sql`(${schema.moderationIncidents.metadata}->>'targetType' IS NULL OR ${schema.moderationIncidents.metadata}->>'targetType' = ${input.targetType})`,
        sql`(${schema.moderationIncidents.metadata}->>'targetId' IS NULL OR ${schema.moderationIncidents.metadata}->>'targetId' = ${input.targetId})`
      )
    )
    .orderBy(desc(schema.moderationIncidents.createdAt))
    .limit(1)

  let incidentId: string
  let isNewIncident: boolean

  if (existing) {
    incidentId = existing.id
    isNewIncident = false
    const priorMeta =
      typeof existing.metadata === 'object' && existing.metadata ? (existing.metadata as Record<string, unknown>) : {}
    const sameTextHashes = new Set<string>(
      Array.isArray(priorMeta.sameTextHashes) ? (priorMeta.sameTextHashes as string[]) : []
    )
    if (textHash) sameTextHashes.add(textHash)
    await db
      .update(schema.moderationIncidents)
      .set({
        updatedAt: new Date(),
        metadata: {
          ...priorMeta,
          targetType: input.targetType,
          targetId: input.targetId,
          lastReportAt: new Date().toISOString(),
          burstWindowDetected: true,
          sameTextHashes: [...sameTextHashes],
          sameTextCount: textHash && sameTextHashes.has(textHash) ? sameTextHashes.size : priorMeta.sameTextCount,
        },
      })
      .where(eq(schema.moderationIncidents.id, incidentId))
  } else {
    const platformCritical = isPlatformCriticalPolicyReason(input.policyReason)
    const [inc] = await db
      .insert(schema.moderationIncidents)
      .values({
        primaryUserId: input.targetUserId,
        policyReason: input.policyReason,
        scopeType: scopeType ?? null,
        scopeId,
        platformCaseId: input.caseId,
        platformEscalatedAt: platformCritical ? new Date() : null,
        status: platformCritical ? 'ESCALATED' : 'OPEN',
        metadata: {
          initialCaseId: input.caseId,
          targetType: input.targetType,
          targetId: input.targetId,
          sameTextHashes: textHash ? [textHash] : [],
          sameTextCount: textHash ? 1 : 0,
        },
      })
      .returning()
    incidentId = inc.id
    isNewIncident = true

    await db.insert(schema.incidentParticipants).values({
      incidentId,
      userId: input.targetUserId,
      role: 'REPORTED_USER',
    })
  }

  const [priorReporter] = await db
    .select({ id: schema.incidentReports.id })
    .from(schema.incidentReports)
    .where(
      and(
        eq(schema.incidentReports.incidentId, incidentId),
        eq(schema.incidentReports.reporterUserId, input.reporterId)
      )
    )
    .limit(1)

  await db.insert(schema.incidentReports).values({
    incidentId,
    moderationReportId: input.moderationReportId,
    reporterUserId: input.reporterId,
    isPrimary: isNewIncident,
    isDuplicate: Boolean(priorReporter),
    relationshipContext: priorReporter ? 'repeat_reporter' : 'independent',
  })

  if (!priorReporter) {
    await db.insert(schema.incidentParticipants).values({
      incidentId,
      userId: input.reporterId,
      role: 'REPORTER',
    })
  }

  const allReports = await db
    .select({
      id: schema.incidentReports.id,
      isDuplicate: schema.incidentReports.isDuplicate,
      createdAt: schema.incidentReports.createdAt,
    })
    .from(schema.incidentReports)
    .where(eq(schema.incidentReports.incidentId, incidentId))

  const duplicateReporterCount = allReports.filter((r) => r.isDuplicate).length
  const independentCount = allReports.length - duplicateReporterCount
  const burstWindowDetected = allReports.some(
    (r) => Date.now() - r.createdAt.getTime() <= BURST_WINDOW_MS
  )
  const possibleDogpile = independentCount >= 3 && burstWindowDetected

  const [incRow] = await db
    .select({ metadata: schema.moderationIncidents.metadata })
    .from(schema.moderationIncidents)
    .where(eq(schema.moderationIncidents.id, incidentId))
    .limit(1)
  const priorMeta =
    typeof incRow?.metadata === 'object' && incRow?.metadata ? (incRow.metadata as Record<string, unknown>) : {}
  const sameTextHashes = Array.isArray(priorMeta.sameTextHashes) ? (priorMeta.sameTextHashes as string[]) : []
  const sameTextCount = textHash ? sameTextHashes.filter((h) => h === textHash).length : 0

  await db
    .update(schema.moderationIncidents)
    .set({
      metadata: {
        ...priorMeta,
        targetType: input.targetType,
        targetId: input.targetId,
        linkedReportCount: allReports.length,
        duplicateReporterCount,
        independentReporterCount: independentCount,
        burstWindowDetected,
        possibleDogpile,
        sameTextCount,
        lastClusterAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.moderationIncidents.id, incidentId))

  return {
    incidentId,
    linkedReportCount: allReports.length,
    isNewIncident,
    platformCritical: isPlatformCriticalPolicyReason(input.policyReason),
  }
}

export async function getIncidentSummaryForUser(userId: string): Promise<{
  openIncidents: number
  totalLinkedReports: number
  recentIncidents: Array<{
    id: string
    status: string
    policyReason: string | null
    linkedReportCount: number
    platformEscalated: boolean
  }>
}> {
  const incidents = await db
    .select({
      id: schema.moderationIncidents.id,
      status: schema.moderationIncidents.status,
      policyReason: schema.moderationIncidents.policyReason,
      platformEscalatedAt: schema.moderationIncidents.platformEscalatedAt,
    })
    .from(schema.moderationIncidents)
    .where(eq(schema.moderationIncidents.primaryUserId, userId))
    .orderBy(desc(schema.moderationIncidents.createdAt))
    .limit(10)

  let totalLinkedReports = 0
  const recentIncidents = []
  for (const inc of incidents) {
    const reports = await db
      .select({ id: schema.incidentReports.id })
      .from(schema.incidentReports)
      .where(eq(schema.incidentReports.incidentId, inc.id))
    totalLinkedReports += reports.length
    recentIncidents.push({
      id: inc.id,
      status: inc.status,
      policyReason: inc.policyReason,
      linkedReportCount: reports.length,
      platformEscalated: Boolean(inc.platformEscalatedAt),
    })
  }

  const openIncidents = incidents.filter((i) =>
    ['OPEN', 'UNDER_REVIEW', 'ESCALATED'].includes(i.status)
  ).length

  return { openIncidents, totalLinkedReports, recentIncidents }
}
