import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { recordOwnerInvestigationAccess } from '../lib/owner-investigation-audit.js'
import {
  loadOwnerActivityTimeline,
  loadOwnerDmConversations,
  loadOwnerDmMessages,
  loadOwnerInvestigationSummary,
  loadOwnerMediaBundle,
  loadOwnerModerationBundle,
  loadOwnerSensitiveAccount,
} from '../lib/owner-investigation-service.js'
import { requiresPrivilegedStepUp } from '../lib/legal-admin-auth.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { isSiteOwner } from '../lib/platform-staff.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

export const INVESTIGATION_REASON_HEADER = 'x-c2k-investigation-reason'

function parseReason(req: FastifyRequest, reply: FastifyReply): string | null {
  const header = req.headers[INVESTIGATION_REASON_HEADER]
  const fromHeader = typeof header === 'string' ? header.trim() : ''
  if (fromHeader.length >= 10 && fromHeader.length <= 500) return fromHeader

  const q = req.query as { reason?: string }
  const fromQuery = typeof q.reason === 'string' ? q.reason.trim() : ''
  if (fromQuery.length >= 10 && fromQuery.length <= 500) {
    reply
      .header('Deprecation', 'true')
      .header('Link', '</docs/LEGAL_REQUEST_AND_DATA_MINIMIZATION.md>; rel="deprecation"')
    return fromQuery
  }

  reply.status(400).send({
    error: `Header ${INVESTIGATION_REASON_HEADER} is required (minimum 10 characters)`,
  })
  return null
}

async function requireOwnerActor(req: FastifyRequest, reply: FastifyReply): Promise<{ userId: string } | null> {
  const actor = requireUser(req, reply)
  if (!actor) return null
  if (!(await isSiteOwner(actor.userId))) {
    reply.status(403).send({ error: 'Forbidden. Owner access required' })
    return null
  }
  // PR 3 (Z2): owner investigation surfaces expose PII/DMs — require a recent
  // password step-up (POST /api/v1/admin/security/step-up), same as legal admin.
  if (await requiresPrivilegedStepUp(actor.userId)) {
    reply.status(403).send({ error: 'step_up_required', code: 'step_up_required' })
    return null
  }
  return actor
}

const ownerRateLimit = rateLimitRoute('ownerInvestigation')

export async function registerOwnerInvestigationRoutes(app: FastifyInstance) {
  app.get('/api/v1/admin/owner/investigations/users/:userId', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const { userId } = req.params as { userId: string }

    const summary = await loadOwnerInvestigationSummary(userId)
    if (!summary) return reply.status(404).send({ error: 'User not found' })

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'account_overview',
      reason: 'account overview (no sensitive data)',
      req,
      success: true,
      recordsViewed: 1,
      targetUsername: summary.user.username,
    })

    return reply.send(summary)
  })

  app.get('/api/v1/admin/owner/investigations/users/:userId/sensitive', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const reason = parseReason(req, reply)
    if (!reason) return
    const { userId } = req.params as { userId: string }

    const data = await loadOwnerSensitiveAccount(userId)
    if (!data) return reply.status(404).send({ error: 'User not found' })

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'sensitive_account',
      reason,
      req,
      success: true,
      recordsViewed: 1,
      targetUsername: null,
    })

    return reply.send(data)
  })

  app.get('/api/v1/admin/owner/investigations/users/:userId/activity', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const reason = parseReason(req, reply)
    if (!reason) return
    const { userId } = req.params as { userId: string }

    const timeline = await loadOwnerActivityTimeline(userId)
    const recordsViewed =
      timeline.posts.length +
      timeline.comments.length +
      timeline.activities.length +
      timeline.reportsFiled.length

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'activity_timeline',
      reason,
      req,
      success: true,
      recordsViewed,
    })

    return reply.send(timeline)
  })

  app.get('/api/v1/admin/owner/investigations/users/:userId/dms', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const reason = parseReason(req, reply)
    if (!reason) return
    const { userId } = req.params as { userId: string }

    const conversations = await loadOwnerDmConversations(userId)

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'dm_list',
      reason,
      req,
      success: true,
      recordsViewed: conversations.length,
    })

    return reply.send({ conversations })
  })

  app.get(
    '/api/v1/admin/owner/investigations/users/:userId/dms/:conversationId/messages',
    { ...ownerRateLimit },
    async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = await requireOwnerActor(req, reply)
      if (!actor) return
      const reason = parseReason(req, reply)
      if (!reason) return
      const { userId, conversationId } = req.params as { userId: string; conversationId: string }

      const result = await loadOwnerDmMessages(userId, conversationId)
      if (!result) return reply.status(404).send({ error: 'Conversation not found for user' })

      await recordOwnerInvestigationAccess({
        actorUserId: actor.userId,
        targetUserId: userId,
        section: 'dm_messages',
        reason,
        req,
        success: true,
        recordsViewed: result.items.length,
        dmContentsOpened: true,
      })

      return reply.send(result)
    },
  )

  app.get('/api/v1/admin/owner/investigations/users/:userId/moderation', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const reason = parseReason(req, reply)
    if (!reason) return
    const { userId } = req.params as { userId: string }

    const bundle = await loadOwnerModerationBundle(userId)
    const recordsViewed =
      bundle.casesAgainst.length +
      bundle.reportsFiled.length +
      bundle.scopeBans.length +
      bundle.blocksOut.length +
      bundle.blocksIn.length +
      bundle.mutesOut.length

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'moderation',
      reason,
      req,
      success: true,
      recordsViewed,
    })

    return reply.send(bundle)
  })

  app.get('/api/v1/admin/owner/investigations/users/:userId/media', { ...ownerRateLimit }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = await requireOwnerActor(req, reply)
    if (!actor) return
    const reason = parseReason(req, reply)
    if (!reason) return
    const { userId } = req.params as { userId: string }

    const items = await loadOwnerMediaBundle(userId)

    await recordOwnerInvestigationAccess({
      actorUserId: actor.userId,
      targetUserId: userId,
      section: 'media',
      reason,
      req,
      success: true,
      recordsViewed: items.length,
    })

    return reply.send({ items })
  })
}
