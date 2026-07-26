import { and, asc, eq } from 'drizzle-orm'

import type { FastifyInstance } from 'fastify'

import { z } from 'zod'

import { isMediaPublishedStatus, MEDIA_UPLOAD_STATUSES, MEDIA_VISIBILITIES, normalizeProfilePhotoDisplaySettings } from '@c2k/shared'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'

import { getViewerUserId } from '../auth/viewer-user-id.js'

import { db, schema } from '../db/index.js'

import { ensureProfileForUserId } from '../lib/ensure-profile.js'

import {

  createMediaAssetForProfilePhoto,

  mediaAssetToPhotoDto,

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
  mediaContentProxyPath,
  MediaUploadValidationError,
  resolveMediaClientUrl,
} from '../lib/media-pipeline.js'
import { deliverProfileHeroUrl } from '../lib/image-delivery.js'
import { isBrowserReachablePublicUrl } from '../lib/s3-upload.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'

import type { MediaAsset } from '../db/schema.js'



function useDatabase(): boolean {

  return process.env.USE_DATABASE === 'true'

}



export type ProfilePhotoDto = {

  id: string

  url: string

  caption: string | null

  displaySettings: ProfilePhotoDisplaySettings

  order: number

  mediaAssetId: string | null

  uploadStatus: string | null

  contentRating: string | null

  visibility: string | null

  isBlurredByDefault: boolean

  pendingReview: boolean

  publishLane: string | null

}



function profilePhotoServingUrl(mediaAssetId: string, media: MediaAsset | null | undefined): string {
  if (media) return resolveMediaClientUrl(media)
  return mediaContentProxyPath(mediaAssetId)
}

function resolveProfilePhotoUrl(
  r: typeof schema.profilePhotos.$inferSelect,
  media?: MediaAsset | null,
): string {
  const mediaId = r.mediaAssetId ?? media?.id ?? null
  if (mediaId) {
    return profilePhotoServingUrl(mediaId, media ?? null)
  }
  const stored = r.url?.trim() ?? ''
  if (!stored) return ''
  if (stored.startsWith('/') || isBrowserReachablePublicUrl(stored)) return stored
  return ''
}

function mapPhotoRow(

  r: typeof schema.profilePhotos.$inferSelect,

  media?: MediaAsset | null

): ProfilePhotoDto {

  const mediaDto = mediaAssetToPhotoDto(media)
  const rawUrl = resolveProfilePhotoUrl(r, media)

  return {

    id: r.id,

    url: deliverProfileHeroUrl(rawUrl) ?? rawUrl,

    caption: r.caption,

    displaySettings: normalizeProfilePhotoDisplaySettings(r.displaySettings),

    order: r.sortOrder,

    mediaAssetId: r.mediaAssetId ?? mediaDto.mediaAssetId,

    uploadStatus: mediaDto.uploadStatus,

    contentRating: mediaDto.contentRating,

    visibility: mediaDto.visibility,

    isBlurredByDefault: mediaDto.isBlurredByDefault,

    pendingReview: mediaDto.pendingReview,

    publishLane: mediaDto.publishLane,

  }

}



const ANONYMOUS_PROFILE_PHOTO_VISIBILITIES = new Set<string>([
  MEDIA_VISIBILITIES.publicPreview,
])

/** Published profile photo eligible for denormalized avatar_url (any logged-in visibility). */
function isPhotoAvatarEligible(photo: ProfilePhotoDto): boolean {
  if (!photo.mediaAssetId || !photo.uploadStatus) return false
  if (photo.uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation) return false
  if (photo.pendingReview) return false
  return isMediaPublishedStatus(photo.uploadStatus as Parameters<typeof isMediaPublishedStatus>[0])
}

function isPhotoPubliclyVisible(photo: ProfilePhotoDto): boolean {

  if (!isPhotoAvatarEligible(photo)) return false

  if (photo.visibility && !ANONYMOUS_PROFILE_PHOTO_VISIBILITIES.has(photo.visibility)) {
    return false
  }

  return true

}



async function loadProfilePhotosJoined(profileId: string): Promise<ProfilePhotoDto[]> {

  const rows = await db

    .select({

      photo: schema.profilePhotos,

      media: schema.mediaAssets,

    })

    .from(schema.profilePhotos)

    .leftJoin(schema.mediaAssets, eq(schema.profilePhotos.mediaAssetId, schema.mediaAssets.id))

    .where(eq(schema.profilePhotos.profileId, profileId))

    .orderBy(asc(schema.profilePhotos.sortOrder), asc(schema.profilePhotos.createdAt))



  return rows.map(({ photo, media }) => mapPhotoRow(photo, media))

}



async function loadProfilePhotos(profileId: string) {

  return loadProfilePhotosJoined(profileId)

}



async function loadPublicProfilePhotos(profileId: string) {

  const all = await loadProfilePhotosJoined(profileId)

  return all.filter(isPhotoPubliclyVisible)

}



async function resolveOwnProfile(userId: string) {

  return ensureProfileForUserId(userId)

}



async function syncProfileAvatarUrl(profileId: string): Promise<void> {
  const rows = await loadProfilePhotosJoined(profileId)
  const primary =
    rows.find((p) => p.order === 0 && isPhotoAvatarEligible(p))
    ?? rows.find((p) => isPhotoAvatarEligible(p))
  const avatarUrl = primary?.url?.trim() ?? null
  await db
    .update(schema.profiles)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(schema.profiles.id, profileId))
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

    const photoUrl =
      mediaAssetId ? profilePhotoServingUrl(mediaAssetId, publishedMedia ?? null)
      : ''



    const [row] = await db.transaction(async (tx) => {
      if (sortOrder === 0) {
        const atZero = await tx
          .select({ id: schema.profilePhotos.id, sortOrder: schema.profilePhotos.sortOrder })
          .from(schema.profilePhotos)
          .where(
            and(
              eq(schema.profilePhotos.profileId, prof.id),
              eq(schema.profilePhotos.sortOrder, 0),
            ),
          )
        if (atZero.length > 0) {
          const allOrders = await tx
            .select({ sortOrder: schema.profilePhotos.sortOrder })
            .from(schema.profilePhotos)
            .where(eq(schema.profilePhotos.profileId, prof.id))
          const maxOrder = allOrders.reduce((max: number, r: { sortOrder: number }) => Math.max(max, r.sortOrder), 0)
          let nextOrder = maxOrder + 1
          for (const prior of atZero) {
            await tx
              .update(schema.profilePhotos)
              .set({ sortOrder: nextOrder })
              .where(eq(schema.profilePhotos.id, prior.id))
            nextOrder += 1
          }
        }
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

    if (sortOrder === 0) {
      await syncProfileAvatarUrl(prof.id)
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

    if (deleted.sortOrder === 0) {

      await syncProfileAvatarUrl(prof.id)

    }

    return reply.send({ ok: true })

  })

}



export {
  loadProfilePhotos,
  loadPublicProfilePhotos,
  mapPhotoRow,
  isPhotoPubliclyVisible,
  syncProfileAvatarUrl,
}

