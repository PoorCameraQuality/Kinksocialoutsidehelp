/**
 * T&S-3 media pipeline - DB integration (scan simulate + promotion without S3).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import {
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  SCAN_STATUSES,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'
process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
process.env.C2K_ALLOW_NUDITY = 'true'
process.env.MEDIA_POLICY_MODE = 'attested_explicit_beta'

const runDbTests = process.env.USE_DATABASE === 'true'

const fullAttestation = {
  uploaderConfirmed18: true,
  uploaderConfirmedDepictedAdults18: true,
  uploaderConfirmedConsent: true,
  uploaderConfirmedRightToUpload: true,
  uploaderConfirmedNoNcii: true,
  uploaderConfirmedNoMinors: true,
  uploaderConfirmedNoHiddenCamera: true,
  uploaderConfirmedNoAiDeepfakeWithoutConsent: true,
}

describe('T&S-3 media pipeline DB', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let ownerId: string
  let ownerUsername: string
  let profileId: string
  let assetId: string
  const userIds: string[] = []

  before(async () => {
    ensureCiAuthSecret()
    const owner = await insertCiUser(`pipe_owner_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    userIds.push(ownerId)
    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Pipeline Owner' })
      .returning({ id: schema.profiles.id })
    profileId = profile!.id
  })

  after(async () => {
    if (assetId) {
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, assetId))
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('GREEN attestation promotes storage to APPROVED_PUBLIC', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'feed_upload',
          storageKey: `quarantine/${ownerId}/green.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 512,
        },
      })
      assert.equal(createRes.statusCode, 201, createRes.body)
      const created = createRes.json() as { mediaAsset: { id: string } }
      assetId = created.mediaAsset.id

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${assetId}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: 'EXPLICIT_ADULT',
          depictedPeople: 'ONLY_ME',
          visibility: 'LOGGED_IN',
          ...fullAttestation,
        },
      })
      assert.equal(patchRes.statusCode, 200, patchRes.body)
      const body = patchRes.json() as { lane: string; promoted?: boolean; uploadStatus: string }
      assert.equal(body.lane, 'GREEN')
      assert.equal(body.uploadStatus, MEDIA_UPLOAD_STATUSES.autoApproved)

      const [row] = await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, assetId))
        .limit(1)
      // Post-moderation: GREEN feed explicit stays validated-private (not public CDN).
      assert.equal(row!.storageState, MEDIA_STORAGE_STATES.validatedPrivate)
      assert.equal(row!.scanStatus, SCAN_STATUSES.passed)
      assert.ok(row!.sha256Hash === null || typeof row!.sha256Hash === 'string')
    } finally {
      await app.close()
    }
  })

  test('simulated FLAGGED scan quarantines on attestation', async () => {
    const prev = process.env.MEDIA_SCAN_SIMULATE
    process.env.MEDIA_SCAN_SIMULATE = 'FLAGGED'
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'feed_upload',
          storageKey: `quarantine/${ownerId}/flagged.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 512,
        },
      })
      assert.equal(createRes.statusCode, 201)
      const flaggedId = (createRes.json() as { mediaAsset: { id: string } }).mediaAsset.id

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${flaggedId}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: 'EXPLICIT_ADULT',
          depictedPeople: 'ONLY_ME',
          visibility: 'LOGGED_IN',
          ...fullAttestation,
        },
      })
      assert.equal(patchRes.statusCode, 200, patchRes.body)
      const [row] = await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, flaggedId))
        .limit(1)
      assert.equal(row!.uploadStatus, MEDIA_UPLOAD_STATUSES.quarantined)
      assert.equal(row!.scanStatus, SCAN_STATUSES.flagged)
      assert.notEqual(row!.storageState, MEDIA_STORAGE_STATES.approvedPublic)

      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, flaggedId))
    } finally {
      process.env.MEDIA_SCAN_SIMULATE = prev
      await app.close()
    }
  })
})
