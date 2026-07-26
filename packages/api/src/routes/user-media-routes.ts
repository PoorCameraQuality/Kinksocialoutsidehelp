import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  isFeedReactionId,
  mediaCommentPolicySchema,
  mediaContentRatingSchema,
  mediaKindSchema,
  mediaVisibilitySchema,
} from '@c2k/shared'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import {
  addMediaItemToAlbum,
  createMediaUpload,
  createPeopleTagOnMediaItem,
  listPendingPeopleTagsForUser,
  listUserAlbums,
  listUserMediaItems,
  MediaSocialError,
  patchMediaAlbum,
  patchMediaItem,
  removeMediaItemFromAlbum,
  shapeMediaItemPreview,
  softDeleteMediaAlbum,
  softDeleteMediaComment,
  softDeleteMediaItem,
  syncMediaItemAsAvatar,
  updatePeopleTagStatus,
} from '../lib/media-social-service.js'
import { getMediaAssetById, MediaAttestationValidationError } from '../lib/media-asset-service.js'
import { ensureProfileForUserId } from '../lib/ensure-profile.js'
import { getPersonalPhotoQuota, PersonalPhotoQuotaError } from '../lib/personal-photo-quota.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

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
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

const attestationFields = {
  contentRating: mediaContentRatingSchema,
  depictedPeople: z.string(),
  visibility: mediaVisibilitySchema,
  uploaderConfirmed18: z.literal(true),
  uploaderConfirmedDepictedAdults18: z.literal(true),
  uploaderConfirmedConsent: z.literal(true),
  uploaderConfirmedRightToUpload: z.literal(true),
  uploaderConfirmedNoNcii: z.literal(true),
  uploaderConfirmedNoMinors: z.literal(true),
  uploaderConfirmedNoHiddenCamera: z.literal(true),
  uploaderConfirmedNoAiDeepfakeWithoutConsent: z.literal(true),
}

const uploadBodySchema = z.object({
  caption: z.string().max(5000).optional(),
  items: z
    .array(
      z.object({
        mediaAssetId: z.string().uuid().optional(),
        quarantineKey: z.string().min(1).max(2048).optional(),
        mediaKind: mediaKindSchema,
        originalFilename: z.string().max(512).optional(),
        mimeType: z.string().max(128),
        sizeBytes: z.number().int().min(0),
        imageWidth: z.number().int().optional(),
        imageHeight: z.number().int().optional(),
        videoWidth: z.number().int().optional(),
        videoHeight: z.number().int().optional(),
        durationSeconds: z.number().int().optional(),
        caption: z.string().max(5000).optional(),
      }),
    )
    .min(1)
    .max(10),
  peopleTags: z
    .array(
      z.object({
        userId: z.string().uuid(),
        x: z.number().optional(),
        y: z.number().optional(),
        label: z.string().max(128).optional(),
      }),
    )
    .max(8)
    .optional(),
  albumIds: z.array(z.string().uuid()).max(10).optional(),
  tags: z.array(z.string().max(64)).max(5).optional(),
  visibility: mediaVisibilitySchema,
  commentPolicy: mediaCommentPolicySchema,
  postToFeed: z.boolean(),
  useAsAvatar: z.boolean().optional(),
  pinnedToProfile: z.boolean().optional(),
  attestation: z.object(attestationFields),
})

const albumBodySchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  visibility: mediaVisibilitySchema.optional(),
})

async function resolveUserIdByUsername(username: string): Promise<string | null> {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  return user?.id ?? null
}

