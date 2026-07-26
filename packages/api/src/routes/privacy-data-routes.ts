import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { PLATFORM_DEFAULT_DM_RETENTION_DAYS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { softDeleteUserAccount } from '../lib/deleted-account-sweep.js'
import { isUnderLegalHold } from '../lib/legal-hold.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'

const PRIVACY_DELETION_DISCLAIMER =
  'Deleting something removes it from ordinary use and starts the deletion or anonymization process. Some data may be retained temporarily for safety, abuse prevention, backups, legal compliance, or active reports. Legal holds pause deletion where required. Backups may retain copies until the backup retention window expires.'

export async function registerPrivacyDataRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/privacy/controls', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    return reply.send({
      disclaimer: PRIVACY_DELETION_DISCLAIMER,
      platformDefaultDmRetentionDays: PLATFORM_DEFAULT_DM_RETENTION_DAYS,
      controls: [
        'download_my_data',
        'delete_account',
        'delete_uploaded_media',
        'delete_dm_conversation',
        'dm_retention_preference',
        'request_manual_privacy_review',
      ],
    })
  })

  app.delete('/api/v1/me/conversations/:conversationId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const params = z.object({ conversationId: z.string().uuid() }).safeParse(req.params)
    if (!params.success) return reply.status(400).send({ error: 'Invalid conversation id' })

    const conversationId = params.data.conversationId
    if (await isUnderLegalHold('message_thread', conversationId)) {
      return reply.status(409).send({ error: 'Conversation is under legal hold and cannot be deleted' })
    }
    if (await isUnderLegalHold('user', user.userId)) {
      return reply.status(409).send({ error: 'Your account is under legal hold' })
    }

    const [participant] = await db
      .select({ conversationId: schema.conversationParticipants.conversationId })
      .from(schema.conversationParticipants)
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )
      .limit(1)

    if (!participant) return reply.status(404).send({ error: 'Conversation not found' })

    await db
      .update(schema.conversationParticipants)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )

    return reply.send({ ok: true, disclaimer: PRIVACY_DELETION_DISCLAIMER })
  })

  app.delete('/api/v1/me/media/:mediaAssetId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const params = z.object({ mediaAssetId: z.string().uuid() }).safeParse(req.params)
    if (!params.success) return reply.status(400).send({ error: 'Invalid media id' })

    const mediaAssetId = params.data.mediaAssetId
    if (await isUnderLegalHold('media', mediaAssetId)) {
      return reply.status(409).send({ error: 'Media is under legal hold' })
    }

    const [asset] = await db
      .select({
        id: schema.mediaAssets.id,
        uploaderUserId: schema.mediaAssets.uploaderUserId,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, mediaAssetId))
      .limit(1)

    if (!asset || asset.uploaderUserId !== user.userId) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    await db
      .update(schema.mediaAssets)
      .set({ uploadStatus: 'REMOVED', updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, mediaAssetId))

    return reply.send({ ok: true, disclaimer: PRIVACY_DELETION_DISCLAIMER })
  })

  app.post('/api/v1/me/privacy/manual-review', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const body = z.object({ note: z.string().max(2000).optional() }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const [row] = await db
      .insert(schema.userPrivacyRequests)
      .values({
        userId: user.userId,
        requestType: 'DEACTIVATE',
        status: 'PENDING',
        reason: body.data.note ?? 'Manual privacy review requested',
      })
      .returning()

    return reply.status(201).send({ request: row, message: 'Privacy review request recorded. Staff will follow up.' })
  })
}

export { softDeleteUserAccount, PRIVACY_DELETION_DISCLAIMER }
