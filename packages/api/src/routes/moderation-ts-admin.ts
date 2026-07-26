import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  addModerationCaseNote,
  executeModerationCaseAction,
  getModerationCaseDetail,
  getModerationDashboardCounts,
  listModerationCases,
  listModerationQueueItems,
  ModerationCaseAccessError,
  ModerationCaseNotFoundError,
  MODERATION_CASE_EVENT_TYPES,
  moderationCaseStatusSchema,
  patchModerationCase,
  recordModerationCaseEvent,
} from '../lib/moderation-ts-admin.js'
import { streamMediaAssetForModerator } from '../lib/media-asset-viewer.js'
import {
  createHashListEntryBodySchema,
  createMediaHashListEntry,
  listMediaHashListEntries,
  MediaHashListAdminError,
} from '../lib/media-hash-list-admin.js'
import { getMediaPolicyAdminSnapshot } from '../lib/media-policy.js'
import { readMediaScannerStartupConfig } from '@c2k/shared'
import {
  requireDb,
  DESTRUCTIVE_MODERATION_CASE_ACTIONS,
  requirePlatformModerator,
  requireTrustSafetyAdmin,
  requireUser,
} from '../lib/moderation-route-auth.js'

const patchCaseBody = z
  .object({
    assignedToUserId: z.string().uuid().nullable().optional(),
    status: moderationCaseStatusSchema.optional(),
  })
  .refine((data) => data.assignedToUserId !== undefined || data.status !== undefined, {
    message: 'assignedToUserId or status required',
  })

const noteBody = z.object({
  body: z.string().min(1).max(8000),
})

const caseActionBody = z.object({
  action: z.enum([
    'mark_no_violation',
    'close_duplicate',
    'escalate',
    'hide_content',
    'delete_content',
    'suspend_subject',
    'keep_quarantined',
    'remove_media',
    'restore_media',
  ]),
  note: z.string().max(8000).optional(),
  hardDelete: z.boolean().optional(),
  suspendPermanent: z.boolean().optional(),
})

export async function registerModerationTsAdminRoutes(app: FastifyInstance) {
  app.get('/api/v1/moderation/dashboard', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const counts = await getModerationDashboardCounts(user.userId)
    return reply.send(counts)
  })

  app.get('/api/v1/moderation/queues', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { queue?: string; limit?: string; offset?: string }
    try {
      const result = await listModerationQueueItems(user.userId, {
        queue: q.queue?.trim(),
        limit: Number(q.limit) || 50,
        offset: Number(q.offset) || 0,
      })
      return reply.send(result)
    } catch (err) {
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: err.message })
      }
      if (err instanceof Error && err.message.startsWith('Invalid queue')) {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/api/v1/moderation/cases', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { queue?: string; status?: string; severity?: string; limit?: string; offset?: string }
    try {
      const result = await listModerationCases(user.userId, {
        queue: q.queue?.trim(),
        status: q.status?.trim().toUpperCase(),
        severity: q.severity?.trim().toUpperCase(),
        limit: Number(q.limit) || 50,
        offset: Number(q.offset) || 0,
      })
      return reply.send(result)
    } catch (err) {
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: err.message })
      }
      if (
        err instanceof Error &&
        (err.message.startsWith('Invalid queue') ||
          err.message.startsWith('Invalid status') ||
          err.message.startsWith('Invalid severity'))
      ) {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/api/v1/moderation/cases/:caseId/media-content', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    try {
      const detail = await getModerationCaseDetail(user.userId, caseId)
      const mediaModeration = detail.mediaModeration
      if (!mediaModeration) {
        return reply.status(404).send({ error: 'No media target for this case' })
      }
      if (mediaModeration.malwareBlocked) {
        return reply.status(403).send({ code: 'malware_blocked', error: 'Malware detected' })
      }

      const streamed = await streamMediaAssetForModerator(mediaModeration.mediaAssetId)
      if (!streamed) {
        return reply.status(404).send({ error: 'Media bytes not available' })
      }

      await recordModerationCaseEvent({
        caseId,
        actorUserId: user.userId,
        eventType: MODERATION_CASE_EVENT_TYPES.mediaViewed,
        payload: {
          mediaAssetId: mediaModeration.mediaAssetId,
          targetContentType: detail.case.targetContentType,
          targetContentId: detail.case.targetContentId,
        },
      })

      return reply
        .header('Content-Type', streamed.contentType)
        .header('Cache-Control', 'private, no-store')
        .send(streamed.body)
    } catch (err) {
      if (err instanceof ModerationCaseNotFoundError) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      throw err
    }
  })

  app.get('/api/v1/moderation/cases/:caseId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    try {
      const detail = await getModerationCaseDetail(user.userId, caseId)
      return reply.send(detail)
    } catch (err) {
      if (err instanceof ModerationCaseNotFoundError) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      throw err
    }
  })

  app.patch('/api/v1/moderation/cases/:caseId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    const parsed = patchCaseBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    try {
      const updated = await patchModerationCase(user.userId, caseId, parsed.data)
      return reply.send({ case: updated })
    } catch (err) {
      if (err instanceof ModerationCaseNotFoundError) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      if (err instanceof Error && err.message === 'No valid patch fields') {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })

  app.post('/api/v1/moderation/cases/:caseId/notes', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    const parsed = noteBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    try {
      const updated = await addModerationCaseNote(user.userId, caseId, parsed.data.body)
      return reply.send({ case: updated })
    } catch (err) {
      if (err instanceof ModerationCaseNotFoundError) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      throw err
    }
  })

  app.post('/api/v1/moderation/cases/:caseId/actions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const { caseId } = req.params as { caseId: string }
    const parsed = caseActionBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    if (
      DESTRUCTIVE_MODERATION_CASE_ACTIONS.has(parsed.data.action) &&
      !(await requireTrustSafetyAdmin(user.userId, reply))
    ) {
      return
    }

    try {
      const result = await executeModerationCaseAction(
        user.userId,
        caseId,
        parsed.data.action,
        parsed.data.note,
        {
          hardDelete: parsed.data.hardDelete,
          suspendPermanent: parsed.data.suspendPermanent,
        },
      )
      if (!result.ok) {
        return reply.status(422).send({
          error: result.error,
          unsupported: result.unsupported,
        })
      }
      return reply.send(result)
    } catch (err) {
      if (err instanceof ModerationCaseNotFoundError) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (err instanceof ModerationCaseAccessError) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      if (err instanceof Error && err.message.startsWith('Reason required')) {
        return reply.status(400).send({ error: err.message })
      }
      if (err instanceof Error && err.message.includes('malware-blocked')) {
        return reply.status(422).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/api/v1/moderation/trust-safety/config', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    return reply.send({
      mediaPolicy: getMediaPolicyAdminSnapshot(),
      mediaScanner: readMediaScannerStartupConfig(),
    })
  })

  app.get('/api/v1/moderation/media-hash-list', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const q = req.query as { limit?: string }
    const items = await listMediaHashListEntries({ limit: Number(q.limit) || 50 })
    return reply.send({ items })
  })

  app.post('/api/v1/moderation/media-hash-list', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requirePlatformModerator(user.userId, reply))) return

    const parsed = createHashListEntryBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    try {
      const entry = await createMediaHashListEntry(user.userId, parsed.data)
      return reply.status(201).send({ entry })
    } catch (err) {
      if (err instanceof MediaHashListAdminError) {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })
}
