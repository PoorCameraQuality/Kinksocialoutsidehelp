/**
 * Profile photo upload hardening — DB-backed route tests.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { MEDIA_STORAGE_STATES } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'
process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
process.env.C2K_ALLOW_NUDITY = 'true'
process.env.MEDIA_POLICY_MODE = 'attested_explicit_beta'

describe('profile photo upload hardening', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const assetIds: string[] = []
  const photoIds: string[] = []
  let ownerId: string
  let ownerUsername: string
  let otherId: string
  let otherUsername: string
  let profileId: string

  after(async () => {
    for (const photoId of photoIds) {
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.id, photoId))
    }
    for (const assetId of assetIds) {
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('setup users and profile', async () => {
    const owner = await insertCiUser(`prof_photo_${tag}`)
    const other = await insertCiUser(`prof_photo_o_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    otherId = other.id
    otherUsername = other.username
    userIds.push(owner.id, other.id)

    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Photo Owner' })
      .returning({ id: schema.profiles.id })
    profileId = profile.id
  })

  test('POST rejects legacy url-only body', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfilePhotosRoutes } = await import('../routes/profile-photos.js')
      await registerProfilePhotosRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/profile/me/photos',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          url: 'https://evil.example/photo.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      assert.equal(res.statusCode, 400)
    } finally {
      await app.close()
    }
  })

  test('POST rejects quarantine key outside uploader prefix', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfilePhotosRoutes } = await import('../routes/profile-photos.js')
      await registerProfilePhotosRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/profile/me/photos',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          quarantineKey: `quarantine/${otherId}/${tag}-stolen.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      assert.equal(res.statusCode, 400)
      const body = res.json() as { code?: string }
      assert.equal(body.code, 'invalid_upload_reference')
    } finally {
      await app.close()
    }
  })

  test('POST rejects attaching another users staged asset', async () => {
    ensureCiAuthSecret()
    const [otherProfile] = await db
      .insert(schema.profiles)
      .values({ userId: otherId, displayName: 'Other' })
      .returning({ id: schema.profiles.id })

    const [asset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: otherId,
        ownerType: 'profile',
        ownerId: otherProfile!.id,
        sourceSurface: 'profile_gallery',
        storageKey: `quarantine/${otherId}/${tag}-other.jpg`,
        quarantineStorageKey: `quarantine/${otherId}/${tag}-other.jpg`,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadStatus: 'PENDING_ATTESTATION',
      })
      .returning({ id: schema.mediaAssets.id })
    assetIds.push(asset!.id)

    const app = await buildCookieApp(async (a) => {
      const { registerProfilePhotosRoutes } = await import('../routes/profile-photos.js')
      await registerProfilePhotosRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/profile/me/photos',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          mediaAssetId: asset!.id,
          sortOrder: 0,
        },
      })
      assert.equal(res.statusCode, 403)
      const body = res.json() as { code?: string }
      assert.equal(body.code, 'media_asset_forbidden')
    } finally {
      await app.close()
    }
  })

  test('POST accepts valid quarantine key for own profile', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfilePhotosRoutes } = await import('../routes/profile-photos.js')
      await registerProfilePhotosRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/profile/me/photos',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          quarantineKey: `quarantine/${ownerId}/${tag}-valid.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          originalFilename: 'valid.jpg',
        },
      })
      assert.equal(res.statusCode, 201, res.body)
      const body = res.json() as { photo: { id: string; mediaAssetId: string | null } }
      assert.ok(body.photo.id)
      assert.ok(body.photo.mediaAssetId)
      photoIds.push(body.photo.id)
      if (body.photo.mediaAssetId) assetIds.push(body.photo.mediaAssetId)

      const [row] = await db
        .select({ ownerId: schema.mediaAssets.ownerId })
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, body.photo.mediaAssetId!))
        .limit(1)
      assert.equal(row?.ownerId, profileId)
    } finally {
      await app.close()
    }
  })
})