export async function registerUserMediaRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/personal-photo-quota', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const quota = await getPersonalPhotoQuota(auth.userId)
    return reply.send({ quota })
  })

  app.post(
    '/api/v1/me/media/uploads',
    { ...rateLimitRoute('upload') },
    async (req, reply) => {
      if (!requireDb(reply)) return
      const auth = requireUser(req, reply)
      if (!auth) return
      const parsed = uploadBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      try {
        const result = await createMediaUpload({
          userId: auth.userId,
          caption: parsed.data.caption,
          items: parsed.data.items,
          peopleTags: parsed.data.peopleTags,
          albumIds: parsed.data.albumIds,
          tags: parsed.data.tags,
          visibility: parsed.data.visibility,
          commentPolicy: parsed.data.commentPolicy,
          postToFeed: parsed.data.postToFeed,
          useAsAvatar: parsed.data.useAsAvatar,
          pinnedToProfile: parsed.data.pinnedToProfile,
          attestation: parsed.data.attestation,
          sourceSurface: 'profile_media',
        })
        return reply.status(201).send(result)
      } catch (e) {
        if (e instanceof PersonalPhotoQuotaError) {
          return reply.status(403).send({ error: e.message, code: e.code, quota: e.quota })
        }
        if (e instanceof MediaAttestationValidationError) {
          return reply.status(400).send({ error: e.message })
        }
        if (e instanceof MediaSocialError) {
          const status = e.code === 'media_asset_forbidden' ? 403 : 400
          return reply.status(status).send({ error: e.message, code: e.code })
        }
        throw e
      }
    },
  )

  app.get('/api/v1/users/:username/media', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const q = req.query as Record<string, string | undefined>
    const ownerUserId = await resolveUserIdByUsername(username)
    if (!ownerUserId) return reply.status(404).send({ error: 'User not found' })

    const viewer = resolveViewerFromRequest(req)
    const viewerUserId = getViewerUserId(viewer.payload)

    const result = await listUserMediaItems({
      ownerUserId,
      viewerUserId,
      kind: (q.kind as 'image' | 'video' | 'all') ?? 'all',
      albumSlug: q.album,
      tagged: q.tagged === 'true',
      limit: q.limit ? Number(q.limit) : undefined,
      cursor: q.cursor,
    })
    return reply.send(result)
  })

  app.get('/api/v1/users/:username/albums', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const ownerUserId = await resolveUserIdByUsername(username)
    if (!ownerUserId) return reply.status(404).send({ error: 'User not found' })
    const viewer = resolveViewerFromRequest(req)
    const albums = await listUserAlbums(ownerUserId, getViewerUserId(viewer.payload))
    return reply.send({ albums })
  })

  app.get('/api/v1/users/:username/albums/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username, slug } = req.params as { username: string; slug: string }
    const ownerUserId = await resolveUserIdByUsername(username)
    if (!ownerUserId) return reply.status(404).send({ error: 'User not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerUserId = getViewerUserId(viewer.payload)
    const [album] = await db
      .select()
      .from(schema.mediaAlbums)
      .where(
        and(
          eq(schema.mediaAlbums.ownerUserId, ownerUserId),
          eq(schema.mediaAlbums.slug, slug),
          isNull(schema.mediaAlbums.deletedAt),
        ),
      )
      .limit(1)
    if (!album) return reply.status(404).send({ error: 'Album not found' })
    const media = await listUserMediaItems({
      ownerUserId,
      viewerUserId,
      albumSlug: slug,
    })
    return reply.send({ album, media: media.items, nextCursor: media.nextCursor })
  })

  app.post('/api/v1/me/media/albums', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const parsed = albumBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const now = new Date()
    const [row] = await db
      .insert(schema.mediaAlbums)
      .values({
        ownerUserId: auth.userId,
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        visibility: parsed.data.visibility ?? 'LOGGED_IN',
        albumKind: 'custom',
        updatedAt: now,
      })
      .returning()
    return reply.status(201).send({ album: row })
  })

  app.patch('/api/v1/me/media/albums/:albumId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { albumId } = req.params as { albumId: string }
    const parsed = z
      .object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(5000).nullable().optional(),
        visibility: mediaVisibilitySchema.optional(),
        coverMediaItemId: z.string().uuid().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const album = await patchMediaAlbum(auth.userId, albumId, parsed.data)
      return reply.send({ album })
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })

  app.delete('/api/v1/me/media/albums/:albumId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { albumId } = req.params as { albumId: string }
    try {
      await softDeleteMediaAlbum(auth.userId, albumId)
      return reply.status(204).send()
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })

  app.post('/api/v1/me/media/albums/:albumId/items', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { albumId } = req.params as { albumId: string }
    const parsed = z.object({ mediaItemId: z.string().uuid() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      await addMediaItemToAlbum(auth.userId, albumId, parsed.data.mediaItemId)
      return reply.status(201).send({ ok: true })
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })

  app.delete('/api/v1/me/media/albums/:albumId/items/:mediaItemId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { albumId, mediaItemId } = req.params as { albumId: string; mediaItemId: string }
    try {
      await removeMediaItemFromAlbum(auth.userId, albumId, mediaItemId)
      return reply.status(204).send()
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })

  app.get('/api/v1/media/items/:mediaItemId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerUserId = getViewerUserId(viewer.payload)

    const [item] = await db
      .select()
      .from(schema.mediaItems)
      .where(eq(schema.mediaItems.id, mediaItemId))
      .limit(1)
    if (!item || (item.deletedAt && item.ownerUserId !== viewerUserId)) {
      return reply.status(404).send({ error: 'Media not found' })
    }
    const asset = await getMediaAssetById(item.mediaAssetId)
    if (!asset) return reply.status(404).send({ error: 'Media not found' })

    const preview = await shapeMediaItemPreview(item, asset, viewerUserId)
    if (!preview) return reply.status(404).send({ error: 'Media not found' })

    const [owner] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, item.ownerUserId))
      .limit(1)

    const tags = await db
      .select()
      .from(schema.mediaItemTags)
      .where(eq(schema.mediaItemTags.mediaItemId, mediaItemId))

    const reactions = await db
      .select({ kind: schema.mediaReactions.kind, userId: schema.mediaReactions.userId })
      .from(schema.mediaReactions)
      .where(eq(schema.mediaReactions.mediaItemId, mediaItemId))

    const [commentCountRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.mediaComments)
      .where(and(eq(schema.mediaComments.mediaItemId, mediaItemId), isNull(schema.mediaComments.deletedAt)))

    let viewerReaction: string | null = null
    if (viewerUserId) {
      const [vr] = await db
        .select({ kind: schema.mediaReactions.kind })
        .from(schema.mediaReactions)
        .where(
          and(
            eq(schema.mediaReactions.mediaItemId, mediaItemId),
            eq(schema.mediaReactions.userId, viewerUserId),
          ),
        )
        .limit(1)
      viewerReaction = vr?.kind ?? null
    }

    const isOwner = viewerUserId === item.ownerUserId
    return reply.send({
      item: preview,
      owner,
      tags: tags.map((t) => t.tag),
      reactionCounts: reactions.reduce<Record<string, number>>((acc, r) => {
        acc[r.kind] = (acc[r.kind] ?? 0) + 1
        return acc
      }, {}),
      viewerReaction,
      commentCount: commentCountRow?.n ?? 0,
      canEdit: isOwner,
      canDelete: isOwner,
      canComment: isOwner || item.commentPolicy !== 'no_one',
      canUseAsAvatar: isOwner && item.mediaKind === 'image',
      canReport: !isOwner && Boolean(viewerUserId),
    })
  })

  app.delete('/api/v1/me/media/items/:mediaItemId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    await softDeleteMediaItem(auth.userId, mediaItemId)
    return reply.status(204).send()
  })

  app.patch('/api/v1/me/media/items/:mediaItemId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const parsed = z
      .object({
        caption: z.string().max(5000).optional(),
        visibility: mediaVisibilitySchema.optional(),
        commentPolicy: mediaCommentPolicySchema.optional(),
        pinnedToProfile: z.boolean().optional(),
        showInFeed: z.boolean().optional(),
        useAsAvatar: z.boolean().optional(),
        tags: z.array(z.string().max(64)).max(5).optional(),
        albumIds: z.array(z.string().uuid()).max(10).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const item = await patchMediaItem(auth.userId, mediaItemId, parsed.data)
      return reply.send({ item })
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })

  app.post('/api/v1/media/items/:mediaItemId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const body = z.object({ kind: z.string().default('love') }).safeParse(req.body ?? {})
    const kind = body.success && isFeedReactionId(body.data.kind) ? body.data.kind : 'love'
    await db
      .insert(schema.mediaReactions)
      .values({ userId: auth.userId, mediaItemId, kind })
      .onConflictDoUpdate({
        target: [schema.mediaReactions.userId, schema.mediaReactions.mediaItemId],
        set: { kind },
      })
    return reply.send({ ok: true, kind })
  })

  app.delete('/api/v1/media/items/:mediaItemId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    await db
      .delete(schema.mediaReactions)
      .where(
        and(
          eq(schema.mediaReactions.mediaItemId, mediaItemId),
          eq(schema.mediaReactions.userId, auth.userId),
        ),
      )
    return reply.status(204).send()
  })

  app.get('/api/v1/media/items/:mediaItemId/comments', async (req, reply) => {
    if (!requireDb(reply)) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const rows = await db
      .select({
        id: schema.mediaComments.id,
        body: schema.mediaComments.body,
        authorId: schema.mediaComments.authorId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        createdAt: schema.mediaComments.createdAt,
      })
      .from(schema.mediaComments)
      .innerJoin(schema.users, eq(schema.users.id, schema.mediaComments.authorId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(and(eq(schema.mediaComments.mediaItemId, mediaItemId), isNull(schema.mediaComments.deletedAt)))
      .orderBy(desc(schema.mediaComments.createdAt))
      .limit(50)
    return reply.send({
      comments: rows.map((r) => ({
        id: r.id,
        body: r.body,
        author: { id: r.authorId, username: r.username, displayName: r.displayName },
        createdAt: r.createdAt.toISOString(),
      })),
    })
  })

  app.post('/api/v1/media/items/:mediaItemId/comments', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const parsed = z.object({ body: z.string().min(1).max(5000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const now = new Date()
    const [row] = await db
      .insert(schema.mediaComments)
      .values({
        mediaItemId,
        authorId: auth.userId,
        body: parsed.data.body.trim(),
        updatedAt: now,
      })
      .returning()
    return reply.status(201).send({ comment: row })
  })

  app.delete('/api/v1/media/items/:mediaItemId/comments/:commentId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { commentId } = req.params as { commentId: string }
    try {
      await softDeleteMediaComment({ commentId, actorUserId: auth.userId })
      return reply.status(204).send()
    } catch (e) {
      if (e instanceof MediaSocialError) {
        return reply.status(e.code === 'forbidden' ? 403 : 400).send({ error: e.message })
      }
      throw e
    }
  })

  app.get('/api/v1/me/media/people-tags/pending', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const tags = await listPendingPeopleTagsForUser(auth.userId)
    return reply.send({ tags })
  })

  app.post('/api/v1/media/items/:mediaItemId/people-tags', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const parsed = z
      .object({
        taggedUserId: z.string().uuid(),
        x: z.number().min(0).max(1).optional(),
        y: z.number().min(0).max(1).optional(),
        label: z.string().max(120).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const tag = await createPeopleTagOnMediaItem({
        mediaItemId,
        taggedUserId: parsed.data.taggedUserId,
        taggedByUserId: auth.userId,
        x: parsed.data.x,
        y: parsed.data.y,
        label: parsed.data.label,
      })
      return reply.status(201).send({ tag })
    } catch (e) {
      if (e instanceof MediaSocialError) {
        return reply.status(e.code === 'forbidden' ? 403 : 400).send({ error: e.message })
      }
      throw e
    }
  })

  app.patch('/api/v1/media/people-tags/:tagId', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { tagId } = req.params as { tagId: string }
    const parsed = z.object({ status: z.enum(['approved', 'declined', 'removed']) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      await updatePeopleTagStatus({
        tagId,
        actorUserId: auth.userId,
        status: parsed.data.status,
      })
      return reply.send({ ok: true })
    } catch (e) {
      if (e instanceof MediaSocialError) {
        return reply.status(e.code === 'forbidden' ? 403 : 400).send({ error: e.message })
      }
      throw e
    }
  })

  app.post('/api/v1/me/media/items/:mediaItemId/use-as-avatar', async (req, reply) => {
    if (!requireDb(reply)) return
    const auth = requireUser(req, reply)
    if (!auth) return
    const { mediaItemId } = req.params as { mediaItemId: string }
    const profile = await ensureProfileForUserId(auth.userId)
    try {
      await syncMediaItemAsAvatar(auth.userId, profile.id, mediaItemId)
      return reply.send({ ok: true })
    } catch (e) {
      if (e instanceof MediaSocialError) return reply.status(400).send({ error: e.message })
      throw e
    }
  })
}
