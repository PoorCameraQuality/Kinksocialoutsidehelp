import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { normalizeProfilePhotoDisplaySettings } from '@c2k/shared'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { ensureProfileForUserId } from '../lib/ensure-profile.js'
import {
  createMediaAssetForProfilePhoto,
  assertMediaAssetUploader,
  MediaAssetAccessError,
  MediaAssetNotFoundError,
} from '../lib/media-asset-service.js'
import {
  autoPublishProfileGalleryPhoto,
  rejectProfileGalleryMediaAsset,
} from '../lib/profile-photo-policy.js'
import {
  assertPersonalPhotoQuotaForAsset,
  assertPersonalPhotoQuotaRoom,
  getPersonalPhotoQuota,
  PersonalPhotoQuotaError,
} from '../lib/personal-photo-quota.js'
import {
  assertQuarantineStorageKeyOwnedByUser,
  MediaUploadValidationError,
} from '../lib/media-pipeline.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'
import {
  isPhotoAvatarEligible,
  loadProfilePhotos,
  loadPublicProfilePhotos,
  mapPhotoRow,
  isPhotoPubliclyVisible,
  profilePhotoServingUrl,
  syncProfileAvatarUrl,
  type ProfilePhotoDto,
} from '../lib/profile-photo-gallery.js'
import {
  demotePrimaryProfilePhotos,
  repairPrimaryAfterProfilePhotoDelete,
  setPrimaryProfilePhoto,
  SetPrimaryProfilePhotoError,
} from '../lib/set-primary-profile-photo.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

async function resolveOwnProfile(userId: string) {
  return ensureProfileForUserId(userId)
}

const profilePhotoDisplaySettingsBody = z.object({
  displayFit: z.enum(['cover', 'contain']),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
})

const createBodySchema = z
  .object({
    quarantineKey: z.string().min(1).max(2048).optional(),
    caption: z.string().max(500).optional().nullable(),
    displaySettings: profilePhotoDisplaySettingsBody.optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    mediaAssetId: z.string().uuid().optional(),
    mimeType: z.string().max(128).optional(),
    sizeBytes: z.number().int().min(0).optional(),
    originalFilename: z.string().max(512).optional(),
    sha256Hash: z.string().max(64).optional(),
    imageWidth: z.number().int().min(0).optional(),
    imageHeight: z.number().int().min(0).optional(),
    storageBucket: z.string().max(128).optional(),
  })
  .refine((data) => Boolean(data.quarantineKey?.trim() || data.mediaAssetId), {
    message: 'quarantineKey or mediaAssetId is required',
  })

const patchBodySchema = z.object({
  caption: z.string().max(500).optional().nullable(),
  displaySettings: profilePhotoDisplaySettingsBody.optional().nullable(),
})

