/**
 * DB smoke: event feed activity privacy on Following/Home.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { and, eq, inArray } from 'drizzle-orm'
import { mergePrivacySettings } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { ensureUserSettingsRow } from '../lib/user-settings-row.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('event activity (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const publicEventId = randomUUID()
  const privateGroupEventId = randomUUID()
  const countOnlyEventId = randomUUID()
  const privateGroupId = randomUUID()
  const userIds: string[] = []
  const activityIds: string[] = []
  let hostId = ''
  let hostUsername = ''
  let followerId = ''
  let followerUsername = ''
  let strangerId = ''
  let strangerUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    if (activityIds.length) {
      await db.delete(schema.feedActivities).where(inArray(schema.feedActivities.id, activityIds))
    }
    await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, [publicEventId, privateGroupEventId, countOnlyEventId]))
    await db.delete(schema.events).where(inArray(schema.events.id, [publicEventId, privateGroupEventId, countOnlyEventId]))
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, privateGroupId))
    await db.delete(schema.groups).where(eq(schema.groups.id, privateGroupId))
    for (const userId of userIds) {
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, userId))
      await db.delete(schema.connections).where(eq(schema.connections.recipientId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('event_created and event_rsvp respect visibility, blocks, and attendee list rules', async () => {
    const host = await insertCiUser(`${tag}_host`)
    const follower = await insertCiUser(`${tag}_follower`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    hostId = host.id
    hostUsername = host.username
    followerId = follower.id
    followerUsername = follower.username
    strangerId = stranger.id
    strangerUsername = stranger.username
    userIds.push(hostId, followerId, strangerId)

    const now = new Date()
    for (const userId of userIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.connections).values({
      requesterId: followerId,
      recipientId: hostId,
      status: 'ACCEPTED',
      createdAt: now,
    })

    const hostSettings = await ensureUserSettingsRow(hostId)
    await db
      .update(schema.userSettings)
      .set({
        privacySettings: mergePrivacySettings(hostSettings.privacySettings, {
          feedActivityPrivacy: { showEventRsvps: 'on' },
        }),
        updatedAt: now,
      })
      .where(eq(schema.userSettings.userId, hostId))

    await db.insert(schema.groups).values({
      id: privateGroupId,
      slug: `ci-ev-grp-${tag}`,
      name: `CI Private ${tag}`,
      ownerId: hostId,
      visibility: 'private',
    })
    await db.insert(schema.groupMembers).values({
      groupId: privateGroupId,
      userId: hostId,
      role: 'owner',
      memberListVisibility: 'visible',
    })

    const startsAt = new Date(Date.now() + 86_400_000)
    await db.insert(schema.events).values({
      id: publicEventId,
      hostId,
      title: `Public ${tag}`,
      startsAt,
      visibility: 'public',
      attendeeListVisibility: 'public',
    })
    await db.insert(schema.events).values({
      id: privateGroupEventId,
      hostId,
      groupId: privateGroupId,
      title: `Private group ${tag}`,
      startsAt,
      visibility: 'private',
      attendeeListVisibility: 'public',
    })
    await db.insert(schema.events).values({
      id: countOnlyEventId,
      hostId,
      title: `Count only ${tag}`,
      startsAt,
      visibility: 'public',
      attendeeListVisibility: 'count_only',
    })

    const publicCreatedId = randomUUID()
    const privateCreatedId = randomUUID()
    const rsvpActivityId = randomUUID()
    activityIds.push(publicCreatedId, privateCreatedId, rsvpActivityId)

    await db.insert(schema.feedActivities).values([
      {
        id: publicCreatedId,
        actorId: hostId,
        verb: 'event_created',
        objectType: 'event',
        objectId: publicEventId,
        metadata: { title: `Public ${tag}`, location: '123 Secret St' },
        createdAt: now,
      },
      {
        id: privateCreatedId,
        actorId: hostId,
        verb: 'event_created',
        objectType: 'event',
        objectId: privateGroupEventId,
        metadata: { title: `Private group ${tag}`, location: 'Hidden' },
        createdAt: now,
      },
      {
        id: rsvpActivityId,
        actorId: hostId,
        verb: 'event_rsvp',
        objectType: 'event',
        objectId: countOnlyEventId,
        metadata: { title: `Count only ${tag}` },
        createdAt: now,
      },
    ])

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const followerHome = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/home?limit=30',
      headers: cookieHeader(followerId, followerUsername),
    })
    assert.equal(followerHome.statusCode, 200)
    const followerCards = (JSON.parse(followerHome.body) as {
      cards: Array<{ verb?: string; object?: Record<string, unknown>; deepLink?: string }>
    }).cards

    const publicCard = followerCards.find(
      (c) => c.verb === 'event_created' && c.object?.id === publicEventId,
    )
    assert.ok(publicCard, 'follower sees public event_created')
    assert.equal(publicCard!.object?.location, undefined)
    assert.equal(publicCard!.deepLink, `/events/${publicEventId}`)

    const privateCard = followerCards.find(
      (c) => c.verb === 'event_created' && c.object?.id === privateGroupEventId,
    )
    assert.equal(privateCard, undefined, 'non-member must not see private group event activity')

    const rsvpCard = followerCards.find((c) => c.verb === 'event_rsvp' && c.object?.id === countOnlyEventId)
    assert.equal(rsvpCard, undefined, 'count-only RSVP hidden from non-attendee connection')

    const strangerHome = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/home?limit=30',
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerHome.statusCode, 200)
    const strangerCards = (JSON.parse(strangerHome.body) as { cards: Array<{ verb?: string }> }).cards
    assert.equal(
      strangerCards.some((c) => c.verb === 'event_created' || c.verb === 'event_rsvp'),
      false,
    )
  })
})
