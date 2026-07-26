/**
 * T&S-4A scanner pipeline - DB integration (result storage + lane influence).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import {
  MEDIA_HASH_KINDS,
  MEDIA_HASH_LIST_ACTIONS,
  MEDIA_HASH_LIST_SOURCES,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  SCANNER_NAMES,
  SCAN_STATUSES,
} from '@c2k/shared'
import { MEDIA_MODERATION_REASON_CODES } from '../lib/media-moderation-decision.js'
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

describe('T&S-4A scanner pipeline DB', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let ownerId: string
  let ownerUsername: string
  let profileId: string
  let assetId: string
  let denyHash: string
  const userIds: string[] = []
  const hashEntryIds: string[] = []

  before(async () => {
    ensureCiAuthSecret()
    const owner = await insertCiUser(`scan_owner_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    userIds.push(ownerId)
    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Scanner Owner' })
      .returning({ id: schema.profiles.id })
    profileId = profile!.id
    denyHash = randomUUID().replace(/-/g, '')
  })

  after(async () => {
    if (assetId) {
      await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.mediaAssetId, assetId))
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, assetId))
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const id of hashEntryIds) {
      await db.delete(schema.mediaHashListEntries).where(eq(schema.mediaHashListEntries.id, id))
    }
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function createAsset(sha256?: string, sourceSurface: 'profile_gallery' | 'feed_upload' = 'feed_upload') {
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
          sourceSurface,
          storageKey: `quarantine/${ownerId}/scan-${randomUUID().slice(0, 8)}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      assert.equal(createRes.statusCode, 201, createRes.body)
      const created = createRes.json() as { mediaAsset: { id: string } }
      const id = created.mediaAsset.id
      if (sha256) {
        await db
          .update(schema.mediaAssets)
          .set({ sha256Hash: sha256 })
          .where(eq(schema.mediaAssets.id, id))
      }
      return id
    } finally {
      await app.close()
    }
  }

  async function attestAsset(
    id: string,
    extraEnv?: Record<string, string>,
    payload?: Record<string, unknown>,
  ) {
    const saved: Record<string, string | undefined> = {}
    if (extraEnv) {
      for (const [k, v] of Object.entries(extraEnv)) {
        saved[k] = process.env[k]
        process.env[k] = v
      }
    }
    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/assets/${id}/attestation`,
        headers: cookieHeader(ownerId, ownerUsername),
        payload: {
          contentRating: 'EXPLICIT_ADULT',
          depictedPeople: 'ONLY_ME',
          visibility: 'LOGGED_IN',
          ...fullAttestation,
          ...payload,
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      return res.json() as {
        uploadStatus: string
        promoted?: boolean
        moderationDecision?: { reasonCode: string; blockedFromMemberSurfaces: boolean }
      }
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      await app.close()
    }
  }

  test('SAFE_PUBLIC profile gallery auto-approves after scan (post-moderation)', async () => {
    const id = await createAsset(undefined, 'profile_gallery')
    const body = await attestAsset(id, undefined, {
      contentRating: 'SAFE_PUBLIC',
      depictedPeople: 'ONLY_ME',
      visibility: 'LOGGED_IN',
    })

    assert.equal(body.uploadStatus, MEDIA_UPLOAD_STATUSES.autoApproved)
    assert.equal(body.moderationDecision?.reasonCode, MEDIA_MODERATION_REASON_CODES.alphaValidatedPrivate)
    assert.equal(body.moderationDecision?.blockedFromMemberSurfaces, false)

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id))
    assert.equal(asset!.scanStatus, SCAN_STATUSES.passed)
    assert.equal(asset!.uploadStatus, MEDIA_UPLOAD_STATUSES.autoApproved)
    assert.equal(asset!.storageState, MEDIA_STORAGE_STATES.validatedPrivate)
    assert.notEqual(asset!.uploadStatus, MEDIA_UPLOAD_STATUSES.quarantined)
    assert.notEqual(asset!.uploadStatus, MEDIA_UPLOAD_STATUSES.pendingScan)

    await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.mediaAssetId, id))
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  })

  test('GREEN attestation stores scanner results and promotes', async () => {
    assetId = await createAsset()
    await attestAsset(assetId)

    const results = await db
      .select()
      .from(schema.mediaScannerResults)
      .where(eq(schema.mediaScannerResults.mediaAssetId, assetId))
    assert.ok(results.length >= 4, 'expected at least 4 scanner result rows')
    assert.ok(results.some((r) => r.scannerName === SCANNER_NAMES.malwareClamav))

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, assetId))
    assert.equal(asset!.scanStatus, SCAN_STATUSES.passed)
    // Post-moderation: GREEN feed explicit stays validated-private (not public CDN).
    assert.equal(asset!.storageState, MEDIA_STORAGE_STATES.validatedPrivate)
  })

  test('simulated malware blocks publish', async () => {
    const id = await createAsset()
    await attestAsset(id, { MEDIA_SCAN_SIMULATE_MALWARE: 'BLOCKED' })

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id))
    assert.equal(asset!.scanStatus, SCAN_STATUSES.failed)
    assert.notEqual(asset!.storageState, MEDIA_STORAGE_STATES.approvedPublic)
    assert.equal(asset!.uploadStatus, MEDIA_UPLOAD_STATUSES.quarantined)

    await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.mediaAssetId, id))
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  })

  test('hash denylist blocks publish', async () => {
    const [entry] = await db
      .insert(schema.mediaHashListEntries)
      .values({
        hashKind: MEDIA_HASH_KINDS.sha256,
        hashValue: denyHash,
        listAction: MEDIA_HASH_LIST_ACTIONS.deny,
        policyReason: POLICY_REASONS.ncii,
        source: MEDIA_HASH_LIST_SOURCES.internal,
      })
      .returning()
    hashEntryIds.push(entry!.id)

    const id = await createAsset(denyHash)
    await attestAsset(id)

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id))
    assert.equal(asset!.scanStatus, SCAN_STATUSES.failed)
    assert.notEqual(asset!.storageState, MEDIA_STORAGE_STATES.approvedPublic)

    await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.mediaAssetId, id))
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  })

  test('scanner ERROR does not publish', async () => {
    const id = await createAsset()
    await attestAsset(id, { MEDIA_SCAN_SIMULATE: 'ERROR' })

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, id))
    assert.equal(asset!.scanStatus, SCAN_STATUSES.error)
    assert.equal(asset!.uploadStatus, MEDIA_UPLOAD_STATUSES.pendingScan)
    assert.notEqual(asset!.storageState, MEDIA_STORAGE_STATES.approvedPublic)

    await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.mediaAssetId, id))
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))
  })
})
