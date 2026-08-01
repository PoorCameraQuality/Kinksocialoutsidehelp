/**
 * Profile gallery load / map / avatar sync helpers shared by routes and set-primary.
 */
import { and, asc, eq } from 'drizzle-orm'

import {
  isMediaPublishedStatus,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  normalizeProfilePhotoDisplaySettings,
} from '@c2k/shared'
import type { ProfilePhotoDisplaySettings } from '@c2k/shared'

import { db, schema } from '../db/index.js'
import type { MediaAsset } from '../db/schema.js'
import { mediaAssetToPhotoDto } from './media-asset-service.js'
import { deliverProfileHeroUrl } from './image-delivery.js'
import { mediaContentProxyPath, resolveMediaClientUrl } from './media-pipeline.js'
import { isBrowserReachablePublicUrl } from './s3-upload.js'

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

const ANONYMOUS_PROFILE_PHOTO_VISIBILITIES = new Set<string>([MEDIA_VISIBILITIES.publicPreview])

function profilePhotoServingUrl(mediaAssetId: string, media: MediaAsset | null | undefined): string {
  if (media) return resolveMediaClientUrl(media)
  return mediaContentProxyPath(mediaAssetId)
}

export function resolveProfilePhotoUrl(
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

export function mapPhotoRow(
  r: typeof schema.profilePhotos.$inferSelect,
  media?: MediaAsset | null,
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

/** Published profile photo eligible for denormalized avatar_url. */
export function isPhotoAvatarEligible(photo: ProfilePhotoDto): boolean {
  if (!photo.mediaAssetId || !photo.uploadStatus) return false
  if (photo.uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation) return false
  if (photo.pendingReview) return false
  return isMediaPublishedStatus(photo.uploadStatus as Parameters<typeof isMediaPublishedStatus>[0])
}

export function isPhotoPubliclyVisible(photo: ProfilePhotoDto): boolean {
  if (!isPhotoAvatarEligible(photo)) return false
  if (photo.visibility && !ANONYMOUS_PROFILE_PHOTO_VISIBILITIES.has(photo.visibility)) {
    return false
  }
  return true
}

export async function loadProfilePhotosJoined(profileId: string): Promise<ProfilePhotoDto[]> {
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

export async function loadProfilePhotos(profileId: string) {
  return loadProfilePhotosJoined(profileId)
}

export async function loadPublicProfilePhotos(profileId: string) {
  const all = await loadProfilePhotosJoined(profileId)
  return all.filter(isPhotoPubliclyVisible)
}

export async function syncProfileAvatarUrl(profileId: string): Promise<void> {
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

export { profilePhotoServingUrl }
