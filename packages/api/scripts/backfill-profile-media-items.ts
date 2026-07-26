/**
 * Backfill profile_photos with media_asset_id into media_items + default albums.
 * Run: npm run db:backfill-media-items -w @c2k/api
 */
import { and, eq, isNull } from 'drizzle-orm'
import { MEDIA_VISIBILITIES } from '@c2k/shared'
import { db, schema } from '../src/db/index.js'
import { ensureDefaultAlbumsForUser } from '../src/lib/media-social-service.js'

async function main() {
  const photos = await db
    .select({
      photo: schema.profilePhotos,
      profileUserId: schema.profiles.userId,
    })
    .from(schema.profilePhotos)
    .innerJoin(schema.profiles, eq(schema.profilePhotos.profileId, schema.profiles.id))
    .where(isNull(schema.profilePhotos.mediaAssetId))

  const withAsset = await db
    .select({
      photo: schema.profilePhotos,
      profileUserId: schema.profiles.userId,
      asset: schema.mediaAssets,
    })
    .from(schema.profilePhotos)
    .innerJoin(schema.profiles, eq(schema.profilePhotos.profileId, schema.profiles.id))
    .innerJoin(schema.mediaAssets, eq(schema.profilePhotos.mediaAssetId, schema.mediaAssets.id))

  let created = 0
  for (const row of withAsset) {
    const { photo, profileUserId, asset } = row
    const [existing] = await db
      .select({ id: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(
        and(
          eq(schema.mediaItems.mediaAssetId, asset.id),
          eq(schema.mediaItems.ownerUserId, profileUserId),
        ),
      )
      .limit(1)
    if (existing) continue

    await ensureDefaultAlbumsForUser(profileUserId)
    const visibility = (asset.visibility as typeof MEDIA_VISIBILITIES.loggedIn) ?? MEDIA_VISIBILITIES.loggedIn

    const [item] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: profileUserId,
        mediaAssetId: asset.id,
        mediaKind: 'image',
        caption: photo.caption,
        visibility,
        sourceSurface: 'profile_photo',
        useAsAvatar: photo.sortOrder === 0,
        pinnedToProfile: photo.sortOrder === 0,
        contentRating: asset.contentRating,
        updatedAt: new Date(),
      })
      .returning({ id: schema.mediaItems.id })

    const albums = await db
      .select()
      .from(schema.mediaAlbums)
      .where(and(eq(schema.mediaAlbums.ownerUserId, profileUserId), isNull(schema.mediaAlbums.deletedAt)))

    for (const kind of ['default_all', 'profile_pictures', 'uploaded_pictures'] as const) {
      const album = albums.find((a) => a.albumKind === kind)
      if (album && item) {
        await db
          .insert(schema.mediaAlbumItems)
          .values({ albumId: album.id, mediaItemId: item.id, sortOrder: photo.sortOrder })
          .onConflictDoNothing()
      }
    }
    created++
  }

  console.log(`Backfill complete: ${created} media_items created (${photos.length} legacy photos without asset skipped)`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
