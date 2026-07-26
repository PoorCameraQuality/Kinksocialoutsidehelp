/**
 * DB smoke: DM privacy gates on conversation create.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { mergePrivacySettings } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { ensureUserSettingsRow } from '../lib/user-settings-row.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('dm privacy (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let viewerId = ''
  let viewerUsername = ''
  let targetId = ''
  let targetUsername = ''
  let blockedId = ''
  let blockedUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.conversationParticipants).where(eq(schema.conversationParticipants.userId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('blocked users cannot create conversations; open privacy allows non-connections', async () => {
    const viewer = await insertCiUser(`${tag}_viewer`)
    const target = await insertCiUser(`${tag}_target`)
    const blocked = await insertCiUser(`${tag}_blocked`)
    viewerId = viewer.id
    viewerUsername = viewer.username
    targetId = target.id
    targetUsername = target.username
    blockedId = blocked.id
    blockedUsername = blocked.username
    userIds.push(viewerId, targetId, blockedId)

    const now = new Date()
    for (const userId of userIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    const targetSettings = await ensureUserSettingsRow(targetId)
    await db
      .update(schema.userSettings)
      .set({
        privacySettings: mergePrivacySettings(targetSettings.privacySettings, {
          whoCanMessage: 'open',
        }),
        updatedAt: now,
      })
      .where(eq(schema.userSettings.userId, targetId))

    await db.insert(schema.blocks).values({
      blockerId: viewerId,
      blockedId,
      createdAt: now,
    })

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      const { registerSocialGraphRoutes } = await import('../routes/social-graph-routes.js')
      await registerEcosystemStubRoutes(a)
      await registerSocialGraphRoutes(a)
    })

    try {
      const blockedCreate = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: {
          ...cookieHeader(viewerId, viewerUsername),
          'content-type': 'application/json',
        },
        payload: { participantUsername: blockedUsername },
      })
      assert.equal(blockedCreate.statusCode, 403)

      const openCreate = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: {
          ...cookieHeader(viewerId, viewerUsername),
          'content-type': 'application/json',
        },
        payload: { participantUsername: targetUsername },
      })
      assert.equal(openCreate.statusCode, 200)

      const graphRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${encodeURIComponent(targetUsername)}/graph-status`,
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(graphRes.statusCode, 200)
      const graph = graphRes.json() as { canMessage?: boolean; messageHint?: string | null }
      assert.equal(graph.canMessage, true)
      assert.equal(graph.messageHint, 'request_pending')
    } finally {
      await app.close()
    }
  })
})
