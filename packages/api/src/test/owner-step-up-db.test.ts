/**
 * DB smoke (launch-hardening PR 3, Z2): owner PII reveal and investigation
 * surfaces require a recent password step-up, same as legal/TS admins.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('owner step-up (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const testPassword = 'owner-step-up-test-pw'

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.moderationAuditEvents).where(eq(schema.moderationAuditEvents.actorUserId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    invalidatePlatformStaffCache()
  })

  test('owner reveal-sensitive and investigations require step-up first', async () => {
    const owner = await insertCiUser(`z2_owner_${tag}`)
    const target = await insertCiUser(`z2_target_${tag}`)
    userIds.push(owner.id, target.id)
    const hash = await bcrypt.hash(testPassword, 12)
    await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, owner.id))
    await db.insert(schema.platformStaff).values({ userId: owner.id, role: 'OWNER_ADMIN' })
    await db.insert(schema.profiles).values({ userId: target.id })
    invalidatePlatformStaffCache()

    const app = await buildCookieApp(async (a) => {
      const { registerAdminPrivacyRoutes } = await import('../routes/admin-privacy-routes.js')
      const { registerOwnerInvestigationRoutes } = await import('../routes/owner-investigation-routes.js')
      const { registerLegalAlphaRoutes } = await import('../routes/legal-alpha-routes.js')
      await registerAdminPrivacyRoutes(a)
      await registerOwnerInvestigationRoutes(a)
      await registerLegalAlphaRoutes(a)
    })

    try {
      // (a) Without step-up: both surfaces refuse with step_up_required.
      const revealBlocked = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${target.id}/reveal-sensitive`,
        headers: cookieHeader(owner.id, owner.username),
        payload: { field: 'email', reason: 'ci step-up regression check' },
      })
      assert.equal(revealBlocked.statusCode, 403)
      assert.equal((revealBlocked.json() as { code?: string }).code, 'step_up_required')

      const investigationBlocked = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/owner/investigations/users/${target.id}`,
        headers: cookieHeader(owner.id, owner.username),
      })
      assert.equal(investigationBlocked.statusCode, 403)
      assert.equal((investigationBlocked.json() as { code?: string }).code, 'step_up_required')

      // (b) Owner can complete the password step-up.
      const stepUp = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/security/step-up',
        headers: cookieHeader(owner.id, owner.username),
        payload: { password: testPassword },
      })
      assert.equal(stepUp.statusCode, 200)

      // (c) After step-up: reveal works and is audited.
      const reveal = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${target.id}/reveal-sensitive`,
        headers: cookieHeader(owner.id, owner.username),
        payload: { field: 'email', reason: 'ci step-up regression check' },
      })
      assert.equal(reveal.statusCode, 200)
      assert.equal((reveal.json() as { field?: string }).field, 'email')

      const investigation = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/owner/investigations/users/${target.id}`,
        headers: cookieHeader(owner.id, owner.username),
      })
      assert.equal(investigation.statusCode, 200)
    } finally {
      await app.close()
    }
  })
})
