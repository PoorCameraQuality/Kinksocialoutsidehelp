import { and, asc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import type { ConventionPublicSettings } from '../db/schema.js'
import { canViewerReadIsoVisibility, isConventionIsoBoardEnabled, isoEligibleForConventionBoard } from '../lib/iso-access.js'
import { requireHubConventionMutation } from '../lib/convention-command-access.js'
import { getConventionWithAccess } from './conventions-routes.js'

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

const pinBody = z.object({ listed: z.boolean() }).strict()

const boardSettingsBody = z.object({ isoBoardEnabled: z.boolean() }).strict()

const moderateBody = z
  .object({
    userId: z.string().uuid(),
    action: z.enum(['remove', 'restore']),
  })
  .strict()

export async function registerConventionIsoRoutes(app: FastifyInstance) {
  app.get('/api/v1/conventions/:key/iso-board/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [row] = await db
      .select({ id: schema.conventionIsoListings.id })
      .from(schema.conventionIsoListings)
      .where(
        and(
          eq(schema.conventionIsoListings.conventionId, resolved.conv.id),
          eq(schema.conventionIsoListings.userId, user.userId),
        ),
      )
      .limit(1)
    return reply.send({ listed: Boolean(row) })
  })

  app.get('/api/v1/conventions/:key/iso-board', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const resolved = await getConventionWithAccess(key, viewerId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const settings = (resolved.conv.settings ?? {}) as ConventionPublicSettings
    const boardEnabled = isConventionIsoBoardEnabled(settings)
    if (!boardEnabled && !resolved.canManage) {
      return reply.send({ boardEnabled: false, items: [] })
    }
    const listingConds = [
      eq(schema.conventionIsoListings.conventionId, resolved.conv.id),
      ...(resolved.canManage ? [] : [isNull(schema.conventionIsoListings.removedByStaffAt)]),
    ]
    const rows = await db
      .select({
        listingId: schema.conventionIsoListings.id,
        userId: schema.conventionIsoListings.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        body: schema.userIsoPosts.body,
        visibility: schema.userIsoPosts.visibility,
        acceptDmsViaIso: schema.userIsoPosts.acceptDmsViaIso,
        removedByStaffAt: schema.conventionIsoListings.removedByStaffAt,
      })
      .from(schema.conventionIsoListings)
      .innerJoin(schema.users, eq(schema.conventionIsoListings.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .innerJoin(schema.userIsoPosts, eq(schema.userIsoPosts.userId, schema.conventionIsoListings.userId))
      .where(and(...listingConds))

    const filtered = rows.filter((row) =>
      isoEligibleForConventionBoard(row.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
        viewerId,
        isOwner: viewerId === row.userId,
      }),
    )

    const items: Array<{
      userId: string
      username: string
      displayName: string | null
      avatarUrl: string | null
      body: string
      visibility: string
      acceptDmsViaIso: boolean
      images: { sortOrder: number; url: string }[]
      staffRemoved: boolean
    }> = []

    for (const row of filtered) {
      if (
        !canViewerReadIsoVisibility(row.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
          viewerId,
          isOwner: viewerId === row.userId,
        })
      ) {
        continue
      }
      const imgs = await db
        .select({ sortOrder: schema.userIsoImages.sortOrder, url: schema.userIsoImages.url })
        .from(schema.userIsoImages)
        .where(eq(schema.userIsoImages.userId, row.userId))
        .orderBy(asc(schema.userIsoImages.sortOrder))
      items.push({
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        body: row.body,
        visibility: row.visibility,
        acceptDmsViaIso: row.acceptDmsViaIso,
        images: imgs,
        staffRemoved: Boolean(row.removedByStaffAt),
      })
    }

    return reply.send({ boardEnabled, items, canManage: resolved.canManage })
  })

  app.put('/api/v1/conventions/:key/iso-board/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const parsed = pinBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const settings = (resolved.conv.settings ?? {}) as ConventionPublicSettings
    if (!isConventionIsoBoardEnabled(settings)) {
      return reply.status(403).send({ error: 'ISO board is disabled for this convention' })
    }
    const [post] = await db.select().from(schema.userIsoPosts).where(eq(schema.userIsoPosts.userId, user.userId)).limit(1)
    if (!post) {
      return reply.status(400).send({ error: 'Create your ISO on your profile before listing it here' })
    }
    if (parsed.data.listed) {
      await db
        .insert(schema.conventionIsoListings)
        .values({
          conventionId: resolved.conv.id,
          userId: user.userId,
          createdAt: new Date(),
          removedByStaffAt: null,
          removedByUserId: null,
        })
        .onConflictDoUpdate({
          target: [schema.conventionIsoListings.conventionId, schema.conventionIsoListings.userId],
          set: {
            removedByStaffAt: null,
            removedByUserId: null,
          },
        })
    } else {
      await db
        .delete(schema.conventionIsoListings)
        .where(
          and(
            eq(schema.conventionIsoListings.conventionId, resolved.conv.id),
            eq(schema.conventionIsoListings.userId, user.userId),
          ),
        )
    }
    return reply.send({ ok: true, listed: parsed.data.listed })
  })

  app.patch('/api/v1/conventions/:key/iso-board/settings', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const parsed = boardSettingsBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'admin'))) return
    const nextSettings: ConventionPublicSettings = {
      ...(resolved.conv.settings as ConventionPublicSettings | null | undefined),
      isoBoardEnabled: parsed.data.isoBoardEnabled,
    }
    await db.update(schema.conventions).set({ settings: nextSettings }).where(eq(schema.conventions.id, resolved.conv.id))
    return reply.send({ ok: true, isoBoardEnabled: parsed.data.isoBoardEnabled })
  })

  app.post('/api/v1/conventions/:key/iso-board/moderate', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const parsed = moderateBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    const { userId: targetUserId, action } = parsed.data
    const [listing] = await db
      .select()
      .from(schema.conventionIsoListings)
      .where(
        and(
          eq(schema.conventionIsoListings.conventionId, resolved.conv.id),
          eq(schema.conventionIsoListings.userId, targetUserId),
        ),
      )
      .limit(1)
    if (!listing) return reply.status(404).send({ error: 'Listing not found' })
    if (action === 'remove') {
      await db
        .update(schema.conventionIsoListings)
        .set({
          removedByStaffAt: new Date(),
          removedByUserId: user.userId,
        })
        .where(eq(schema.conventionIsoListings.id, listing.id))
    } else {
      await db
        .update(schema.conventionIsoListings)
        .set({
          removedByStaffAt: null,
          removedByUserId: null,
        })
        .where(eq(schema.conventionIsoListings.id, listing.id))
    }
    return reply.send({ ok: true, action })
  })
}
