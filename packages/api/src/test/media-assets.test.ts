/**
 * T&S-2 media assets API - DB-backed integration tests.
 * Requires USE_DATABASE=true and media_assets table.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  MODERATION_QUEUES,
} from '@c2k/shared'
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

describe('T&S-2 media assets API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const assetIds: string[] = []
  const caseIds: string[] = []
  let ownerId: string
  let ownerUsername: string
  let otherId: string
  let otherUsername: string
  let profileId: string
  let publishedExplicitAssetId = ''

  after(async () => {
    for (const assetId of assetIds) {
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, assetId))
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const caseId of caseIds) {
      await db.delete(schema.moderationEvents).where(eq(schema.moderationEvents.caseId, caseId))
      await db.delete(schema.moderationQueueItems).where(eq(schema.moderationQueueItems.caseId, caseId))
      await db.delete(schema.moderationCases).where(eq(schema.moderationCases.id, caseId))
    }
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('setup users and profile', async () => {
    const owner = await insertCiUser(`media_owner_${tag}`)
    const other = await insertCiUser(`media_other_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    otherId = other.id
    otherUsername = other.username
    userIds.push(owner.id, other.id)

    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Media Owner' })
      .returning({ id: schema.profiles.id })
    profileId = profile.id
  })

  test('POST /api/v1/media/assets requires auth', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'profile_photo',
          storageKey: `quarantine/${ownerId}/test.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      assert.equal(res.statusCode, 401)
    } finally {
      await app.close()
    }
  })

  test('POST rejects external url without storageKey', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'profile_photo',
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
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'profile_photo',
          storageKey: `quarantine/${otherId}/${tag}-stolen.jpg`,
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

  test('POST rejects attaching media to another users profile', async () => {
    ensureCiAuthSecret()
    const [otherProfile] = await db
      .insert(schema.profiles)
      .values({ userId: otherId, displayName: 'Other Profile' })
      .returning({ id: schema.profiles.id })

    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: otherProfile!.id,
          sourceSurface: 'profile_photo',
          storageKey: `quarantine/${ownerId}/${tag}-cross-profile.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      assert.equal(res.statusCode, 403)
      const body = res.json() as { code?: string }
      assert.equal(body.code, 'profile_owner_mismatch')
    } finally {
      await app.close()
    }
  })

  test('POST creates pending attestation asset without client ownerId', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          sourceSurface: 'profile_photo',
          storageKey: `quarantine/${ownerId}/${tag}-no-owner-id.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
        },
      })
      assert.equal(res.statusCode, 201, res.body)
      const body = res.json() as { asset: { id: string } }
      assetIds.push(body.asset.id)
      const [row] = await db
        .select({ ownerId: schema.mediaAssets.ownerId })
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, body.asset.id))
        .limit(1)
      assert.equal(row?.ownerId, profileId)
    } finally {
      await app.close()
    }
  })

  test('POST creates pending attestation asset', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/assets',
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'feed_upload',
          storageKey: `quarantine/${ownerId}/${tag}-solo.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          originalFilename: 'solo.jpg',
        },
      })
      assert.equal(res.statusCode, 201, res.body)
      const body = res.json() as { asset: { id: string; uploadStatus: string; pendingAttestation: boolean } }
      assert.ok(body.asset.id)
      assert.equal(body.asset.uploadStatus, MEDIA_UPLOAD_STATUSES.pendingAttestation)
      assert.equal(body.asset.pendingAttestation, true)
      assetIds.push(body.asset.id)
    } finally {
      await app.close()
    }
  })

  test('PATCH attestation GREEN publishes solo explicit', async () => {
    process.env.MEDIA_POLICY_MODE = 'attested_explicit_beta'
    ensureCiAuthSecret()
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
          storageKey: `quarantine/${ownerId}/${tag}-green-explicit.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
        },
      })
      assert.equal(createRes.statusCode, 201, createRes.body)
      const created = createRes.json() as { asset: { id: string } }
      const assetId = created.asset.id
      assetIds.push(assetId)
      publishedExplicitAssetId = assetId

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${assetId}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
          visibility: MEDIA_VISIBILITIES.loggedIn,
          depictedPeople: DEPICTED_PEOPLE.onlyMe,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as {
        lane: string
        uploadStatus: string
        asset: { uploadStatus: string; blurred: boolean; canView: boolean; url: string | null }
      }
      assert.equal(body.lane, 'GREEN')
      assert.equal(body.uploadStatus, MEDIA_UPLOAD_STATUSES.autoApproved)
      assert.equal(body.asset.uploadStatus, MEDIA_UPLOAD_STATUSES.autoApproved)
      assert.equal(body.asset.canView, true)
      assert.equal(body.asset.blurred, false)
      assert.ok(body.asset.url)

      const events = await db
        .select()
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.eventType, 'media.attestation_submitted'))
      assert.ok(
        events.some((e) => (e.payload as { mediaAssetId?: string }).mediaAssetId === assetId)
      )
    } finally {
      await app.close()
    }
  })

  test('GET logged-out blurs explicit published asset', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/assets/${publishedExplicitAssetId}`,
      })
      assert.equal(res.statusCode, 404, res.body)
    } finally {
      await app.close()
    }
  })

  test('GET owner sees published asset', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/assets/${publishedExplicitAssetId}`,
        headers: cookieHeader(ownerId, ownerUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { asset: { canView: boolean; url: string | null } }
      assert.equal(body.asset.canView, true)
      assert.ok(body.asset.url)
    } finally {
      await app.close()
    }
  })

  test('community_only blocks explicit attestation via API', async () => {
    ensureCiAuthSecret()
    const prevPolicy = process.env.MEDIA_POLICY_MODE
    process.env.MEDIA_POLICY_MODE = 'community_only'
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
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
          storageKey: `quarantine/${ownerId}/${tag}-blocked-explicit.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'profile_gallery',
        },
      })
      assert.equal(createRes.statusCode, 201)
      const created = createRes.json() as { asset: { id: string } }
      assetIds.push(created.asset.id)

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${created.asset.id}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
          visibility: MEDIA_VISIBILITIES.loggedIn,
          depictedPeople: DEPICTED_PEOPLE.onlyMe,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 403, res.body)
      const body = res.json() as { code?: string; error?: string }
      assert.equal(body.code, 'media_policy_blocked')
      assert.match(body.error ?? '', /not supported on this platform/i)
    } finally {
      if (prevPolicy === undefined) delete process.env.MEDIA_POLICY_MODE
      else process.env.MEDIA_POLICY_MODE = prevPolicy
      process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
      await app.close()
    }
  })

  test('multi-person explicit attestation queues review', async () => {
    ensureCiAuthSecret()
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
          storageKey: `quarantine/${ownerId}/${tag}-multi.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
        },
      })
      assert.equal(createRes.statusCode, 201, createRes.body)
      const created = createRes.json() as { asset: { id: string } }
      assetIds.push(created.asset.id)

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${created.asset.id}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
          visibility: MEDIA_VISIBILITIES.loggedIn,
          depictedPeople: DEPICTED_PEOPLE.meAndOtherAdults,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as {
        lane: string
        uploadStatus: string
        moderationCaseId: string | null
      }
      assert.equal(body.lane, 'YELLOW')
      assert.equal(body.uploadStatus, MEDIA_UPLOAD_STATUSES.quarantined)
      assert.ok(body.moderationCaseId)
      caseIds.push(body.moderationCaseId!)

      const [caseRow] = await db
        .select()
        .from(schema.moderationCases)
        .where(eq(schema.moderationCases.id, body.moderationCaseId!))
        .limit(1)
      assert.ok(caseRow)
      assert.equal(caseRow.targetContentType, 'media_asset')
      assert.equal(caseRow.queue, MODERATION_QUEUES.mediaReview)
    } finally {
      await app.close()
    }
  })

  test('PATCH attestation rejects non-owner', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${assetIds[0]}/attestation`,
        headers: cookieHeader(otherId, otherUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.safePublic,
          visibility: MEDIA_VISIBILITIES.publicPreview,
          depictedPeople: DEPICTED_PEOPLE.noIdentifiablePerson,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 403)
    } finally {
      await app.close()
    }
  })

  test('EXPLICIT_ADULT + PUBLIC_PREVIEW coerced to logged-in at attestation', async () => {
    ensureCiAuthSecret()
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
          storageKey: `quarantine/${ownerId}/${tag}-bad-vis.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 512,
        },
      })
      const created = createRes.json() as { asset: { id: string } }
      assetIds.push(created.asset.id)

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${created.asset.id}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
          visibility: MEDIA_VISIBILITIES.publicPreview,
          depictedPeople: DEPICTED_PEOPLE.onlyMe,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { asset: { visibility: string } }
      assert.equal(body.asset.visibility, MEDIA_VISIBILITIES.loggedIn)
    } finally {
      await app.close()
    }
  })

  test('explicit attestation blocked when ALLOW_EXPLICIT_MEDIA is false', async () => {
    const prevExplicit = process.env.C2K_ALLOW_EXPLICIT_MEDIA
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'false'
    ensureCiAuthSecret()
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
          storageKey: `quarantine/${ownerId}/${tag}-policy-block.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 512,
        },
      })
      const created = createRes.json() as { asset: { id: string } }
      assetIds.push(created.asset.id)

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${created.asset.id}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
          visibility: MEDIA_VISIBILITIES.loggedIn,
          depictedPeople: DEPICTED_PEOPLE.onlyMe,
          ...fullAttestation,
        },
      })
      assert.equal(res.statusCode, 403, res.body)
      const body = res.json() as { error?: string; code?: string }
      assert.match(body.error ?? '', /not supported on this platform/i)
      assert.equal(body.code, 'media_policy_blocked')
    } finally {
      if (prevExplicit === undefined) delete process.env.C2K_ALLOW_EXPLICIT_MEDIA
      else process.env.C2K_ALLOW_EXPLICIT_MEDIA = prevExplicit
      await app.close()
    }
  })
})
