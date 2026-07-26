import {
  feedSettingsSchema,
  mergeFeedSettings,
  mergeNotificationSettings,
  mergePrivacySettings,
  normalizeUserSettingsBundle,
  notificationSettingsSchema,
  privacySettingsSchema,
} from '@c2k/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { ensureUserSettingsRow, replyIfViewerUserNotFound } from '../lib/user-settings-row.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const patchBody = z.object({
  privacy: privacySettingsSchema.partial().optional(),
  notifications: notificationSettingsSchema.partial().optional(),
  feed: feedSettingsSchema.partial().optional(),
})

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Settings API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    try {
      const row = await ensureUserSettingsRow(userId)
      const bundle = normalizeUserSettingsBundle({
        privacySettings: row.privacySettings,
        notificationSettings: row.notificationSettings,
        feedSettings: row.feedSettings,
      })
      return reply.send(bundle)
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      throw e
    }
  })

  app.patch('/api/settings/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Settings API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    let row
    try {
      row = await ensureUserSettingsRow(userId)
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      throw e
    }
    let privacy = row.privacySettings
    let notifications = row.notificationSettings
    let feed = row.feedSettings
    if (parsed.data.privacy) {
      privacy = mergePrivacySettings(privacy, parsed.data.privacy)
    }
    if (parsed.data.notifications) {
      notifications = mergeNotificationSettings(notifications, parsed.data.notifications)
    }
    if (parsed.data.feed) {
      feed = mergeFeedSettings(feed, parsed.data.feed)
    }
    const [updated] = await db
      .update(schema.userSettings)
      .set({
        privacySettings: privacy,
        notificationSettings: notifications,
        feedSettings: feed,
        updatedAt: new Date(),
      })
      .where(eq(schema.userSettings.userId, userId))
      .returning()
    if (!updated) {
      return reply.status(500).send({ error: 'Update failed' })
    }
    return reply.send(
      normalizeUserSettingsBundle({
        privacySettings: updated.privacySettings,
        notificationSettings: updated.notificationSettings,
        feedSettings: updated.feedSettings,
      })
    )
  })
}
