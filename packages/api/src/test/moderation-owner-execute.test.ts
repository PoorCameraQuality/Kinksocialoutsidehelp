/**
 * Owner apex: execute-now allowed for site owner; plain mod gets 403.
 * Gated on CI_API_INTEGRATION_DB / CI_NOTIFICATIONS_DB / USE_DATABASE.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { invalidatePlatformStaffCache } from '../lib/platform-staff.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

const run = runDbIntegration || process.env.USE_DATABASE === 'true'

describe('owner execute-now apex power', { skip: !run }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const actionIds: string[] = []
  let ownerId: string
  let ownerUsername: string
  let modId: string
  let modUsername: string
  let proposerId: string
  let savedOwner: string | undefined
  let savedMods: string | undefined

  after(async () => {
    for (const id of actionIds) {
      await db.delete(schema.moderationActionApprovals).where(eq(schema.moderationActionApprovals.actionId, id))
      await db.delete(schema.moderationActions).where(eq(schema.moderationActions.id, id))
    }
    for (const userId of userIds) {
      await db.delete(schema.moderationAuditEvents).where(eq(schema.moderationAuditEvents.actorUserId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
    if (savedOwner === undefined) delete process.env.C2K_SITE_OWNER_USER_IDS
    else process.env.C2K_SITE_OWNER_USER_IDS = savedOwner
    if (savedMods === undefined) delete process.env.C2K_PLATFORM_MODERATOR_USER_IDS
    else process.env.C2K_PLATFORM_MODERATOR_USER_IDS = savedMods
    invalidatePlatformStaffCache()
  })

  test('owner can execute-now; plain mod cannot', async () => {
    ensureCiAuthSecret()
    const owner = await insertCiUser(`owner_${tag}`)
    const mod = await insertCiUser(`mod_${tag}`)
    const proposer = await insertCiUser(`prop_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    modId = mod.id
    modUsername = mod.username
    proposerId = proposer.id
    userIds.push(ownerId, modId, proposerId)

    savedOwner = process.env.C2K_SITE_OWNER_USER_IDS
    savedMods = process.env.C2K_PLATFORM_MODERATOR_USER_IDS
    process.env.C2K_SITE_OWNER_USER_IDS = ownerId
    process.env.C2K_PLATFORM_MODERATOR_USER_IDS = modId
    invalidatePlatformStaffCache()

    const [action] = await db
      .insert(schema.moderationActions)
      .values({
        actionType: 'SCOPE_BAN',
        targetType: 'user',
        targetId: proposerId,
        proposedByUserId: proposerId,
        requiredApprovals: 2,
        payload: { banScopeType: 'organization', banScopeId: randomUUID(), reason: 'ci owner execute' },
      })
      .returning()
    assert.ok(action)
    actionIds.push(action.id)

    const app = await buildCookieApp(async (a) => {
      const { registerModerationActionsRoutes } = await import('../routes/moderation-actions.js')
      await registerModerationActionsRoutes(a)
    })

    try {
      const denied = await app.inject({
        method: 'POST',
        url: `/api/v1/moderation/actions/${action.id}/execute-now`,
        headers: {
          ...cookieHeader(modId, modUsername),
          'content-type': 'application/json',
        },
        payload: { reason: 'mod should not override' },
      })
      assert.equal(denied.statusCode, 403)

      const ok = await app.inject({
        method: 'POST',
        url: `/api/v1/moderation/actions/${action.id}/execute-now`,
        headers: {
          ...cookieHeader(ownerId, ownerUsername),
          'content-type': 'application/json',
        },
        payload: { reason: 'owner solo execute for CI' },
      })
      assert.equal(ok.statusCode, 200, ok.body)
      const body = ok.json() as { action?: { status?: string; overrideReason?: string } }
      assert.ok(body.action)
      assert.match(String(body.action.status ?? ''), /EXECUTED|OVERRIDDEN/i)
      assert.equal(body.action.overrideReason, 'owner solo execute for CI')
    } finally {
      await app.close()
    }
  })
})
