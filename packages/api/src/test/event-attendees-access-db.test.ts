/**
 * DB smoke (launch-hardening PR 3, P1): the event attendee roster is gated by
 * the same visibility/block rules as the event detail. UUID possession is not
 * authorization, and blocked pairs never see each other on the roster.
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

type AttendeesBody = {
  goingCount: number
  attendeeListVisibility: string
  items: Array<{ userId: string; username: string }>
}

describe('event attendees access (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const publicEventId = randomUUID()
  const privateEventId = randomUUID()
  const groupEventId = randomUUID()
  const countOnlyEventId = randomUUID()
  const groupId = randomUUID()
  const eventIds = [publicEventId, privateEventId, groupEventId, countOnlyEventId]
  const userIds: string[] = []

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, eventIds))
    await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
    await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    for (const userId of userIds) {
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('attendee roster enforces event visibility, blocks, and count_only', async () => {
    const host = await insertCiUser(`${tag}_att_host`)
    const attendee = await insertCiUser(`${tag}_att_going`)
    const member = await insertCiUser(`${tag}_att_member`)
    const stranger = await insertCiUser(`${tag}_att_stranger`)
    const blockedViewer = await insertCiUser(`${tag}_att_blocked`)
    userIds.push(host.id, attendee.id, member.id, stranger.id, blockedViewer.id)

    const now = new Date()
    await db.insert(schema.profiles).values(
      userIds.map((userId) => ({ userId, displayName: userId.slice(0, 8), updatedAt: now })),
    )

    await db.insert(schema.groups).values({
      id: groupId,
      name: `CI attendees group ${tag}`,
      slug: `ci-att-grp-${tag}`,
      ownerId: host.id,
      visibility: 'private',
      createdAt: now,
      lastActivityAt: now,
    })
    await db.insert(schema.groupMembers).values([
      { groupId, userId: host.id, role: 'owner', memberListVisibility: 'visible' },
      { groupId, userId: member.id, role: 'member', memberListVisibility: 'visible' },
    ])

    const startsAt = new Date(Date.now() + 86_400_000)
    await db.insert(schema.events).values([
      { id: publicEventId, hostId: host.id, title: `Public ${tag}`, startsAt, visibility: 'public' },
      { id: privateEventId, hostId: host.id, title: `Private ${tag}`, startsAt, visibility: 'private' },
      {
        id: groupEventId,
        hostId: host.id,
        groupId,
        title: `Group private ${tag}`,
        startsAt,
        visibility: 'private',
      },
      {
        id: countOnlyEventId,
        hostId: host.id,
        title: `Count only ${tag}`,
        startsAt,
        visibility: 'public',
        attendeeListVisibility: 'count_only',
      },
    ])

    for (const eventId of eventIds) {
      await db.insert(schema.eventRsvps).values({
        eventId,
        userId: attendee.id,
        status: 'going',
        rsvpApprovalStatus: 'not_required',
      })
    }

    // The attendee has blocked blockedViewer (either direction must hide).
    await db.insert(schema.blocks).values({ blockerId: attendee.id, blockedId: blockedViewer.id })

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      // (a) Anonymous and stranger get 404 on private / group-private events.
      const anonPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateEventId}/attendees`,
      })
      assert.equal(anonPrivate.statusCode, 404)

      const strangerPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateEventId}/attendees`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerPrivate.statusCode, 404)

      const strangerGroup = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${groupEventId}/attendees`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerGroup.statusCode, 404)

      // (b) Host and group member get the roster.
      const hostPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateEventId}/attendees`,
        headers: cookieHeader(host.id, host.username),
      })
      assert.equal(hostPrivate.statusCode, 200)
      const hostBody = hostPrivate.json() as AttendeesBody
      assert.equal(hostBody.goingCount, 1)
      assert.ok(hostBody.items.some((i) => i.userId === attendee.id))

      const memberGroup = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${groupEventId}/attendees`,
        headers: cookieHeader(member.id, member.username),
      })
      assert.equal(memberGroup.statusCode, 200)
      assert.ok((memberGroup.json() as AttendeesBody).items.some((i) => i.userId === attendee.id))

      // (c) Blocked pair is omitted from the roster even on a public event.
      const strangerPublic = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${publicEventId}/attendees`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerPublic.statusCode, 200)
      assert.ok((strangerPublic.json() as AttendeesBody).items.some((i) => i.userId === attendee.id))

      const blockedPublic = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${publicEventId}/attendees`,
        headers: cookieHeader(blockedViewer.id, blockedViewer.username),
      })
      assert.equal(blockedPublic.statusCode, 200)
      assert.ok(
        !(blockedPublic.json() as AttendeesBody).items.some((i) => i.userId === attendee.id),
        'blocked pair must not appear on the roster',
      )

      // (d) count_only hides names from non-hosts but not the host.
      const strangerCountOnly = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${countOnlyEventId}/attendees`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerCountOnly.statusCode, 200)
      const strangerCountBody = strangerCountOnly.json() as AttendeesBody
      assert.equal(strangerCountBody.goingCount, 1)
      assert.equal(strangerCountBody.items.length, 0)

      const hostCountOnly = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${countOnlyEventId}/attendees`,
        headers: cookieHeader(host.id, host.username),
      })
      assert.ok((hostCountOnly.json() as AttendeesBody).items.some((i) => i.userId === attendee.id))
    } finally {
      await app.close()
    }
  })
})
