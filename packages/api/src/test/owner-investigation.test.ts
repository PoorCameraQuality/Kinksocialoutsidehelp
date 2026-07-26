/**
 * OWNER_ADMIN investigation console - access control and DM read-state safety.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import {
  countConversationParticipants,
  countNotificationsForUser,
  loadOwnerDmMessages,
  snapshotDmReadState,
} from '../lib/owner-investigation-service.js'
import { registerOwnerInvestigationRoutes } from '../routes/owner-investigation-routes.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('owner investigation API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let targetId: string
  let targetUsername: string
  let otherId: string
  let ownerId: string
  let ownerUsername: string
  let siteAdminId: string
  let siteAdminUsername: string
  let tsAdminId: string
  let tsAdminUsername: string
  let conversationId: string
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
    }
    if (conversationId) {
      await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId))
      await db.delete(schema.conversationParticipants).where(eq(schema.conversationParticipants.conversationId, conversationId))
      await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId))
    }
    for (const userId of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function insertStaff(role: 'SITE_ADMIN' | 'TRUST_SAFETY_ADMIN', suffix: string) {
    const user = await insertCiUser(`oi_${suffix}_${tag}`)
    userIds.push(user.id)
    await db.insert(schema.platformStaff).values({ userId: user.id, role })
    return user
  }

  test('setup users, DM thread, and roles', async () => {
    savedOwnerEnv = process.env.C2K_SITE_OWNER_USER_IDS
    savedAdminEnv = process.env.C2K_SITE_ADMIN_USER_IDS

    const target = await insertCiUser(`oi_target_${tag}`)
    targetId = target.id
    targetUsername = target.username
    userIds.push(target.id)

    const other = await insertCiUser(`oi_other_${tag}`)
    otherId = other.id
    userIds.push(other.id)

    const owner = await insertCiUser(`oi_owner_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    userIds.push(owner.id)
    const ownerPasswordHash = await bcrypt.hash('owner-invest-step-up-pw', 12)
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

    const [conv] = await db
      .insert(schema.conversations)
      .values({ initiatorUserId: targetId })
      .returning({ id: schema.conversations.id })
    conversationId = conv.id

    const readAt = new Date('2020-01-01T00:00:00.000Z')
    await db.insert(schema.conversationParticipants).values([
      { conversationId, userId: targetId, acceptanceStatus: 'ACCEPTED', lastReadAt: readAt },
      { conversationId, userId: otherId, acceptanceStatus: 'ACCEPTED' },
    ])

    await db.insert(schema.messages).values([
      { conversationId, senderId: targetId, body: 'owner-investigation-dm-secret-body' },
      { conversationId, senderId: otherId, body: 'reply from other user' },
    ])
  })

  test('logged-out user gets 401', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerOwnerInvestigationRoutes)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}`,
    })
    assert.equal(res.statusCode, 401)
    await app.close()
  })

  test('normal user gets 403', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerOwnerInvestigationRoutes)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}`,
      headers: cookieHeader(targetId, targetUsername),
    })
    assert.equal(res.statusCode, 403)
    await app.close()
  })

  test('SITE_ADMIN without owner gets 403', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerOwnerInvestigationRoutes)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}`,
      headers: cookieHeader(siteAdminId, siteAdminUsername),
    })
    assert.equal(res.statusCode, 403)
    await app.close()
  })

  test('TRUST_SAFETY_ADMIN without owner gets 403', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerOwnerInvestigationRoutes)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}`,
      headers: cookieHeader(tsAdminId, tsAdminUsername),
    })
    assert.equal(res.statusCode, 403)
    await app.close()
  })

  test('OWNER_ADMIN can load summary', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerOwnerInvestigationRoutes(a)
      const { registerLegalAlphaRoutes } = await import('../routes/legal-alpha-routes.js')
      await registerLegalAlphaRoutes(a)
    })
    const stepUp = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/security/step-up',
      headers: cookieHeader(ownerId, ownerUsername),
      payload: { password: 'owner-invest-step-up-pw' },
    })
    assert.equal(stepUp.statusCode, 200, stepUp.body)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}`,
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(res.statusCode, 200)
    const body = res.json() as { user: { username: string } }
    assert.equal(body.user.username, targetUsername)
    await app.close()
  })

  test('sensitive section requires reason', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerOwnerInvestigationRoutes(a)
      const { registerLegalAlphaRoutes } = await import('../routes/legal-alpha-routes.js')
      await registerLegalAlphaRoutes(a)
    })
    const stepUp = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/security/step-up',
      headers: cookieHeader(ownerId, ownerUsername),
      payload: { password: 'owner-invest-step-up-pw' },
    })
    assert.equal(stepUp.statusCode, 200, stepUp.body)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}/sensitive`,
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(res.statusCode, 400)
    await app.close()
  })

  test('OWNER DM view does not change last_read_at or participants or notifications', async () => {
    const beforeRead = await snapshotDmReadState(conversationId, targetId)
    const participantsBefore = await countConversationParticipants(conversationId)
    const notifTargetBefore = await countNotificationsForUser(targetId)
    const notifOtherBefore = await countNotificationsForUser(otherId)

    const result = await loadOwnerDmMessages(targetId, conversationId)
    assert.ok(result)
    assert.ok(result.items.some((m) => m.body.includes('owner-investigation-dm-secret')))

    const afterRead = await snapshotDmReadState(conversationId, targetId)
    assert.equal(afterRead?.toISOString(), beforeRead?.toISOString())
    assert.equal(await countConversationParticipants(conversationId), participantsBefore)
    assert.equal(await countNotificationsForUser(targetId), notifTargetBefore)
    assert.equal(await countNotificationsForUser(otherId), notifOtherBefore)
  })

  test('OWNER DM API creates audit log with dmContentsOpened', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(registerOwnerInvestigationRoutes)
    const reason = 'Investigating harassment report for alpha'
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owner/investigations/users/${targetId}/dms/${conversationId}/messages`,
      headers: {
        ...cookieHeader(ownerId, ownerUsername),
        'x-c2k-investigation-reason': reason,
      },
    })
    assert.equal(res.statusCode, 200)

    const [audit] = await db
      .select()
      .from(schema.moderationAuditEvents)
      .where(
        and(
          eq(schema.moderationAuditEvents.actorUserId, ownerId),
          eq(schema.moderationAuditEvents.verb, 'owner_investigation.access'),
        ),
      )
      .orderBy(desc(schema.moderationAuditEvents.createdAt))
      .limit(1)
    assert.ok(audit)
    const payload = audit.payload as { section?: string; dmContentsOpened?: boolean; reason?: string }
    assert.equal(payload.section, 'dm_messages')
    assert.equal(payload.dmContentsOpened, true)
    assert.ok(payload.reason && payload.reason.length >= 10)
    await app.close()
  })
})
