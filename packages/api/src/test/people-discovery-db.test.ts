/**
 * DB smoke: people directory and connection suggestions privacy.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('people discovery privacy (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const eventId = randomUUID()
  const userIds: string[] = []
  let viewerId = ''
  let viewerUsername = ''
  let visibleUsername = ''
  let hiddenUsername = ''
  let blockedUsername = ''
  let blockedId = ''
  let coAttendeeId = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    await db.delete(schema.eventRsvps).where(eq(schema.eventRsvps.eventId, eventId))
    await db.delete(schema.events).where(eq(schema.events.id, eventId))
    for (const userId of userIds) {
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId))
      await db.delete(schema.eventRsvps).where(eq(schema.eventRsvps.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('profiles directory and co_attendance suggestions exclude blocked and undiscoverable users', async () => {
    const viewer = await insertCiUser(`${tag}_viewer`)
    const visible = await insertCiUser(`${tag}_visible`)
    const hidden = await insertCiUser(`${tag}_hidden`)
    const blocked = await insertCiUser(`${tag}_blocked`)
    const coAttendee = await insertCiUser(`${tag}_co`)
    viewerId = viewer.id
    viewerUsername = viewer.username
    visibleUsername = visible.username
    hiddenUsername = hidden.username
    blockedUsername = blocked.username
    blockedId = blocked.id
    coAttendeeId = coAttendee.id
    userIds.push(viewerId, visible.id, hidden.id, blockedId, coAttendeeId)

    const now = new Date()
    await db.insert(schema.profiles).values([
      { userId: viewerId, displayName: 'Viewer', updatedAt: now, visibility: 'PUBLIC' },
      {
        userId: visible.id,
        displayName: 'Visible',
        updatedAt: now,
        visibility: 'PUBLIC',
        discoverableInPeopleSearch: true,
      },
      {
        userId: hidden.id,
        displayName: 'Hidden',
        updatedAt: now,
        visibility: 'PUBLIC',
        discoverableInPeopleSearch: false,
      },
      {
        userId: blockedId,
        displayName: 'Blocked',
        updatedAt: now,
        visibility: 'PUBLIC',
        discoverableInPeopleSearch: true,
      },
      {
        userId: coAttendeeId,
        displayName: 'CoAttendee',
        updatedAt: now,
        visibility: 'PUBLIC',
        discoverableInPeopleSearch: true,
      },
    ])

    await db.insert(schema.blocks).values({
      blockerId: viewerId,
      blockedId,
      createdAt: now,
    })

    await db.insert(schema.events).values({
      id: eventId,
      hostId: viewerId,
      title: `CI People ${tag}`,
      startsAt: new Date(Date.now() + 86_400_000),
      visibility: 'public',
      attendeeListVisibility: 'public',
    })

    for (const userId of [viewerId, blockedId, coAttendeeId]) {
      await db.insert(schema.eventRsvps).values({
        eventId,
        userId,
        status: 'going',
        createdAt: now,
      })
    }

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      const profilesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/profiles?limit=50',
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(profilesRes.statusCode, 200)
      const profileUsernames = (profilesRes.json() as { items: Array<{ username: string }> }).items.map(
        (r) => r.username,
      )
      assert.ok(profileUsernames.includes(visibleUsername), 'discoverable user visible')
      assert.equal(profileUsernames.includes(hiddenUsername), false, 'undiscoverable user hidden')
      assert.equal(profileUsernames.includes(blockedUsername), false, 'blocked user hidden')

      const suggestedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/connections/suggested?source=co_attendance&limit=10',
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(suggestedRes.statusCode, 200)
      const suggestedIds = (suggestedRes.json() as { items: Array<{ userId: string }> }).items.map(
        (r) => r.userId,
      )
      assert.ok(suggestedIds.includes(coAttendeeId), 'co-attendee suggested')
      assert.equal(suggestedIds.includes(blockedId), false, 'blocked co-attendee excluded')
    } finally {
      await app.close()
    }
  })
})
