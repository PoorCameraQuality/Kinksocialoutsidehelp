/**
 * Convention hub extensions: gallery, pins, attendee maps read, channel mark-read.
 */
import { S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, gt, inArray } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { putObject } from '../lib/s3-upload.js'
import { getConventionWithAccess, resolveConventionId } from './conventions-routes.js'
import {
  requireHubConventionMutation,
  userHasHubConventionRead,
} from '../lib/convention-command-access.js'
import { emitActivity } from '../lib/feed-activities.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
} from '../lib/alpha-upload-policy.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function s3(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

function publicUrlForPath(path: string): string | null {
  const bucket = process.env.S3_BUCKET ?? 'c2k-uploads'
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? `${process.env.S3_ENDPOINT}/${bucket}`
  if (!publicBase) return null
  return `${publicBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function hubAccessOk(key: string, userId: string | null): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; conv: typeof schema.conventions.$inferSelect; access: Awaited<ReturnType<typeof getConventionWithAccess>> }
> {
  const resolved = await getConventionWithAccess(key, userId)
  if ('notFound' in resolved) return { ok: false, status: 404, error: 'Not found' }
  if ('forbidden' in resolved) return { ok: false, status: 400, error: 'Convention must be org-owned' }
  if (!resolved.canView) return { ok: false, status: 403, error: 'Registration required' }
  return { ok: true, conv: resolved.conv, access: resolved }
}

async function hubGalleryModerateOk(
  conv: typeof schema.conventions.$inferSelect,
  userId: string,
): Promise<boolean> {
  return userHasHubConventionRead(conv, userId, 'staff_ops')
}

function mapGalleryRow(r: typeof schema.conventionGalleryImages.$inferSelect) {
  return {
    id: r.id,
    sortOrder: r.sortOrder,
    imageUrl: r.imageUrl,
    caption: r.caption,
    moderationStatus: r.moderationStatus,
    createdAt: r.createdAt,
  }
}

function conventionSummaryFromRow(conv: typeof schema.conventions.$inferSelect, heroImage: string | null) {
  const settings = (conv.settings ?? {}) as Record<string, unknown>
  const eventSystems = (settings.eventSystems ?? {}) as Record<string, unknown>
  const themeConfig = (eventSystems.themeConfig ?? {}) as Record<string, unknown>
  return {
    id: conv.id,
    slug: conv.slug,
    name: conv.name,
    startsAt: conv.startsAt,
    endsAt: conv.endsAt,
    heroImage,
    accent: typeof themeConfig.accent === 'string' ? themeConfig.accent : null,
  }
}

export async function registerConventionHubExtRoutes(app: FastifyInstance) {
  /* --- Public gallery read --- */
  app.get('/api/v1/conventions/:key/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const resolved = await getConventionWithAccess(key, viewerId)
    if ('notFound' in resolved || 'forbidden' in resolved) return reply.status(404).send({ error: 'Not found' })
    const canModerate = viewerId ? await hubGalleryModerateOk(resolved.conv, viewerId) : false
    const rows = await db
      .select()
      .from(schema.conventionGalleryImages)
      .where(
        canModerate ?
          eq(schema.conventionGalleryImages.conventionId, id)
        : and(
            eq(schema.conventionGalleryImages.conventionId, id),
            eq(schema.conventionGalleryImages.moderationStatus, 'approved'),
          ),
      )
      .orderBy(asc(schema.conventionGalleryImages.sortOrder), asc(schema.conventionGalleryImages.createdAt))
    const items = rows.map(mapGalleryRow)
    return reply.send({ items, pendingCount: canModerate ? items.filter((i) => i.moderationStatus === 'pending').length : 0 })
  })

  app.post('/api/v1/conventions/:key/gallery/upload', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('convention_gallery')) {
      return alphaUploadDisabledResponse(reply, 'convention_gallery')
    }
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    const client = s3()
    if (!client) return reply.status(503).send({ error: 'S3 not configured' })
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = data.filename.includes('.') ? data.filename.slice(data.filename.lastIndexOf('.')) : '.jpg'
    const path = `conventions/${resolved.conv.id}/gallery/${Date.now()}${ext}`
    const buffer = await data.toBuffer()
    try {
      await putObject(client, {
        Bucket: process.env.S3_BUCKET ?? 'c2k-uploads',
        Key: path,
        Body: buffer,
        ContentType: data.mimetype || 'application/octet-stream',
      })
    } catch (e) {
      const err = e as { message?: string }
      return reply.status(502).send({ error: err.message ?? 'Upload failed' })
    }
    const url = publicUrlForPath(path)
    if (!url) return reply.status(502).send({ error: 'Could not resolve public URL' })
    return reply.send({ path, url })
  })

  app.post('/api/v1/conventions/:key/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ imageUrl: z.string().url(), caption: z.string().max(500).optional(), sortOrder: z.number().int().optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    const [row] = await db
      .insert(schema.conventionGalleryImages)
      .values({
        conventionId: resolved.conv.id,
        imageUrl: parsed.data.imageUrl,
        caption: parsed.data.caption ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        uploadedBy: user.userId,
        moderationStatus: 'approved',
      })
      .returning()
    return reply.send({ image: mapGalleryRow(row!) })
  })

  app.post('/api/v1/conventions/:key/gallery/attendee-upload', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('convention_gallery_attendee')) {
      return alphaUploadDisabledResponse(reply, 'convention_gallery_attendee')
    }
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const gate = await hubAccessOk(key, user.userId)
    if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
    const access = gate.access
    if (!access.hasPaidAccess && !access.canManage && !access.isStaff) {
      return reply.status(403).send({ error: 'Paid attendee access required' })
    }
    const client = s3()
    if (!client) return reply.status(503).send({ error: 'S3 not configured' })
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = data.filename.includes('.') ? data.filename.slice(data.filename.lastIndexOf('.')) : '.jpg'
    const path = `conventions/${gate.conv.id}/gallery/attendee/${Date.now()}${ext}`
    const buffer = await data.toBuffer()
    try {
      await putObject(client, {
        Bucket: process.env.S3_BUCKET ?? 'c2k-uploads',
        Key: path,
        Body: buffer,
        ContentType: data.mimetype || 'application/octet-stream',
      })
    } catch (e) {
      const err = e as { message?: string }
      return reply.status(502).send({ error: err.message ?? 'Upload failed' })
    }
    const url = publicUrlForPath(path)
    if (!url) return reply.status(502).send({ error: 'Could not resolve public URL' })
    const captionField = data.fields?.caption
    const caption =
      captionField && typeof captionField === 'object' && 'value' in captionField ?
        String((captionField as { value: unknown }).value).slice(0, 500)
      : undefined
    const [row] = await db
      .insert(schema.conventionGalleryImages)
      .values({
        conventionId: gate.conv.id,
        imageUrl: url,
        caption: caption ?? null,
        sortOrder: 9999,
        uploadedBy: user.userId,
        moderationStatus: 'pending',
      })
      .returning()
    return reply.status(201).send({ image: mapGalleryRow(row!), path, url })
  })

  app.post('/api/v1/conventions/:key/gallery/submit', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ imageUrl: z.string().url(), caption: z.string().max(500).optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const gate = await hubAccessOk(key, user.userId)
    if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
    const access = gate.access
    if (!access.hasPaidAccess && !access.canManage && !access.isStaff) {
      return reply.status(403).send({ error: 'Paid attendee access required to submit gallery photos' })
    }
    const [row] = await db
      .insert(schema.conventionGalleryImages)
      .values({
        conventionId: gate.conv.id,
        imageUrl: parsed.data.imageUrl,
        caption: parsed.data.caption ?? null,
        sortOrder: 9999,
        uploadedBy: user.userId,
        moderationStatus: 'pending',
      })
      .returning()
    return reply.status(201).send({ image: mapGalleryRow(row!), message: 'Photo submitted for organizer review' })
  })

  app.patch('/api/v1/conventions/:key/gallery/:imageId/moderation', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, imageId } = req.params as { key: string; imageId: string }
    if (!UUID_RE.test(imageId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ status: z.enum(['approved', 'rejected']) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    if (parsed.data.status === 'rejected') {
      await db
        .delete(schema.conventionGalleryImages)
        .where(
          and(
            eq(schema.conventionGalleryImages.id, imageId),
            eq(schema.conventionGalleryImages.conventionId, resolved.conv.id),
          ),
        )
      return reply.send({ ok: true, status: 'rejected' })
    }
    const [updated] = await db
      .update(schema.conventionGalleryImages)
      .set({ moderationStatus: 'approved' })
      .where(
        and(
          eq(schema.conventionGalleryImages.id, imageId),
          eq(schema.conventionGalleryImages.conventionId, resolved.conv.id),
        ),
      )
      .returning()
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true, image: mapGalleryRow(updated) })
  })

  app.patch('/api/v1/conventions/:key/gallery/:imageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, imageId } = req.params as { key: string; imageId: string }
    if (!UUID_RE.test(imageId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ caption: z.string().max(500).nullable().optional(), sortOrder: z.number().int().optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    const [updated] = await db
      .update(schema.conventionGalleryImages)
      .set({
        ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      })
      .where(
        and(
          eq(schema.conventionGalleryImages.id, imageId),
          eq(schema.conventionGalleryImages.conventionId, resolved.conv.id),
        ),
      )
      .returning()
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ image: mapGalleryRow(updated) })
  })

  app.delete('/api/v1/conventions/:key/gallery/:imageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, imageId } = req.params as { key: string; imageId: string }
    if (!UUID_RE.test(imageId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, user.userId, reply, 'staff_ops'))) return
    await db
      .delete(schema.conventionGalleryImages)
      .where(
        and(
          eq(schema.conventionGalleryImages.id, imageId),
          eq(schema.conventionGalleryImages.conventionId, resolved.conv.id),
        ),
      )
    return reply.send({ ok: true })
  })

  /* --- Pins + feed --- */
  app.post('/api/v1/conventions/:key/pin', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Registration required' })
    const inserted = await db
      .insert(schema.conventionPins)
      .values({ userId: user.userId, conventionId: resolved.conv.id })
      .onConflictDoNothing()
      .returning()
    if (inserted.length > 0) {
      emitActivity({
        actorId: user.userId,
        verb: 'convention_pin',
        objectType: 'convention',
        objectId: resolved.conv.id,
        metadata: {
          title: resolved.conv.name,
          conventionSlug: resolved.conv.slug,
          conventionKey: key,
        },
      })
    }
    return reply.send({ pinned: true })
  })

  app.delete('/api/v1/conventions/:key/pin', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    await db
      .delete(schema.conventionPins)
      .where(and(eq(schema.conventionPins.userId, user.userId), eq(schema.conventionPins.conventionId, id)))
    return reply.send({ pinned: false })
  })

  app.post('/api/v1/conventions/:key/channels/:channelId/mark-read', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, channelId } = req.params as { key: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Forbidden' })
    const orgId = resolved.conv.organizationId
    if (!orgId) return reply.status(400).send({ error: 'No organization' })
    const [ch] = await db
      .select()
      .from(schema.orgChannels)
      .where(and(eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId)))
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    await db
      .insert(schema.conventionChannelReads)
      .values({ userId: user.userId, channelId, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.conventionChannelReads.userId, schema.conventionChannelReads.channelId],
        set: { lastReadAt: new Date() },
      })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/me/convention-pins', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const pins = await db
      .select({
        pinnedAt: schema.conventionPins.pinnedAt,
        conv: schema.conventions,
      })
      .from(schema.conventionPins)
      .innerJoin(schema.conventions, eq(schema.conventionPins.conventionId, schema.conventions.id))
      .where(eq(schema.conventionPins.userId, user.userId))
      .orderBy(desc(schema.conventionPins.pinnedAt))

    const items = []
    for (const row of pins) {
      const conv = row.conv
      let heroImage: string | null = null
      if (conv.anchorEventId) {
        const [ev] = await db
          .select({ imageUrl: schema.events.imageUrl })
          .from(schema.events)
          .where(eq(schema.events.id, conv.anchorEventId))
          .limit(1)
        heroImage = ev?.imageUrl ?? null
      }
      const orgId = conv.organizationId
      let latestAnnouncement: {
        id: string
        bodyExcerpt: string
        sentAt: Date
        authorUsername: string | null
      } | null = null
      let unreadChatCount = 0
      if (orgId) {
        const channels = await db
          .select()
          .from(schema.orgChannels)
          .where(eq(schema.orgChannels.organizationId, orgId))
        const annChannels = channels.filter((c) => c.kind === 'ANNOUNCEMENTS')
        const chatChannels = channels.filter(
          (c) =>
            c.kind !== 'ANNOUNCEMENTS' &&
            c.kind !== 'VOICE' &&
            c.kind !== 'VIDEO' &&
            c.kind !== 'LIVE_STREAM' &&
            (c.requiresConventionId === null || c.requiresConventionId === conv.id),
        )
        if (annChannels.length > 0) {
          const annIds = annChannels.map((c) => c.id)
          const [latest] = await db
            .select({
              id: schema.orgChannelMessages.id,
              body: schema.orgChannelMessages.body,
              createdAt: schema.orgChannelMessages.createdAt,
              username: schema.users.username,
              channelId: schema.orgChannelMessages.orgChannelId,
            })
            .from(schema.orgChannelMessages)
            .innerJoin(schema.users, eq(schema.orgChannelMessages.senderId, schema.users.id))
            .where(inArray(schema.orgChannelMessages.orgChannelId, annIds))
            .orderBy(desc(schema.orgChannelMessages.createdAt))
            .limit(1)
          if (latest) {
            const [read] = await db
              .select({ lastReadAt: schema.conventionChannelReads.lastReadAt })
              .from(schema.conventionChannelReads)
              .where(
                and(
                  eq(schema.conventionChannelReads.userId, user.userId),
                  eq(schema.conventionChannelReads.channelId, latest.channelId),
                ),
              )
              .limit(1)
            const isUnread = !read?.lastReadAt || latest.createdAt > read.lastReadAt
            if (isUnread) {
              latestAnnouncement = {
                id: latest.id,
                bodyExcerpt: latest.body.slice(0, 160),
                sentAt: latest.createdAt,
                authorUsername: latest.username,
              }
            }
          }
        }
        for (const ch of chatChannels) {
          const [read] = await db
            .select({ lastReadAt: schema.conventionChannelReads.lastReadAt })
            .from(schema.conventionChannelReads)
            .where(
              and(
                eq(schema.conventionChannelReads.userId, user.userId),
                eq(schema.conventionChannelReads.channelId, ch.id),
              ),
            )
            .limit(1)
          const since = read?.lastReadAt ?? new Date(0)
          const [row] = await db
            .select({ n: count() })
            .from(schema.orgChannelMessages)
            .where(
              and(eq(schema.orgChannelMessages.orgChannelId, ch.id), gt(schema.orgChannelMessages.createdAt, since)),
            )
          unreadChatCount += Number(row?.n ?? 0)
        }
      }
      items.push({
        convention: conventionSummaryFromRow(conv, heroImage),
        pinnedAt: row.pinnedAt,
        latestAnnouncement,
        unreadChatCount,
      })
    }
    return reply.send({ items })
  })
}
