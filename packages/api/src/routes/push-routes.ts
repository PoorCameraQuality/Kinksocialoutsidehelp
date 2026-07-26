import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { vapidPublicKey, webPushConfigured } from '../lib/web-push-send.js'

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
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

async function userHasPushSubscription(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .limit(1)
  return Boolean(row)
}

/** C215 foundation - store Web Push subscriptions; send requires VAPID keys (future). */
export async function registerPushRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/push/status', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const configured = webPushConfigured()
    const [prefs] = await db
      .select({ pushEnabled: schema.userNotificationPreferences.pushEnabled })
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, actor.userId))
      .limit(1)

    const subscribed = await userHasPushSubscription(actor.userId)

    return reply.send({
      configured,
      vapidPublicKey: vapidPublicKey(),
      transport: configured ? 'web-push' : 'disabled',
      pushEnabled: prefs?.pushEnabled ?? false,
      subscribed,
      browserPermission: null,
    })
  })

  app.post('/api/v1/me/push/subscribe', { ...rateLimitRoute('pushSubscribe') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const [prefs] = await db
      .select({ pushEnabled: schema.userNotificationPreferences.pushEnabled })
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, actor.userId))
      .limit(1)
    if (!prefs?.pushEnabled) {
      return reply.status(403).send({ error: 'Enable push in notification settings first' })
    }

    const parsed = z
      .object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .insert(schema.pushSubscriptions)
      .values({
        userId: actor.userId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      })
      .onConflictDoUpdate({
        target: [schema.pushSubscriptions.userId, schema.pushSubscriptions.endpoint],
        set: {
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
        },
      })
    return reply.send({ ok: true })
  })

  app.delete('/api/v1/me/push/subscribe', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const parsed = z.object({ endpoint: z.string().url().optional() }).safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    if (parsed.data.endpoint) {
      await db
        .delete(schema.pushSubscriptions)
        .where(
          and(
            eq(schema.pushSubscriptions.userId, actor.userId),
            eq(schema.pushSubscriptions.endpoint, parsed.data.endpoint),
          ),
        )
    } else {
      await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, actor.userId))
    }

    return reply.send({ ok: true })
  })

  app.post('/api/v1/me/push/disable', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    await db
      .insert(schema.userNotificationPreferences)
      .values({ userId: actor.userId, pushEnabled: false, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.userNotificationPreferences.userId,
        set: { pushEnabled: false, updatedAt: new Date() },
      })
    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, actor.userId))
    return reply.send({ ok: true })
  })
}
