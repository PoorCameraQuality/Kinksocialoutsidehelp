/**
 * MEDIA-MOD-MINIMUM - DB-backed integration tests.
 * Requires USE_DATABASE=true.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import {
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  SCANNER_NAMES,
  SCANNER_RESULT_STATUSES,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { streamMediaAssetForModerator } from '../lib/media-asset-viewer.js'
import {
  assetHasMalwareBlock,
  removeMediaAssetByModerator,
} from '../lib/media-mod-actions.js'
import {
  MODERATION_CASE_EVENT_TYPES,
  executeModerationCaseAction,
  getCaseMediaModerationMeta,
} from '../lib/moderation-ts-admin.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'

describe('MEDIA-MOD-MINIMUM', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const assetIds: string[] = []
  const caseIds: string[] = []
  const scannerResultIds: string[] = []

  let modId: string
  let modUsername: string
  let uploaderId: string
  let profileId: string
  let quarantinedAssetId: string
  let malwareAssetId: string
  let mediaCaseId: string
  let malwareCaseId: string

  after(async () => {
    for (const caseId of caseIds) {
      await db.delete(schema.moderationEvents).where(eq(schema.moderationEvents.caseId, caseId))
      await db.delete(schema.contentSnapshots).where(eq(schema.contentSnapshots.caseId, caseId))
      await db.delete(schema.moderationReports).where(eq(schema.moderationReports.caseId, caseId))
      await db.delete(schema.moderationQueueItems).where(eq(schema.moderationQueueItems.caseId, caseId))
      await db.delete(schema.moderationCases).where(eq(schema.moderationCases.id, caseId))
    }
    for (const resultId of scannerResultIds) {
      await db.delete(schema.mediaScannerResults).where(eq(schema.mediaScannerResults.id, resultId))
    }
    for (const assetId of assetIds) {
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, assetId))
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const userId of userIds) {
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    invalidatePlatformStaffCache()
  })

  test('seed moderator, uploader, and quarantined assets', async () => {
    const mod = await insertCiUser(`media_mod_${tag}`)
    const uploader = await insertCiUser(`media_uploader_${tag}`)
    modId = mod.id
    modUsername = mod.username
    uploaderId = uploader.id
    userIds.push(mod.id, uploader.id)

    await db.insert(schema.platformStaff).values({ userId: modId, role: 'MODERATOR' })
    invalidatePlatformStaffCache()

    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: uploaderId, displayName: 'Media Mod Test' })
      .returning({ id: schema.profiles.id })
    profileId = profile.id

    const quarantineKey = `quarantine/${uploaderId}/${tag}-clean.jpg`

    const [cleanAsset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: uploaderId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'profile_photo',
        storageKey: quarantineKey,
        quarantineStorageKey: quarantineKey,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
        contentRating: 'EXPLICIT_ADULT',
        visibility: 'LOGGED_IN',
        depictedPeople: 'ONLY_ME',
      })
      .returning({ id: schema.mediaAssets.id })
    quarantinedAssetId = cleanAsset.id
    assetIds.push(quarantinedAssetId)

    const malwareKey = `quarantine/${uploaderId}/${tag}-malware.jpg`
    const [badAsset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: uploaderId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'profile_photo',
        storageKey: malwareKey,
        quarantineStorageKey: malwareKey,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
      })
      .returning({ id: schema.mediaAssets.id })
    malwareAssetId = badAsset.id
    assetIds.push(malwareAssetId)

    const [scannerRow] = await db
      .insert(schema.mediaScannerResults)
      .values({
        mediaAssetId: malwareAssetId,
        scannerName: SCANNER_NAMES.malwareClamav,
        scannerVersion: '1.0.0',
        status: SCANNER_RESULT_STATUSES.blocked,
        userFacingSummary: 'Malware detected',
      })
      .returning({ id: schema.mediaScannerResults.id })
    scannerResultIds.push(scannerRow.id)

    const [mediaCase] = await db
      .insert(schema.moderationCases)
      .values({
        targetContentType: 'media_asset',
        targetContentId: quarantinedAssetId,
        targetUserId: uploaderId,
        policyReason: POLICY_REASONS.explicitVisibilityViolation,
        severity: POLICY_SEVERITIES.low,
        queue: MODERATION_QUEUES.mediaReview,
        status: MODERATION_CASE_STATUSES.open,
      })
      .returning({ id: schema.moderationCases.id })
    mediaCaseId = mediaCase.id
    caseIds.push(mediaCaseId)

    await db.insert(schema.moderationQueueItems).values({
      caseId: mediaCaseId,
      queue: MODERATION_QUEUES.mediaReview,
      severity: POLICY_SEVERITIES.low,
      status: 'OPEN',
    })

    const [malwareCase] = await db
      .insert(schema.moderationCases)
      .values({
        targetContentType: 'media_asset',
        targetContentId: malwareAssetId,
        targetUserId: uploaderId,
        policyReason: POLICY_REASONS.other,
        severity: POLICY_SEVERITIES.high,
        queue: MODERATION_QUEUES.mediaReview,
        status: MODERATION_CASE_STATUSES.open,
      })
      .returning({ id: schema.moderationCases.id })
    malwareCaseId = malwareCase.id
    caseIds.push(malwareCaseId)
  })

  test('assetHasMalwareBlock detects clamav BLOCKED', async () => {
    assert.equal(await assetHasMalwareBlock(malwareAssetId), true)
    assert.equal(await assetHasMalwareBlock(quarantinedAssetId), false)
  })

  test('remove_media sets REMOVED and unlinks profile photos', async () => {
    const [photo] = await db
      .insert(schema.profilePhotos)
      .values({
        profileId,
        mediaAssetId: quarantinedAssetId,
        url: 'https://example.test/photo.jpg',
      })
      .returning({ id: schema.profilePhotos.id })

    const result = await executeModerationCaseAction(
      modId,
      mediaCaseId,
      'remove_media',
      'Policy violation. Test fixture'
    )
    assert.equal(result.ok, true)

    const [asset] = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, quarantinedAssetId))
      .limit(1)
    assert.equal(asset?.uploadStatus, MEDIA_UPLOAD_STATUSES.removed)
    assert.equal(asset?.storageState, MEDIA_STORAGE_STATES.removedPrivate)
    assert.ok(asset?.removedAt)
    assert.equal(asset?.removedByUserId, modId)

    const photos = await db
      .select()
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.mediaAssetId, quarantinedAssetId))
    assert.equal(photos.length, 0)

    const events = await db
      .select()
      .from(schema.moderationEvents)
      .where(eq(schema.moderationEvents.caseId, mediaCaseId))
    assert.ok(events.some((e) => e.eventType === MODERATION_CASE_EVENT_TYPES.mediaRemoved))

    const queueItems = await db
      .select()
      .from(schema.moderationQueueItems)
      .where(eq(schema.moderationQueueItems.caseId, mediaCaseId))
    assert.equal(queueItems.length, 1)
    assert.equal(queueItems[0]?.status, 'CLOSED')

    const [updatedCase] = await db
      .select()
      .from(schema.moderationCases)
      .where(eq(schema.moderationCases.id, mediaCaseId))
      .limit(1)
    assert.equal(updatedCase?.status, MODERATION_CASE_STATUSES.actioned)

    await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.id, photo.id))
  })

  test('streamMediaAssetForModerator returns null when malware blocked', async () => {
    const streamed = await streamMediaAssetForModerator(malwareAssetId)
    assert.equal(streamed, null)
  })

  test('getCaseMediaModerationMeta reflects canViewBytes for clean quarantined asset', async () => {
    const [caseRow] = await db
      .select()
      .from(schema.moderationCases)
      .where(eq(schema.moderationCases.id, mediaCaseId))
      .limit(1)

    const meta = await getCaseMediaModerationMeta(caseRow!)
    assert.ok(meta)
    assert.equal(meta.malwareBlocked, false)
    assert.equal(meta.uploadStatus, MEDIA_UPLOAD_STATUSES.removed)
    assert.equal(meta.canViewBytes, false)
  })

  test('GET media-content returns 403 malware_blocked for infected asset', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsAdminRoutes } = await import('../routes/moderation-ts-admin.js')
      await registerModerationTsAdminRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/moderation/cases/${malwareCaseId}/media-content`,
        headers: cookieHeader(modId, modUsername),
      })
      assert.equal(res.statusCode, 403, res.body)
      const body = res.json() as { code?: string }
      assert.equal(body.code, 'malware_blocked')
    } finally {
      await app.close()
    }
  })

  test('removeMediaAssetByModerator direct call', async () => {
    const restoreKey = `quarantine/${uploaderId}/${tag}-direct-remove.jpg`
    const [asset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: uploaderId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'profile_gallery',
        storageKey: restoreKey,
        quarantineStorageKey: restoreKey,
        storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: 512,
        uploadStatus: MEDIA_UPLOAD_STATUSES.quarantined,
      })
      .returning({ id: schema.mediaAssets.id })
    assetIds.push(asset.id)

    await removeMediaAssetByModerator(modId, asset.id, 'direct test')

    const [row] = await db
      .select({ uploadStatus: schema.mediaAssets.uploadStatus })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, asset.id))
      .limit(1)
    assert.equal(row?.uploadStatus, MEDIA_UPLOAD_STATUSES.removed)
  })
})
