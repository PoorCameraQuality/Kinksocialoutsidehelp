/**
 * T&S-1 admin moderation API - DB-backed integration tests.
 * Requires USE_DATABASE=true and T&S-1 moderation tables.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import {
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import { MODERATION_CASE_EVENT_TYPES } from '../lib/moderation-ts-admin.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('T&S-1 admin moderation API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const caseIds: string[] = []

  let regularId: string
  let regularUsername: string
  let modId: string
  let modUsername: string
  let adminId: string
  let adminUsername: string
  let generalCaseId: string
  let restrictedCaseId: string

  after(async () => {
    for (const caseId of caseIds) {
      await db.delete(schema.moderationEvents).where(eq(schema.moderationEvents.caseId, caseId))
      await db.delete(schema.contentSnapshots).where(eq(schema.contentSnapshots.caseId, caseId))
      await db.delete(schema.moderationReports).where(eq(schema.moderationReports.caseId, caseId))
      await db.delete(schema.moderationQueueItems).where(eq(schema.moderationQueueItems.caseId, caseId))
      await db.delete(schema.moderationCases).where(eq(schema.moderationCases.id, caseId))
    }
    for (const userId of userIds) {
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    invalidatePlatformStaffCache()
  })

  test('seed users, staff roles, and queue fixtures', async () => {
    const regular = await insertCiUser(`ts_admin_regular_${tag}`)
    const mod = await insertCiUser(`ts_admin_mod_${tag}`)
    const admin = await insertCiUser(`ts_admin_site_${tag}`)
    regularId = regular.id
    regularUsername = regular.username
    modId = mod.id
    modUsername = mod.username
    adminId = admin.id
    adminUsername = admin.username
    userIds.push(regular.id, mod.id, admin.id)

    await db.insert(schema.platformStaff).values({ userId: modId, role: 'MODERATOR' })
    await db.insert(schema.platformStaff).values({ userId: adminId, role: 'SITE_ADMIN' })
    invalidatePlatformStaffCache()

    const [generalCase] = await db
      .insert(schema.moderationCases)
      .values({
        targetContentType: 'profile',
        targetContentId: regularId,
        policyReason: POLICY_REASONS.spamScam,
        severity: POLICY_SEVERITIES.low,
        queue: MODERATION_QUEUES.spamAbuse,
        status: MODERATION_CASE_STATUSES.open,
      })
      .returning()
    generalCaseId = generalCase!.id
    caseIds.push(generalCaseId)

    const [restrictedCase] = await db
      .insert(schema.moderationCases)
      .values({
        targetContentType: 'profile',
        targetContentId: regularId,
        policyReason: POLICY_REASONS.csamSuspected,
        severity: POLICY_SEVERITIES.critical,
        queue: MODERATION_QUEUES.minorSafetyRestricted,
        status: MODERATION_CASE_STATUSES.open,
      })
      .returning()
    restrictedCaseId = restrictedCase!.id
    caseIds.push(restrictedCaseId)

    const queueRows = await db
      .insert(schema.moderationQueueItems)
      .values([
        {
          caseId: generalCaseId,
          queue: MODERATION_QUEUES.spamAbuse,
          severity: POLICY_SEVERITIES.low,
          status: 'OPEN',
        },
        {
          caseId: restrictedCaseId,
          queue: MODERATION_QUEUES.minorSafetyRestricted,
          severity: POLICY_SEVERITIES.critical,
          status: 'OPEN',
        },
      ])
      .returning({ id: schema.moderationQueueItems.id })
    assert.equal(queueRows.length, 2)
  })

  async function buildAdminApp() {
    ensureCiAuthSecret()
    return buildCookieApp(async (a) => {
      const { registerModerationTsAdminRoutes } = await import('../routes/moderation-ts-admin.js')
      await registerModerationTsAdminRoutes(a)
    })
  }

  test('non-mod receives 403 on dashboard', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/dashboard',
        headers: cookieHeader(regularId, regularUsername),
      })
      assert.equal(res.statusCode, 403)
    } finally {
      await app.close()
    }
  })

  test('moderator lists queues without restricted items', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/queues',
        headers: cookieHeader(modId, modUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { items: Array<{ queue: string; caseId: string }> }
      const fixtureItems = body.items.filter(
        (item) => item.caseId === generalCaseId || item.caseId === restrictedCaseId
      )
      assert.equal(fixtureItems.length, 1)
      assert.equal(fixtureItems[0]?.queue, MODERATION_QUEUES.spamAbuse)
      assert.equal(fixtureItems[0]?.caseId, generalCaseId)
    } finally {
      await app.close()
    }
  })

  test('site admin sees restricted queue items', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/queues',
        headers: cookieHeader(adminId, adminUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { items: Array<{ queue: string; caseId: string }> }
      const fixtureItems = body.items.filter(
        (item) => item.caseId === generalCaseId || item.caseId === restrictedCaseId
      )
      assert.equal(fixtureItems.length, 2)
      assert.ok(fixtureItems.some((item) => item.queue === MODERATION_QUEUES.minorSafetyRestricted))
    } finally {
      await app.close()
    }
  })

  test('site admin dashboard includes openCases and queue counts', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/dashboard',
        headers: cookieHeader(adminId, adminUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as {
        openCases: number
        openQueueItems: number
        byQueue: Record<string, number>
        minorSafetyRestrictedCount?: number
        recentCases: unknown[]
      }
      assert.equal(typeof body.openCases, 'number')
      assert.equal(typeof body.openQueueItems, 'number')
      assert.ok(body.openQueueItems >= 2)
      assert.ok((body.minorSafetyRestrictedCount ?? 0) >= 1)
      assert.ok(Array.isArray(body.recentCases))
    } finally {
      await app.close()
    }
  })

  test('moderator dashboard hides minorSafetyRestrictedCount', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/moderation/dashboard',
        headers: cookieHeader(modId, modUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
      const body = res.json() as { minorSafetyRestrictedCount?: number; canViewRestrictedQueue: boolean }
      assert.equal(body.minorSafetyRestrictedCount, undefined)
      assert.equal(body.canViewRestrictedQueue, false)
    } finally {
      await app.close()
    }
  })

  test('note creates moderation_event', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/moderation/cases/${generalCaseId}/notes`,
        headers: cookieHeader(modId, modUsername),
        payload: { body: 'Internal triage note' },
      })
      assert.equal(res.statusCode, 200, res.body)

      const events = await db
        .select()
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.caseId, generalCaseId))
      assert.ok(
        events.some((event) => event.eventType === MODERATION_CASE_EVENT_TYPES.noteAdded),
        'expected case.note_added event'
      )
    } finally {
      await app.close()
    }
  })

  test('status change creates moderation_event', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/moderation/cases/${generalCaseId}`,
        headers: cookieHeader(modId, modUsername),
        payload: { status: MODERATION_CASE_STATUSES.triaged },
      })
      assert.equal(res.statusCode, 200, res.body)

      const events = await db
        .select()
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.caseId, generalCaseId))
      assert.ok(
        events.some((event) => event.eventType === MODERATION_CASE_EVENT_TYPES.statusChanged),
        'expected case.status_changed event'
      )
    } finally {
      await app.close()
    }
  })

  test('hide_content on unsupported target returns 422 and audits unsupported', async () => {
    const app = await buildAdminApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/moderation/cases/${generalCaseId}/actions`,
        headers: cookieHeader(modId, modUsername),
        payload: { action: 'hide_content' },
      })
      assert.equal(res.statusCode, 422, res.body)
      const body = res.json() as { unsupported?: boolean }
      assert.equal(body.unsupported, true)

      const events = await db
        .select()
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.caseId, generalCaseId))
      assert.ok(
        events.some((event) => event.eventType === MODERATION_CASE_EVENT_TYPES.actionUnsupported),
        'expected case.action_unsupported event'
      )
    } finally {
      await app.close()
    }
  })
})
