import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
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

export async function registerNotificationPreferencesRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/notification-preferences', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const [row] = await db
      .select()
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, actor.userId))
      .limit(1)
    return reply.send({
      orgDigestEmailWeekly: row?.orgDigestEmailWeekly ?? true,
      pinnedDigestEmailWeekly: row?.pinnedDigestEmailWeekly ?? true,
      pushEnabled: row?.pushEnabled ?? false,
      pushHubAnnouncements: row?.pushHubAnnouncements ?? false,
      pushHubChat: row?.pushHubChat ?? false,
    })
  })

  app.patch('/api/v1/me/notification-preferences', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const parsed = z
      .object({
        orgDigestEmailWeekly: z.boolean().optional(),
        pinnedDigestEmailWeekly: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        pushHubAnnouncements: z.boolean().optional(),
        pushHubChat: z.boolean().optional(),
      })
      .strict()
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (
      parsed.data.orgDigestEmailWeekly === undefined &&
      parsed.data.pinnedDigestEmailWeekly === undefined &&
      parsed.data.pushEnabled === undefined &&
      parsed.data.pushHubAnnouncements === undefined &&
      parsed.data.pushHubChat === undefined
    ) {
      return reply.status(400).send({ error: 'No changes' })
    }
    const [existing] = await db
      .select()
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, actor.userId))
      .limit(1)
    const [row] = await db
      .insert(schema.userNotificationPreferences)
      .values({
        userId: actor.userId,
        orgDigestEmailWeekly:
          parsed.data.orgDigestEmailWeekly ?? existing?.orgDigestEmailWeekly ?? true,
        pinnedDigestEmailWeekly:
          parsed.data.pinnedDigestEmailWeekly ?? existing?.pinnedDigestEmailWeekly ?? true,
        pushEnabled: parsed.data.pushEnabled ?? existing?.pushEnabled ?? false,
        pushHubAnnouncements:
          parsed.data.pushHubAnnouncements ?? existing?.pushHubAnnouncements ?? false,
        pushHubChat: parsed.data.pushHubChat ?? existing?.pushHubChat ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.userNotificationPreferences.userId,
        set: {
          ...(parsed.data.orgDigestEmailWeekly !== undefined ?
            { orgDigestEmailWeekly: parsed.data.orgDigestEmailWeekly }
          : {}),
          ...(parsed.data.pinnedDigestEmailWeekly !== undefined ?
            { pinnedDigestEmailWeekly: parsed.data.pinnedDigestEmailWeekly }
          : {}),
          ...(parsed.data.pushEnabled !== undefined ? { pushEnabled: parsed.data.pushEnabled } : {}),
          ...(parsed.data.pushHubAnnouncements !== undefined ?
            { pushHubAnnouncements: parsed.data.pushHubAnnouncements }
          : {}),
          ...(parsed.data.pushHubChat !== undefined ? { pushHubChat: parsed.data.pushHubChat } : {}),
          updatedAt: new Date(),
        },
      })
      .returning()

    if (parsed.data.pushEnabled === false) {
      await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, actor.userId))
    }

    return reply.send({
      orgDigestEmailWeekly: row?.orgDigestEmailWeekly ?? true,
      pinnedDigestEmailWeekly: row?.pinnedDigestEmailWeekly ?? true,
      pushEnabled: row?.pushEnabled ?? false,
      pushHubAnnouncements: row?.pushHubAnnouncements ?? false,
      pushHubChat: row?.pushHubChat ?? false,
    })
  })
}
