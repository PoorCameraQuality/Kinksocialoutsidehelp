/**
 * DB smoke: convention feed activity privacy on Following/Home.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ensureUserSettingsRow } from '../lib/user-settings-row.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('convention activity (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const orgId = randomUUID()
  const convId = randomUUID()
  const publicSlotId = randomUUID()
  const userIds: string[] = []
  const activityIds: string[] = []
  let actorId = ''
  let actorUsername = ''
  let grantFollowerId = ''
  let grantFollowerUsername = ''
  let noGrantFollowerId = ''
  let noGrantFollowerUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    if (activityIds.length) {
      await db.delete(schema.feedActivities).where(inArray(schema.feedActivities.id, activityIds))
    }
    await db.delete(schema.scheduleSlots).where(eq(schema.scheduleSlots.id, publicSlotId))
    await db.delete(schema.conventionAccessGrants).where(eq(schema.conventionAccessGrants.conventionId, convId))
    await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    for (const userId of userIds) {
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, userId))
      await db.delete(schema.connections).where(eq(schema.connections.recipientId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('convention pin requires hub access; public program assignment does not', async () => {
    const actor = await insertCiUser(`${tag}_actor`)
    const grantFollower = await insertCiUser(`${tag}_grant`)
    const noGrantFollower = await insertCiUser(`${tag}_nogrant`)
    actorId = actor.id
    actorUsername = actor.username
    grantFollowerId = grantFollower.id
    grantFollowerUsername = grantFollower.username
    noGrantFollowerId = noGrantFollower.id
    noGrantFollowerUsername = noGrantFollower.username
    userIds.push(actorId, grantFollowerId, noGrantFollowerId)

    const now = new Date()
    const startsAt = new Date(Date.now() + 86_400_000)
    const endsAt = new Date(Date.now() + 172_800_000)
    for (const userId of userIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
      await ensureUserSettingsRow(userId)
    }

    for (const followerId of [grantFollowerId, noGrantFollowerId]) {
      await db.insert(schema.connections).values({
        requesterId: followerId,
        recipientId: actorId,
        status: 'ACCEPTED',
        createdAt: now,
      })
    }

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-conv-org-${tag}`,
      displayName: `CI Org ${tag}`,
      ownerId: actorId,
    })

    await db.insert(schema.conventions).values({
      id: convId,
      slug: `ci-conv-${tag}`,
      name: `CI Convention ${tag}`,
      organizationId: orgId,
      startsAt,
      endsAt,
      settings: { publicProgramListing: true },
    })

    for (const userId of [actorId, grantFollowerId]) {
      await db.insert(schema.conventionAccessGrants).values({
        conventionId: convId,
        userId,
        role: 'ATTENDEE',
        paidConfirmed: true,
        attendingConfirmed: true,
        grantedByUserId: actorId,
      })
    }

    await db.insert(schema.scheduleSlots).values({
      id: publicSlotId,
      conventionId: convId,
      startsAt,
      endsAt,
      title: `Public class ${tag}`,
      isPublished: true,
      visibility: 'ATTENDEE',
    })

    const pinId = randomUUID()
    const presenterId = randomUUID()
    activityIds.push(pinId, presenterId)

    await db.insert(schema.feedActivities).values([
      {
        id: pinId,
        actorId,
        verb: 'convention_pin',
        objectType: 'convention',
        objectId: convId,
        metadata: {
          title: `CI Convention ${tag}`,
          conventionSlug: `ci-conv-${tag}`,
          location: 'Should strip',
        },
        createdAt: now,
      },
      {
        id: presenterId,
        actorId,
        verb: 'presenter_assigned',
        objectType: 'schedule_slot',
        objectId: publicSlotId,
        metadata: {
          slotTitle: `Public class ${tag}`,
          conventionSlug: `ci-conv-${tag}`,
          location: 'Secret room',
        },
        createdAt: now,
      },
    ])

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const grantHome = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/home?limit=30',
      headers: cookieHeader(grantFollowerId, grantFollowerUsername),
    })
    assert.equal(grantHome.statusCode, 200)
    const grantCards = (JSON.parse(grantHome.body) as {
      cards: Array<{ verb?: string; object?: Record<string, unknown>; deepLink?: string }>
    }).cards
    const pinForGrant = grantCards.find((c) => c.verb === 'convention_pin' && c.object?.id === convId)
    assert.ok(pinForGrant, 'fellow attendee sees convention pin')
    assert.equal(pinForGrant!.object?.location, undefined)
    assert.equal(pinForGrant!.deepLink, `/conventions/ci-conv-${tag}`)

    const noGrantHome = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/home?limit=30',
      headers: cookieHeader(noGrantFollowerId, noGrantFollowerUsername),
    })
    assert.equal(noGrantHome.statusCode, 200)
    const noGrantCards = (JSON.parse(noGrantHome.body) as {
      cards: Array<{ verb?: string; object?: Record<string, unknown> }>
    }).cards
    assert.equal(
      noGrantCards.some((c) => c.verb === 'convention_pin' && c.object?.id === convId),
      false,
      'connection without hub access must not see pin',
    )
    assert.ok(
      noGrantCards.some((c) => c.verb === 'presenter_assigned' && c.object?.id === publicSlotId),
      'public program assignment visible without hub grant',
    )
  })
})
