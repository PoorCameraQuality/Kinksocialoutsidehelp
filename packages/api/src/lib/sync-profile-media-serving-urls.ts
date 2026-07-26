import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { MediaAsset } from '../db/schema.js'
import { resolveMediaClientUrl } from './media-pipeline.js'

/** True when a stored URL pointed at a deleted public MinIO object. */
export function isStaleDirectMediaUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return false
  return trimmed.includes('/c2k-uploads/media/') || trimmed.includes('/c2k-uploads/quarantine/')
}

/** Rewrite profile photo rows + denormalized avatar after quarantine promotion or remediation. */
export async function syncProfilePhotoServingUrlsForAsset(
  mediaAssetId: string,
  asset?: MediaAsset | null,
): Promise<{ photoRows: number; profiles: number }> {
  const resolved =
    asset ??
    (
      await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, mediaAssetId))
        .limit(1)
    )[0]
  if (!resolved) return { photoRows: 0, profiles: 0 }

  const servingUrl = resolveMediaClientUrl(resolved)
  const photoRows = await db
    .update(schema.profilePhotos)
    .set({ url: servingUrl })
    .where(eq(schema.profilePhotos.mediaAssetId, mediaAssetId))
    .returning({ profileId: schema.profilePhotos.profileId, sortOrder: schema.profilePhotos.sortOrder })

  const primaryProfileIds = [
    ...new Set(
      photoRows.filter((row) => row.sortOrder === 0).map((row) => row.profileId),
    ),
  ]
  if (primaryProfileIds.length === 0) {
    return { photoRows: photoRows.length, profiles: 0 }
  }

  await db
    .update(schema.profiles)
    .set({ avatarUrl: servingUrl, updatedAt: new Date() })
    .where(inArray(schema.profiles.id, primaryProfileIds))

  return { photoRows: photoRows.length, profiles: primaryProfileIds.length }
}

export async function syncAllProfileMediaServingUrls(): Promise<{
  assets: number
  photoRows: number
  profiles: number
}> {
  const rows = await db
    .select({
      mediaAssetId: schema.profilePhotos.mediaAssetId,
      asset: schema.mediaAssets,
    })
    .from(schema.profilePhotos)
    .innerJoin(schema.mediaAssets, eq(schema.profilePhotos.mediaAssetId, schema.mediaAssets.id))

  const byAsset = new Map<string, MediaAsset>()
  for (const row of rows) {
    if (row.mediaAssetId && row.asset) byAsset.set(row.mediaAssetId, row.asset)
  }

  let photoRows = 0
  let profiles = 0
  for (const [mediaAssetId, asset] of byAsset) {
    const result = await syncProfilePhotoServingUrlsForAsset(mediaAssetId, asset)
    photoRows += result.photoRows
    profiles += result.profiles
  }

  return { assets: byAsset.size, photoRows, profiles }
}
