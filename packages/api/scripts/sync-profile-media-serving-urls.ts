/**
 * Backfill profile_photos.url and profiles.avatar_url after quarantine promotion / remediation.
 *
 * Usage:
 *   USE_DATABASE=true npm run db:sync-profile-media-urls -w @c2k/api
 *   USE_DATABASE=true APPLY=true npm run db:sync-profile-media-urls -w @c2k/api
 */
import { eq, or, sql } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import {
  isStaleDirectMediaUrl,
  syncAllProfileMediaServingUrls,
} from '../src/lib/sync-profile-media-serving-urls.js'

const APPLY = process.env.APPLY === 'true'

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }

  const stalePhotos = await db
    .select({
      id: schema.profilePhotos.id,
      url: schema.profilePhotos.url,
      mediaAssetId: schema.profilePhotos.mediaAssetId,
    })
    .from(schema.profilePhotos)
    .where(
      or(
        sql`${schema.profilePhotos.url} LIKE '%/c2k-uploads/media/%'`,
        sql`${schema.profilePhotos.url} LIKE '%/c2k-uploads/quarantine/%'`,
      ),
    )

  const staleAvatars = await db
    .select({
      id: schema.profiles.id,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.profiles)
    .where(
      or(
        sql`${schema.profiles.avatarUrl} LIKE '%/c2k-uploads/media/%'`,
        sql`${schema.profiles.avatarUrl} LIKE '%/c2k-uploads/quarantine/%'`,
      ),
    )

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        stalePhotoRows: stalePhotos.length,
        staleAvatarRows: staleAvatars.length,
        samplePhotos: stalePhotos.slice(0, 5),
        sampleAvatars: staleAvatars.slice(0, 5).map((row) => ({
          id: row.id,
          stale: isStaleDirectMediaUrl(row.avatarUrl),
          avatarUrl: row.avatarUrl,
        })),
      },
      null,
      2,
    ),
  )

  if (!APPLY) {
    console.log('\nDry run only — set APPLY=true to rewrite serving URLs.')
    return
  }

  const result = await syncAllProfileMediaServingUrls()
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
