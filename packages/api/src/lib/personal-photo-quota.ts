import {
  buildPersonalPhotoQuota,
  PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE,
  type PersonalPhotoQuota,
} from '@c2k/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ensureProfileForUserId } from './ensure-profile.js'

export class PersonalPhotoQuotaError extends Error {
  readonly code = 'personal_photo_limit_reached'

  constructor(
    message: string,
    readonly quota: PersonalPhotoQuota,
  ) {
    super(message)
    this.name = 'PersonalPhotoQuotaError'
  }
}

/** Distinct personal image assets + legacy profile rows without a media asset id. */
export async function countPersonalPhotos(userId: string): Promise<number> {
  const profile = await ensureProfileForUserId(userId)

  const profilePhotoRows = await db
    .select({ mediaAssetId: schema.profilePhotos.mediaAssetId })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.profileId, profile.id))

  const assetIds = new Set<string>()
  let legacyOnlyCount = 0
  for (const row of profilePhotoRows) {
    if (row.mediaAssetId) assetIds.add(row.mediaAssetId)
    else legacyOnlyCount++
  }

  const personalItems = await db
    .select({ mediaAssetId: schema.mediaItems.mediaAssetId })
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.ownerUserId, userId),
        eq(schema.mediaItems.mediaKind, 'image'),
        isNull(schema.mediaItems.deletedAt),
        isNull(schema.mediaItems.sourceGroupId),
        isNull(schema.mediaItems.sourceEventId),
        isNull(schema.mediaItems.sourceConventionId),
      ),
    )

  for (const item of personalItems) {
    assetIds.add(item.mediaAssetId)
  }

  return assetIds.size + legacyOnlyCount
}

export async function getPersonalPhotoQuota(userId: string): Promise<PersonalPhotoQuota> {
  const used = await countPersonalPhotos(userId)
  return buildPersonalPhotoQuota(used)
}

export async function assertPersonalPhotoQuotaRoom(
  userId: string,
  additionalPhotos = 1,
): Promise<PersonalPhotoQuota> {
  const quota = await getPersonalPhotoQuota(userId)
  if (quota.used + additionalPhotos > quota.limit) {
    throw new PersonalPhotoQuotaError(PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE, quota)
  }
  return quota
}

/** Skip quota when reusing an asset already counted toward the user's personal library. */
export async function assertPersonalPhotoQuotaForAsset(
  userId: string,
  mediaAssetId: string | null | undefined,
): Promise<void> {
  if (!mediaAssetId) {
    await assertPersonalPhotoQuotaRoom(userId, 1)
    return
  }

  const profile = await ensureProfileForUserId(userId)
  const profilePhotoRows = await db
    .select({ mediaAssetId: schema.profilePhotos.mediaAssetId })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.profileId, profile.id))

  const assetIds = new Set<string>()
  let legacyOnlyCount = 0
  for (const row of profilePhotoRows) {
    if (row.mediaAssetId) assetIds.add(row.mediaAssetId)
    else legacyOnlyCount++
  }

  if (assetIds.has(mediaAssetId)) return

  const [existingItem] = await db
    .select({ id: schema.mediaItems.id })
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.ownerUserId, userId),
        eq(schema.mediaItems.mediaAssetId, mediaAssetId),
        eq(schema.mediaItems.mediaKind, 'image'),
        isNull(schema.mediaItems.deletedAt),
        isNull(schema.mediaItems.sourceGroupId),
        isNull(schema.mediaItems.sourceEventId),
        isNull(schema.mediaItems.sourceConventionId),
      ),
    )
    .limit(1)

  if (existingItem) return

  await assertPersonalPhotoQuotaRoom(userId, 1)
}
