/**
 * Phase 0 - peer reputation freeze + moderator trust summary API.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { applyPeerReputationVote } from '../lib/peer-reputation.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import { registerModerationAdminRoutes } from '../routes/moderation-admin.js'
import { registerModerationTrustSummaryRoutes } from '../routes/moderation-trust-summary.js'
import { registerPeerReputationRoutes } from '../routes/peer-reputation-routes.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('trust summary phase 0 API', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let targetId: string
  let targetUsername: string
  let voterId: string
  let voterUsername: string
  let modId: string
  let modUsername: string
  let siteAdminId: string
  let siteAdminUsername: string

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.identityBans).where(eq(schema.identityBans.userId, userId))
      await db.delete(schema.platformStaff).where(eq(schema.platformStaff.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    invalidatePlatformStaffCache()
  })

  test('seed users', async () => {
    const target = await insertCiUser(`ts0_target_${tag}`)
    targetId = target.id
    targetUsername = target.username
    userIds.push(target.id)
    await db.insert(schema.profiles).values({ userId: target.id, trustScore: 12 })

    const voter = await insertCiUser(`ts0_voter_${tag}`)
    voterId = voter.id
    voterUsername = voter.username
    userIds.push(voter.id)

    const mod = await insertCiUser(`ts0_mod_${tag}`)
    modId = mod.id
    modUsername = mod.username
    userIds.push(mod.id)
    await db.insert(schema.platformStaff).values({ userId: mod.id, role: 'MODERATOR' })

    const admin = await insertCiUser(`ts0_admin_${tag}`)
    siteAdminId = admin.id
    siteAdminUsername = admin.username
    userIds.push(admin.id)
    await db.insert(schema.platformStaff).values({ userId: admin.id, role: 'SITE_ADMIN' })

    invalidatePlatformStaffCache()
  })

  test('POST /api/v1/reputation/peers returns 410 and does not change trust_score', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerPeerReputationRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reputation/peers',
      headers: {
        ...cookieHeader(voterId, voterUsername),
        'content-type': 'application/json',
      },
      payload: { targetUsername, delta: -1 },
    })
    assert.equal(res.statusCode, 410)
    const body = res.json() as { deprecated?: boolean }
    assert.equal(body.deprecated, true)

    const [p] = await db
      .select({ trustScore: schema.profiles.trustScore })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, targetId))
      .limit(1)
    assert.equal(p?.trustScore, 12)

    const bans = await db
      .select()
      .from(schema.identityBans)
      .where(eq(schema.identityBans.userId, targetId))
    assert.equal(bans.length, 0)
  })

  test('applyPeerReputationVote is a no-op (no identity ban)', async () => {
    const out = await applyPeerReputationVote({
      req: { headers: {} } as never,
      sourceUserId: voterId,
      targetUserId: targetId,
      delta: -1,
    })
    assert.equal(out.weightApplied, 0)
    assert.equal(out.trustScore, 12)
    assert.equal(out.deprecated, true)

    const bans = await db
      .select()
      .from(schema.identityBans)
      .where(eq(schema.identityBans.userId, targetId))
    assert.equal(bans.length, 0)
  })

  test('trust-summary auth gates', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerModerationTrustSummaryRoutes(a)
    })
    const url = `/api/v1/moderation/users/${targetId}/trust-summary`

    const anon = await app.inject({ method: 'GET', url })
    assert.equal(anon.statusCode, 401)

    const member = await app.inject({
      method: 'GET',
      url,
      headers: cookieHeader(voterId, voterUsername),
    })
    assert.equal(member.statusCode, 403)

    const mod = await app.inject({
      method: 'GET',
      url,
      headers: cookieHeader(modId, modUsername),
    })
    assert.equal(mod.statusCode, 200)
    const modBody = mod.json() as Record<string, unknown>
    assert.equal(modBody.userId, targetId)
    assert.equal(typeof modBody.username, 'string')
    assert.equal('trustScore' in modBody, false)
    assert.equal('trust_score' in modBody, false)
    const warnings = modBody.warnings as string[]
    assert.ok(Array.isArray(warnings))
    assert.ok(warnings.some((w) => w.includes('deprecated')))

    const admin = await app.inject({
      method: 'GET',
      url,
      headers: cookieHeader(siteAdminId, siteAdminUsername),
    })
    assert.equal(admin.statusCode, 200)
    const adminBody = admin.json() as { restrictions: { identityBanActive: boolean | null } }
    assert.equal(typeof adminBody.restrictions.identityBanActive, 'boolean')
  })

  test('site admin identity ban route still works', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      await registerModerationAdminRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/moderation/admin/identity-bans',
      headers: {
        ...cookieHeader(siteAdminId, siteAdminUsername),
        'content-type': 'application/json',
      },
      payload: { userId: targetId, reason: 'phase0_test', ipPrefix: '203.0.113.10' },
    })
    assert.equal(res.statusCode, 200)

    const [ban] = await db
      .select()
      .from(schema.identityBans)
      .where(eq(schema.identityBans.userId, targetId))
      .limit(1)
    assert.ok(ban)
    assert.equal(ban.reason, 'phase0_test')
  })
})
