/**
 * DB smoke: social notifications respect blocks and dm_request copy payload.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { createNotification } from '../lib/create-notification.js'
import { filterNotificationsForViewer } from '../lib/notification-privacy.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from '../test/ci-db-harness.js'

describe('notification privacy (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  let viewerId = ''
  let viewerUsername = ''
  let blockedId = ''
  let blockedUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.notifications).where(eq(schema.notifications.userId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('filters blocked actors from notification list', async () => {
    const viewer = await insertCiUser(`${tag}_viewer`)
    const blocked = await insertCiUser(`${tag}_blocked`)
    viewerId = viewer.id
    viewerUsername = viewer.username
    blockedId = blocked.id
    blockedUsername = blocked.username
    userIds.push(viewerId, blockedId)

    const now = new Date()
    await db.insert(schema.blocks).values({
      blockerId: viewerId,
      blockedId,
      createdAt: now,
    })

    await createNotification(viewerId, 'connection_request', {
      requesterUsername: blockedUsername,
      connectionId: randomUUID(),
    })
    await createNotification(viewerId, 'dm_request', {
      fromUserId: blockedId,
      conversationId: randomUUID(),
      senderUsername: blockedUsername,
    })

    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, viewerId))

    const filtered = await filterNotificationsForViewer(viewerId, rows)
    assert.equal(filtered.length, 0)

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(res.statusCode, 200)
      assert.equal((res.json() as { items: unknown[] }).items.length, 0)
    } finally {
      await app.close()
    }
  })
})
