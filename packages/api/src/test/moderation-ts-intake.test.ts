/**
 * T&S-1 report intake - DB-backed integration tests.
 * Requires USE_DATABASE=true and moderation_cases / moderation_reports / moderation_events tables.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { MODERATION_QUEUES, POLICY_REASONS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { ensureProfileForUserId } from '../lib/ensure-profile.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('T&S-1 moderation report intake', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const caseIds: string[] = []
  const mediaAssetIds: string[] = []
  let targetUserId: string
  let reporterId: string
  let reporterUsername: string
  let targetProfileId: string
  let mediaAssetId: string

  after(async () => {
    for (const caseId of caseIds) {
      await db
        .update(schema.mediaAssets)
        .set({ moderationCaseId: null })
        .where(eq(schema.mediaAssets.moderationCaseId, caseId))
      await db.delete(schema.moderationEvents).where(eq(schema.moderationEvents.caseId, caseId))
      await db.delete(schema.contentSnapshots).where(eq(schema.contentSnapshots.caseId, caseId))
      await db.delete(schema.moderationQueueItems).where(eq(schema.moderationQueueItems.caseId, caseId))
      await db.delete(schema.moderationReports).where(eq(schema.moderationReports.caseId, caseId))
      await db.delete(schema.moderationCases).where(eq(schema.moderationCases.id, caseId))
    }
    for (const assetId of mediaAssetIds) {
      await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.mediaAssetId, assetId))
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId))
    }
    for (const userId of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('setup users', async () => {
    const target = await insertCiUser(`ts_target_${tag}`)
    const reporter = await insertCiUser(`ts_reporter_${tag}`)
    targetUserId = target.id
    reporterId = reporter.id
    reporterUsername = reporter.username
    userIds.push(target.id, reporter.id)
  })

  test('POST /api/v1/moderation/reports returns 401 without auth', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsReportsRoutes } = await import('../routes/moderation-ts-reports.js')
      await registerModerationTsReportsRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        payload: {
          targetType: 'profile',
          targetId: targetUserId,
          policyReason: POLICY_REASONS.spamScam,
        },
      })
      assert.equal(res.statusCode, 401)
    } finally {
      await app.close()
    }
  })

  test('auth creates case, report, queue assignment, and moderation event', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsReportsRoutes } = await import('../routes/moderation-ts-reports.js')
      await registerModerationTsReportsRoutes(a)
    })

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        headers: cookieHeader(reporterId, reporterUsername),
        payload: {
          targetType: 'profile',
          targetId: targetUserId,
          policyReason: POLICY_REASONS.csamSuspected,
          note: 'integration smoke',
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as {
        caseId: string
        reportId: string
        queue: string
        duplicate: boolean
      }
      assert.ok(body.caseId)
      assert.ok(body.reportId)
      assert.equal(body.queue, MODERATION_QUEUES.minorSafetyRestricted)
      assert.equal(body.duplicate, false)
      caseIds.push(body.caseId)

      const [caseRow] = await db
        .select()
        .from(schema.moderationCases)
        .where(eq(schema.moderationCases.id, body.caseId))
        .limit(1)
      assert.ok(caseRow)
      assert.equal(caseRow.targetContentType, 'profile')
      assert.equal(caseRow.targetContentId, targetUserId)
      assert.equal(caseRow.queue, MODERATION_QUEUES.minorSafetyRestricted)

      const [reportRow] = await db
        .select()
        .from(schema.moderationReports)
        .where(eq(schema.moderationReports.id, body.reportId))
        .limit(1)
      assert.ok(reportRow)
      assert.equal(reportRow.reporterId, reporterId)

      const queueItems = await db
        .select()
        .from(schema.moderationQueueItems)
        .where(eq(schema.moderationQueueItems.caseId, body.caseId))
      assert.ok(queueItems.length >= 1)
      assert.equal(queueItems[0]!.queue, MODERATION_QUEUES.minorSafetyRestricted)

      const events = await db
        .select()
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.caseId, body.caseId))
      assert.ok(events.some((e) => e.eventType === 'report.created'))
    } finally {
      await app.close()
    }
  })

  test('duplicate within 24h returns same case', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsReportsRoutes } = await import('../routes/moderation-ts-reports.js')
      await registerModerationTsReportsRoutes(a)
    })

    try {
      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        headers: cookieHeader(reporterId, reporterUsername),
        payload: {
          targetType: 'profile',
          targetId: targetUserId,
          policyReason: POLICY_REASONS.harassmentThreats,
        },
      })
      assert.equal(first.statusCode, 200)
      const firstBody = first.json() as { caseId: string; reportId: string; duplicate: boolean }
      assert.equal(firstBody.duplicate, false)
      caseIds.push(firstBody.caseId)

      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        headers: cookieHeader(reporterId, reporterUsername),
        payload: {
          targetType: 'profile',
          targetId: targetUserId,
          policyReason: POLICY_REASONS.harassmentThreats,
        },
      })
      assert.equal(second.statusCode, 200)
      const secondBody = second.json() as { caseId: string; reportId: string; duplicate: boolean }
      assert.equal(secondBody.duplicate, true)
      assert.equal(secondBody.caseId, firstBody.caseId)
      assert.equal(secondBody.reportId, firstBody.reportId)
    } finally {
      await app.close()
    }
  })

  test('setup profile and media asset for gallery report', async () => {
    const profile = await ensureProfileForUserId(targetUserId)
    targetProfileId = profile.id

    const assetId = randomUUID()
    await db.insert(schema.mediaAssets).values({
      id: assetId,
      uploaderUserId: targetUserId,
      ownerType: 'profile',
      ownerId: targetProfileId,
      sourceSurface: 'profile_photo',
      storageKey: `ci/${tag}/gallery-test.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      uploadStatus: 'AUTO_APPROVED',
      contentRating: 'ADULT_NON_EXPLICIT',
      visibility: 'LOGGED_IN',
      depictedPeople: 'ONLY_ME',
      uploaderConfirmed18: true,
      uploaderConfirmedDepictedAdults18: true,
      uploaderConfirmedConsent: true,
      uploaderConfirmedRightToUpload: true,
      uploaderConfirmedNoNcii: true,
      uploaderConfirmedNoMinors: true,
      uploaderConfirmedNoHiddenCamera: true,
      uploaderConfirmedNoAiDeepfakeWithoutConsent: true,
      attestedAt: new Date(),
      attestationVersion: 1,
    })
    mediaAssetId = assetId
    mediaAssetIds.push(assetId)

    await db.insert(schema.profilePhotos).values({
      profileId: targetProfileId,
      mediaAssetId: assetId,
      url: `https://example.test/ci/${tag}/gallery-test.jpg`,
      caption: 'CI gallery photo',
      sortOrder: 0,
    })
  })

  test('POST media_asset report captures metadata snapshot and links case', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsReportsRoutes } = await import('../routes/moderation-ts-reports.js')
      await registerModerationTsReportsRoutes(a)
    })

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        headers: cookieHeader(reporterId, reporterUsername),
        payload: {
          targetType: 'media_asset',
          targetId: mediaAssetId,
          policyReason: POLICY_REASONS.explicitVisibilityViolation,
          note: 'mislabeled explicit',
        },
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { caseId: string; reportId: string; duplicate: boolean }
      assert.equal(body.duplicate, false)
      caseIds.push(body.caseId)

      const [caseRow] = await db
        .select()
        .from(schema.moderationCases)
        .where(eq(schema.moderationCases.id, body.caseId))
        .limit(1)
      assert.ok(caseRow)
      assert.equal(caseRow.targetContentType, 'media_asset')
      assert.equal(caseRow.targetContentId, mediaAssetId)
      assert.equal(caseRow.targetUserId, targetUserId)

      const [assetRow] = await db
        .select({ moderationCaseId: schema.mediaAssets.moderationCaseId })
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, mediaAssetId))
        .limit(1)
      assert.equal(assetRow?.moderationCaseId, body.caseId)

      const [snapRow] = await db
        .select({ snapshot: schema.contentSnapshots.snapshot })
        .from(schema.contentSnapshots)
        .where(eq(schema.contentSnapshots.caseId, body.caseId))
        .limit(1)
      assert.ok(snapRow)
      const snapshot = snapRow.snapshot as Record<string, unknown>
      assert.equal(snapshot.targetType, 'media_asset')
      assert.equal(snapshot.targetId, mediaAssetId)
      const meta = snapshot.mediaMetadata as Record<string, unknown>
      assert.ok(meta)
      assert.equal(meta.mimeType, 'image/jpeg')
      assert.equal(meta.sizeBytes, 2048)
      assert.equal(meta.uploadStatus, 'AUTO_APPROVED')
      assert.equal(meta.sourceSurface, 'profile_photo')
      assert.ok(meta.linkedProfilePhotoId)
      assert.equal('storageKey' in meta, false)
      assert.equal('storage_key' in meta, false)
    } finally {
      await app.close()
    }
  })

  test('invalid target returns 400', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerModerationTsReportsRoutes } = await import('../routes/moderation-ts-reports.js')
      await registerModerationTsReportsRoutes(a)
    })

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/moderation/reports',
        headers: cookieHeader(reporterId, reporterUsername),
        payload: {
          targetType: 'profile',
          targetId: randomUUID(),
          policyReason: POLICY_REASONS.spamScam,
        },
      })
      assert.equal(res.statusCode, 400)
      const body = res.json() as { error?: string }
      assert.match(body.error ?? '', /not found/i)
    } finally {
      await app.close()
    }
  })

  describe('target-type intake matrix + event discussion scope', () => {
    const orgId = randomUUID()
    const groupId = randomUUID()
    const eventId = randomUUID()
    const eventThreadId = randomUUID()
    const eventPostId = randomUUID()
    const convId = randomUUID()
    const vendorId = randomUUID()
    const feedPostId = randomUUID()
    const feedCommentId = randomUUID()
    const legacyReportIds: string[] = []

    after(async () => {
      for (const id of legacyReportIds) {
        await db.delete(schema.reports).where(eq(schema.reports.id, id))
      }
      await db.delete(schema.reports).where(eq(schema.reports.scopeId, orgId))
      await db.delete(schema.reports).where(eq(schema.reports.scopeId, eventId))
      await db.delete(schema.feedPostComments).where(eq(schema.feedPostComments.id, feedCommentId))
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.id, feedPostId))
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.id, eventPostId))
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.id, eventThreadId))
      await db.delete(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendorId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
      await db.delete(schema.events).where(eq(schema.events.id, eventId))
      await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('createReport accepts group, vendor, convention, comment fixtures', async () => {
      const { createReport } = await import('../lib/moderation-ts-intake.js')
      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ends = new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000)

      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-ts-org-${tag}`,
        displayName: 'CI T&S Org',
        ownerId: targetUserId,
      })
      await db.insert(schema.groups).values({
        id: groupId,
        slug: `ci-ts-grp-${tag}`,
        name: 'CI T&S Group',
        ownerId: targetUserId,
      })
      await db.insert(schema.events).values({
        id: eventId,
        hostId: targetUserId,
        title: 'CI T&S Event',
        startsAt: starts,
        visibility: 'public',
      })
      await db.insert(schema.conventions).values({
        id: convId,
        slug: `ci-ts-conv-${tag}`,
        name: 'CI T&S Convention',
        organizationId: orgId,
        startsAt: starts,
        endsAt: ends,
      })
      await db.insert(schema.vendorProfiles).values({
        id: vendorId,
        userId: targetUserId,
        slug: `ci-ts-vendor-${tag}`,
        displayName: 'CI T&S Vendor',
      })
      await db.insert(schema.feedPosts).values({
        id: feedPostId,
        authorId: targetUserId,
        body: 'ci feed post',
      })
      await db.insert(schema.feedPostComments).values({
        id: feedCommentId,
        postId: feedPostId,
        authorId: targetUserId,
        body: 'ci feed comment',
      })

      const cases: Array<{ targetType: string; targetId: string; expectedType: string }> = [
        { targetType: 'group', targetId: groupId, expectedType: 'group' },
        { targetType: 'vendor', targetId: vendorId, expectedType: 'vendor' },
        { targetType: 'convention', targetId: convId, expectedType: 'convention' },
        { targetType: 'comment', targetId: feedCommentId, expectedType: 'comment' },
        { targetType: 'event', targetId: eventId, expectedType: 'event' },
        { targetType: 'feed_post', targetId: feedPostId, expectedType: 'post' },
        { targetType: 'organization', targetId: orgId, expectedType: 'organization' },
        { targetType: 'platform', targetId: 'support', expectedType: 'platform' },
      ]

      for (const row of cases) {
        const result = await createReport({
          reporterId,
          targetType: row.targetType,
          targetId: row.targetId,
          policyReason: POLICY_REASONS.spamScam,
          note: `matrix ${row.targetType}`,
        })
        assert.equal(result.duplicate, false, row.targetType)
        caseIds.push(result.caseId)
        const [caseRow] = await db
          .select({
            targetContentType: schema.moderationCases.targetContentType,
            targetContentId: schema.moderationCases.targetContentId,
            targetUserId: schema.moderationCases.targetUserId,
          })
          .from(schema.moderationCases)
          .where(eq(schema.moderationCases.id, result.caseId))
          .limit(1)
        assert.equal(caseRow?.targetContentType, row.expectedType, row.targetType)
        assert.equal(caseRow?.targetContentId, row.targetId, row.targetType)
        if (row.expectedType === 'comment') {
          assert.equal(caseRow?.targetUserId, targetUserId, 'feed comment author resolved')
        }
      }
    })

    test('event discussion aliases preserve event scope in legacy mirror', async () => {
      const { createReport } = await import('../lib/moderation-ts-intake.js')
      const { resolveReportScope } = await import('../lib/moderation-report-scope.js')

      await db.insert(schema.forumThreads).values({
        id: eventThreadId,
        eventId,
        title: 'CI event discussion',
        authorId: targetUserId,
      })
      await db.insert(schema.forumPosts).values({
        id: eventPostId,
        threadId: eventThreadId,
        authorId: targetUserId,
        body: 'ci event reply',
      })

      const threadScope = await resolveReportScope('group_forum_thread', eventThreadId)
      assert.equal(threadScope.scopeType, 'event')
      assert.equal(threadScope.scopeId, eventId)

      const replyScope = await resolveReportScope('group_reply', eventPostId)
      assert.equal(replyScope.scopeType, 'event')
      assert.equal(replyScope.scopeId, eventId)

      const result = await createReport({
        reporterId,
        targetType: 'event_discussion_thread',
        targetId: eventThreadId,
        policyReason: POLICY_REASONS.spamScam,
        note: 'event discussion scope',
      })
      assert.equal(result.duplicate, false)
      caseIds.push(result.caseId)

      const [caseRow] = await db
        .select({ targetContentType: schema.moderationCases.targetContentType })
        .from(schema.moderationCases)
        .where(eq(schema.moderationCases.id, result.caseId))
        .limit(1)
      assert.equal(caseRow?.targetContentType, 'group_thread')

      const [legacy] = await db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.targetId, eventThreadId))
        .limit(1)
      assert.ok(legacy, 'legacy mirror row written for event discussion')
      assert.equal(legacy.scopeType, 'event')
      assert.equal(legacy.scopeId, eventId)
      legacyReportIds.push(legacy.id)
    })
  })
})
