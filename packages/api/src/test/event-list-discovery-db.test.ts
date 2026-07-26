/**
 * DB smoke: global event list returns public events only; scoped lists preserve access.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('event list discovery privacy (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const publicEventId = randomUUID()
  const privateEventId = randomUUID()
  const privateGroupEventId = randomUUID()
  const groupId = randomUUID()
  const userIds: string[] = []
  let hostId = ''
  let hostUsername = ''
  let memberId = ''
  let memberUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, [publicEventId, privateEventId, privateGroupEventId]))
    await db.delete(schema.events).where(inArray(schema.events.id, [publicEventId, privateEventId, privateGroupEventId]))
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
    await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('global list is public-only; group-scoped list keeps member access to private group events', async () => {
    const host = await insertCiUser(`${tag}_host`)
    const member = await insertCiUser(`${tag}_member`)
    hostId = host.id
    hostUsername = host.username
    memberId = member.id
    memberUsername = member.username
    userIds.push(hostId, memberId)

    const now = new Date()
    const startsAt = new Date(Date.now() + 86_400_000)

    await db.insert(schema.profiles).values([
      { userId: hostId, displayName: 'Host', updatedAt: now },
      { userId: memberId, displayName: 'Member', updatedAt: now },
    ])

    await db.insert(schema.groups).values({
      id: groupId,
      name: `CI group ${tag}`,
      slug: `ci-group-${tag}`,
      ownerId: hostId,
      visibility: 'private',
      createdAt: now,
      lastActivityAt: now,
    })
    await db.insert(schema.groupMembers).values([
      { groupId, userId: hostId, role: 'owner', memberListVisibility: 'visible' },
      { groupId, userId: memberId, role: 'member', memberListVisibility: 'visible' },
    ])

    await db.insert(schema.events).values([
      {
        id: publicEventId,
        hostId,
        title: `Public ${tag}`,
        startsAt,
        visibility: 'public',
      },
      {
        id: privateEventId,
        hostId,
        title: `Private standalone ${tag}`,
        startsAt,
        visibility: 'private',
      },
      {
        id: privateGroupEventId,
        hostId,
        groupId,
        title: `Private group ${tag}`,
        startsAt,
        visibility: 'private',
      },
    ])

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      const globalAnon = await app.inject({ method: 'GET', url: '/api/v1/events' })
      assert.equal(globalAnon.statusCode, 200)
      const globalAnonIds = ((globalAnon.json() as { items?: Array<{ id: string }> }).items ?? []).map((e) => e.id)
      assert.ok(globalAnonIds.includes(publicEventId), 'public event in global list')
      assert.ok(!globalAnonIds.includes(privateEventId), 'private standalone excluded from global list')
      assert.ok(!globalAnonIds.includes(privateGroupEventId), 'private group event excluded from global list')

      const globalMember = await app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: cookieHeader(memberId, memberUsername),
      })
      assert.equal(globalMember.statusCode, 200)
      const globalMemberIds = ((globalMember.json() as { items?: Array<{ id: string }> }).items ?? []).map((e) => e.id)
      assert.ok(!globalMemberIds.includes(privateGroupEventId), 'private group event still excluded from global list')

      const groupMember = await app.inject({
        method: 'GET',
        url: `/api/v1/events?groupId=${groupId}`,
        headers: cookieHeader(memberId, memberUsername),
      })
      assert.equal(groupMember.statusCode, 200)
      const groupMemberIds = ((groupMember.json() as { items?: Array<{ id: string }> }).items ?? []).map((e) => e.id)
      assert.ok(groupMemberIds.includes(privateGroupEventId), 'group member sees private group event on scoped list')

      const hostMine = await app.inject({
        method: 'GET',
        url: '/api/v1/events?hostId=me',
        headers: cookieHeader(hostId, hostUsername),
      })
      assert.equal(hostMine.statusCode, 200)
      const hostMineIds = ((hostMine.json() as { items?: Array<{ id: string }> }).items ?? []).map((e) => e.id)
      assert.ok(hostMineIds.includes(privateEventId), 'host sees own private events via hostId=me')
    } finally {
      await app.close()
    }
  })
})