export async function registerProfilePhotosRoutes(app: FastifyInstance) {
  app.get('/api/profile/me/photos', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile photos API requires USE_DATABASE=true' })
    }

    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const prof = await resolveOwnProfile(userId)
    const photos = await loadProfilePhotos(prof.id)
    const quota = await getPersonalPhotoQuota(userId)

    return reply.send({ photos, quota })
  })

  app.post('/api/profile/me/photos', { ...rateLimitRoute('upload') }, async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile photos API requires USE_DATABASE=true' })
    }

    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    if (await rejectIfUserIdentityBanned(userId, reply)) return

    const parsed = createBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }

    const prof = await resolveOwnProfile(userId)
    const existing = await loadProfilePhotos(prof.id)
    const sortOrder = parsed.data.sortOrder ?? existing.length

    if (parsed.data.mediaAssetId) {
      try {
        await assertMediaAssetUploader(userId, parsed.data.mediaAssetId)
      } catch (err) {
        if (err instanceof MediaAssetNotFoundError) {
          return reply.status(404).send({ error: 'Media asset not found' })
        }
        if (err instanceof MediaAssetAccessError) {
          return reply.status(403).send({ error: 'Forbidden', code: 'media_asset_forbidden' })
        }
        throw err
      }
    } else {
      try {
        assertQuarantineStorageKeyOwnedByUser(userId, parsed.data.quarantineKey!)
      } catch (err) {
        if (err instanceof MediaUploadValidationError) {
          return reply.status(400).send({ error: err.message, code: 'invalid_upload_reference' })
        }
        throw err
      }
    }

    try {
      if (parsed.data.mediaAssetId) {
        await assertPersonalPhotoQuotaForAsset(userId, parsed.data.mediaAssetId)
      } else {
        await assertPersonalPhotoQuotaRoom(userId, 1)
      }
    } catch (err) {
      if (err instanceof PersonalPhotoQuotaError) {
        return reply.status(403).send({ error: err.message, code: err.code, quota: err.quota })
      }
      throw err
    }

    let mediaAssetId = parsed.data.mediaAssetId ?? null

    if (!mediaAssetId) {
      mediaAssetId = await createMediaAssetForProfilePhoto({
        userId,
        profileId: prof.id,
        quarantineKey: parsed.data.quarantineKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        originalFilename: parsed.data.originalFilename,
        sha256Hash: parsed.data.sha256Hash,
        imageWidth: parsed.data.imageWidth,
        imageHeight: parsed.data.imageHeight,
        storageBucket: parsed.data.storageBucket,
      })

      const published = await autoPublishProfileGalleryPhoto({ mediaAssetId, userId })
      if (published.outcome === 'rejected') {
        await rejectProfileGalleryMediaAsset(mediaAssetId)
        return reply.status(400).send({ error: published.error, code: 'profile_photo_blocked' })
      }
    }

    const [publishedMedia] = mediaAssetId
      ? await db
          .select()
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, mediaAssetId))
          .limit(1)
      : []

    const photoUrl = mediaAssetId ? profilePhotoServingUrl(mediaAssetId, publishedMedia ?? null) : ''

    const [row] = await db.transaction(async (tx) => {
      if (sortOrder === 0) {
        await demotePrimaryProfilePhotos(tx, prof.id)
      }

      const [inserted] = await tx
        .insert(schema.profilePhotos)
        .values({
          profileId: prof.id,
          mediaAssetId,
          url: photoUrl,
          caption: parsed.data.caption ?? null,
          displaySettings: parsed.data.displaySettings
            ? normalizeProfilePhotoDisplaySettings(parsed.data.displaySettings)
            : null,
          sortOrder,
        })
        .returning()

      return [inserted]
    })

    // Only sync avatar when the new photo was requested as primary AND is eligible.
    // Pending/quarantined uploads must not replace the published profile picture.
    if (sortOrder === 0) {
      const mapped = mapPhotoRow(row!, publishedMedia ?? null)
      if (isPhotoAvatarEligible(mapped)) {
        await syncProfileAvatarUrl(prof.id)
      }
    }

    const [media] = mediaAssetId
      ? await db
          .select()
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, mediaAssetId))
          .limit(1)
      : publishedMedia
        ? [publishedMedia]
        : []

    return reply.status(201).send({ photo: mapPhotoRow(row!, media ?? null) })
  })

  app.post('/api/profile/me/photos/:photoId/set-primary', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile photos API requires USE_DATABASE=true' })
    }

    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    if (await rejectIfUserIdentityBanned(userId, reply)) return

    const { photoId } = req.params as { photoId: string }
    const prof = await resolveOwnProfile(userId)

    try {
      const result = await setPrimaryProfilePhoto({
        profileId: prof.id,
        photoId,
        actorUserId: userId,
      })
      return reply.send(result)
    } catch (err) {
      if (err instanceof SetPrimaryProfilePhotoError) {
        const status = err.code === 'not_found' ? 404 : err.code === 'not_eligible' ? 400 : 403
        return reply.status(status).send({ error: err.message, code: err.code })
      }
      throw err
    }
  })

  app.patch('/api/profile/me/photos/:photoId', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile photos API requires USE_DATABASE=true' })
    }

    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { photoId } = req.params as { photoId: string }
    const parsed = patchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }

    const prof = await resolveOwnProfile(userId)

    const patch: { caption?: string | null; displaySettings?: ProfilePhotoDisplaySettings | null } = {}
    if (parsed.data.caption !== undefined) patch.caption = parsed.data.caption
    if (parsed.data.displaySettings !== undefined) {
      patch.displaySettings =
        parsed.data.displaySettings === null
          ? null
          : normalizeProfilePhotoDisplaySettings(parsed.data.displaySettings)
    }

    const [updated] = await db
      .update(schema.profilePhotos)
      .set(patch)
      .where(and(eq(schema.profilePhotos.id, photoId), eq(schema.profilePhotos.profileId, prof.id)))
      .returning()

    if (!updated) {
      return reply.status(404).send({ error: 'Photo not found' })
    }

    const [media] = updated.mediaAssetId
      ? await db
          .select()
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, updated.mediaAssetId))
          .limit(1)
      : []

    return reply.send({ photo: mapPhotoRow(updated, media ?? null) })
  })

  app.delete('/api/profile/me/photos/:photoId', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile photos API requires USE_DATABASE=true' })
    }

    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { photoId } = req.params as { photoId: string }
    const prof = await resolveOwnProfile(userId)

    const [deleted] = await db
      .delete(schema.profilePhotos)
      .where(and(eq(schema.profilePhotos.id, photoId), eq(schema.profilePhotos.profileId, prof.id)))
      .returning()

    if (!deleted) {
      return reply.status(404).send({ error: 'Photo not found' })
    }

    await repairPrimaryAfterProfilePhotoDelete(prof.id)

    return reply.send({ ok: true })
  })
}

export {
  loadProfilePhotos,
  loadPublicProfilePhotos,
  mapPhotoRow,
  isPhotoPubliclyVisible,
  syncProfileAvatarUrl,
  type ProfilePhotoDto,
}
