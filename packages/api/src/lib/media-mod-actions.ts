/**
 * Moderator-facing media mutations: quarantine, remove, hide-on-report, restore.
 *
 * Distinct from `media-moderation-decision.ts`, which derives publish/scan *decisions*
 * from scanner results (no human action). Call this module from T&S / report flows.
 */
import {
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
  SCAN_STATUSES,
  isMediaPublishedStatus,
  isPublicStorageState,
} from '@c2k/shared'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getMediaAssetById } from './media-asset-service.js'
import { syncProfilePhotoServingUrlsForAsset } from './sync-profile-media-serving-urls.js'

export async function assetHasMalwareBlock(mediaAssetId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.mediaScannerResults.id })
    .from(schema.mediaScannerResults)
    .where(
      and(
        eq(schema.mediaScannerResults.mediaAssetId, mediaAssetId),
        eq(schema.mediaScannerResults.scannerName, SCANNER_NAMES.malwareClamav),
        eq(schema.mediaScannerResults.status, SCANNER_RESULT_STATUSES.blocked)
      )
    )
    .orderBy(desc(schema.mediaScannerResults.createdAt))
    .limit(1)
  return Boolean(row)
}

export async function resolveMediaAssetIdFromCase(
  targetContentType: string,
  targetContentId: string
): Promise<string | null> {
  if (targetContentType === 'media_asset') return targetContentId
  if (targetContentType === 'profile_photo') {
    const [row] = await db
      .select({ mediaAssetId: schema.profilePhotos.mediaAssetId })
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.id, targetContentId))
      .limit(1)
    return row?.mediaAssetId ?? null
  }
  return null
}

/**
 * Mark an asset removed (non-servable). `reason` is required for call-site clarity /
 * future audit persistence; callers should also write a moderation audit row.
 */
export async function removeMediaAssetByModerator(
  actorUserId: string,
  mediaAssetId: string,
  reason: string,
): Promise<void> {
  void reason
  const now = new Date()
  await db
    .update(schema.mediaAssets)
    .set({
      uploadStatus: MEDIA_UPLOAD_STATUSES.removed,
      storageState: MEDIA_STORAGE_STATES.removedPrivate,
      removedAt: now,
      removedByUserId: actorUserId,
      updatedAt: now,
    })
    .where(eq(schema.mediaAssets.id, mediaAssetId))

  await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, mediaAssetId))
}

export async function keepMediaQuarantined(
  _actorUserId: string,
  mediaAssetId: string
): Promise<void> {
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) throw new Error('Media asset not found')
  if (isPublicStorageState(asset.storageState)) return

  const updates: Partial<typeof schema.mediaAssets.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (asset.uploadStatus !== MEDIA_UPLOAD_STATUSES.quarantined) {
    updates.uploadStatus = MEDIA_UPLOAD_STATUSES.quarantined
  }
  if (asset.storageState !== MEDIA_STORAGE_STATES.quarantinedPrivate) {
    updates.storageState = MEDIA_STORAGE_STATES.quarantinedPrivate
  }
  if (Object.keys(updates).length > 1) {
    await db.update(schema.mediaAssets).set(updates).where(eq(schema.mediaAssets.id, mediaAssetId))
  }
}

/**
 * Post-moderation: hide a published (or pending) asset when a member reports it.
 * QUARANTINED status blocks non-staff viewers; storageState drops out of public
 * URL exposure. Mods restore via restore_media / approve flows.
 */
export async function hideMediaAssetOnReport(mediaAssetId: string): Promise<void> {
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) return
  if (
    asset.uploadStatus === MEDIA_UPLOAD_STATUSES.removed ||
    asset.uploadStatus === MEDIA_UPLOAD_STATUSES.quarantined
  ) {
    return
  }

  await db
    .update(schema.mediaAssets)
    .set({
      uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
      storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, mediaAssetId))

  // Drop profile-photo rows' serving if this asset is a gallery/avatar photo.
  if (asset.ownerType === 'profile' && asset.ownerId) {
    const [linkedPhoto] = await db
      .select({ profileId: schema.profilePhotos.profileId })
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.mediaAssetId, mediaAssetId))
      .limit(1)
    if (linkedPhoto?.profileId) {
      const { syncProfileAvatarUrl } = await import('../routes/profile-photos.js')
      await syncProfileAvatarUrl(linkedPhoto.profileId)
    }
  }
}

/** Clear a false-positive scanner flag and publish the asset when safe. */
export async function approveMediaAssetByModerator(
  actorUserId: string,
  mediaAssetId: string
): Promise<void> {
  if (await assetHasMalwareBlock(mediaAssetId)) {
    throw new Error('Cannot approve malware-blocked asset')
  }
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) throw new Error('Media asset not found')
  if (isMediaPublishedStatus(asset.uploadStatus as Parameters<typeof isMediaPublishedStatus>[0])) {
    return
  }

  const { promoteMediaAssetToPublic } = await import('./media-pipeline.js')
  await promoteMediaAssetToPublic({ mediaAssetId, promotedByUserId: actorUserId })

  const promoted = await getMediaAssetById(mediaAssetId)
  await db
    .update(schema.mediaAssets)
    .set({
      uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
      scanStatus: SCAN_STATUSES.passed,
      storageState: promoted?.storageState ?? MEDIA_STORAGE_STATES.validatedPrivate,
      updatedAt: new Date(),
    })
    .where(eq(schema.mediaAssets.id, mediaAssetId))

  await syncProfilePhotoServingUrlsForAsset(mediaAssetId, promoted)

  if (asset.ownerType === 'profile' && asset.ownerId) {
    const [linkedPhoto] = await db
      .select({ profileId: schema.profilePhotos.profileId })
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.mediaAssetId, mediaAssetId))
      .limit(1)
    const profileId = linkedPhoto?.profileId ?? asset.ownerId
    const { syncProfileAvatarUrl } = await import('../routes/profile-photos.js')
    await syncProfileAvatarUrl(profileId)
  }
}

export async function restoreMediaAssetByModerator(
  _actorUserId: string,
  mediaAssetId: string,
  _reason: string
): Promise<void> {
  if (await assetHasMalwareBlock(mediaAssetId)) {
    throw new Error('Cannot restore malware-blocked asset')
  }
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) throw new Error('Media asset not found')

  const updates: Partial<typeof schema.mediaAssets.$inferInsert> = {
    removedAt: null,
    removedByUserId: null,
    updatedAt: new Date(),
  }
  if (asset.uploadStatus === MEDIA_UPLOAD_STATUSES.removed) {
    updates.uploadStatus = MEDIA_UPLOAD_STATUSES.quarantined
    updates.storageState = MEDIA_STORAGE_STATES.quarantinedPrivate
  }

  await db.update(schema.mediaAssets).set(updates).where(eq(schema.mediaAssets.id, mediaAssetId))
}
