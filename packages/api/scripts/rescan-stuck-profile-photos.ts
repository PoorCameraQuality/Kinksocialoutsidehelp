/**
 * Re-run scan + promotion for profile gallery assets stuck in PENDING_SCAN (infra errors).
 * Usage (on VPS with DATABASE_URL): npx tsx packages/api/scripts/rescan-stuck-profile-photos.ts
 */
import { eq } from 'drizzle-orm'
import {
  MEDIA_CONTENT_RATINGS,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCAN_STATUSES,
} from '@c2k/shared'
import { db, schema } from '../src/db/index.js'
import { finalizeMediaAfterAttestation } from '../src/lib/media-pipeline.js'
import { syncProfileAvatarUrl } from '../src/routes/profile-photos.js'

async function main() {
  const rows = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.sourceSurface, 'profile_gallery'))

  let fixed = 0
  for (const asset of rows) {
    if (asset.uploadStatus !== MEDIA_UPLOAD_STATUSES.pendingScan) continue
    if (asset.scanStatus !== SCAN_STATUSES.error && asset.scanStatus !== SCAN_STATUSES.flagged) {
      continue
    }
    console.log('Rescanning', asset.id, asset.originalFilename)
    const pipeline = await finalizeMediaAfterAttestation({
      mediaAssetId: asset.id,
      userId: asset.uploaderUserId,
      lane: 'GREEN',
      uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
    })
    if (pipeline.promoted) {
      const [photo] = await db
        .select()
        .from(schema.profilePhotos)
        .where(eq(schema.profilePhotos.mediaAssetId, asset.id))
        .limit(1)
      if (photo?.sortOrder === 0) {
        await syncProfileAvatarUrl(photo.profileId)
      }
      fixed++
      console.log('  -> promoted', pipeline.uploadStatus, pipeline.scanStatus)
    } else {
      console.log('  -> still blocked', pipeline.uploadStatus, pipeline.scanStatus)
    }
  }
  console.log(`Done. Promoted ${fixed} asset(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
