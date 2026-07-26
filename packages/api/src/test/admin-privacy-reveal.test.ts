/**
 * Owner-only break-glass sensitive reveal - access control tests.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import { registerAdminPrivacyRoutes } from '../routes/admin-privacy-routes.js'
import { prepareEmailStorage } from '../lib/user-email.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('owner-only reveal-sensitive', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let targetUserId: string
  let ownerId: string
  let ownerUsername: string
  let siteAdminId: string
  let siteAdminUsername: string
  let tsAdminId: string
  let tsAdminUsername: string
  let savedOwnerEnv: string | undefined
  let savedAdminEnv: string | undefined

  after(async () => {
    if (savedOwnerEnv === undefined) delete process.env.C2K_SITE_OWNER_USER_IDS
    else process.env.C2K_SITE_OWNER_USER_IDS = savedOwnerEnv
    if (savedAdminEnv === undefined) delete process.env.C2K_SITE_ADMIN_USER_IDS
    else process.env.C2K_SITE_ADMIN_USER_IDS = savedAdminEnv
    invalidatePlatformStaffCache()

    for (const userId of userIds) {
      await db.delete(schema.moderationAuditEvents).where(eq(schema.moderationAuditEvents.actorUserId, userId))
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function insertStaff(role: 'SITE_ADMIN' | 'TRUST_SAFETY_ADMIN', suffix: string) {
    const user = await insertCiUser(`reveal_${suffix}_${tag}`)
    userIds.push(user.id)
    await db.insert(schema.platformStaff).values({ userId: user.id, role })
    return user
  }

  test('setup target user and staff', async () => {
    savedOwnerEnv = process.env.C2K_SITE_OWNER_USER_IDS
    savedAdminEnv = process.env.C2K_SITE_ADMIN_USER_IDS

    const target = await insertCiUser(`reveal_target_${tag}`)
    targetUserId = target.id
    userIds.push(target.id)
    const emailFields = prepareEmailStorage('target-reveal@ci.c2k.test')
    await db
      .update(schema.users)
      .set({
        ...emailFields,
        registrationIpPrefix: '203.0.113.10',
      })
      .where(eq(schema.users.id, targetUserId))

    const owner = await insertCiUser(`reveal_owner_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    userIds.push(owner.id)
    const ownerPasswordHash = await bcrypt.hash('owner-reveal-step-up-pw', 12)
    await db.update(schema.users).set({ passwordHash: ownerPasswordHash }).where(eq(schema.users.id, ownerId))

    const siteAdmin = await insertStaff('SITE_ADMIN', 'site')
    siteAdminId = siteAdmin.id
    siteAdminUsername = siteAdmin.username

    const tsAdmin = await insertStaff('TRUST_SAFETY_ADMIN', 'ts')
    tsAdminId = tsAdmin.id
    tsAdminUsername = tsAdmin.username

    process.env.C2K_SITE_OWNER_USER_IDS = ownerId
    process.env.C2K_SITE_ADMIN_USER_IDS = siteAdminId
    invalidatePlatformStaffCache()
  })

  test('SITE_ADMIN without owner env is denied', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerAdminPrivacyRoutes)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUserId}/reveal-sensitive`,
      headers: cookieHeader(siteAdminId, siteAdminUsername),
      payload: { field: 'email', reason: 'Moderation case review for alpha test' },
    })
    assert.equal(res.statusCode, 403)
    await app.close()
  })

  test('TRUST_SAFETY_ADMIN without owner env is denied', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerAdminPrivacyRoutes)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUserId}/reveal-sensitive`,
      headers: cookieHeader(tsAdminId, tsAdminUsername),
      payload: { field: 'email', reason: 'Trust and safety investigation request' },
    })
    assert.equal(res.statusCode, 403)
    await app.close()
  })

  test('OWNER_ADMIN succeeds and writes audit log', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerAdminPrivacyRoutes(a)
      const { registerLegalAlphaRoutes } = await import('../routes/legal-alpha-routes.js')
      await registerLegalAlphaRoutes(a)
    })
    const stepUp = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/security/step-up',
      headers: cookieHeader(ownerId, ownerUsername),
      payload: { password: 'owner-reveal-step-up-pw' },
    })
    assert.equal(stepUp.statusCode, 200, stepUp.body)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUserId}/reveal-sensitive`,
      headers: cookieHeader(ownerId, ownerUsername),
      payload: { field: 'email', reason: 'Owner investigation of reported account' },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json() as { field: string; value: string }
    assert.equal(body.field, 'email')
    assert.equal(body.value, 'target-reveal@ci.c2k.test')

    const [audit] = await db
      .select()
      .from(schema.moderationAuditEvents)
      .where(
        and(
          eq(schema.moderationAuditEvents.actorUserId, ownerId),
          eq(schema.moderationAuditEvents.verb, 'sensitive_data.reveal'),
        ),
      )
      .orderBy(desc(schema.moderationAuditEvents.createdAt))
      .limit(1)
    assert.ok(audit)
    const payload = audit.payload as { field?: string; reason?: string }
    assert.equal(payload.field, 'email')
    assert.ok(payload.reason && payload.reason.length >= 10)
    await app.close()
  })
})
