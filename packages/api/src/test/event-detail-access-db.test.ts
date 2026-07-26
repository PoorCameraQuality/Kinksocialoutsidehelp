/**
 * DB smoke: event detail is permission-gated; UUID possession is not authorization.
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

describe('event detail access (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const publicEventId = randomUUID()
  const privateEventId = randomUUID()
  const privateGroupEventId = randomUUID()
  const privateOrgEventId = randomUUID()
  const rsvpPrivateEventId = randomUUID()
  const groupId = randomUUID()
  const orgId = randomUUID()
  const userIds: string[] = []
  let hostId = ''
  let hostUsername = ''
  let memberId = ''
  let memberUsername = ''
  let strangerId = ''
  let strangerUsername = ''
  let orgMemberId = ''
  let orgMemberUsername = ''
  let orgModId = ''
  let orgModUsername = ''
  let rsvpUserId = ''
  let rsvpUsername = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    await db
      .delete(schema.eventRsvps)
      .where(
        inArray(schema.eventRsvps.eventId, [
          publicEventId,
          privateEventId,
          privateGroupEventId,
          privateOrgEventId,
          rsvpPrivateEventId,
        ]),
      )
    await db
      .delete(schema.events)
      .where(
        inArray(schema.events.id, [
          publicEventId,
          privateEventId,
          privateGroupEventId,
          privateOrgEventId,
          rsvpPrivateEventId,
        ]),
      )
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
    await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('GET /api/v1/events/:id enforces visibility; global list stays public-only', async () => {
    const host = await insertCiUser(`${tag}_host`)
    const member = await insertCiUser(`${tag}_member`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    const orgMember = await insertCiUser(`${tag}_org_member`)
    const orgMod = await insertCiUser(`${tag}_org_mod`)
    const rsvpUser = await insertCiUser(`${tag}_rsvp`)
    hostId = host.id
    hostUsername = host.username
    memberId = member.id
    memberUsername = member.username
    strangerId = stranger.id
    strangerUsername = stranger.username
    orgMemberId = orgMember.id
    orgMemberUsername = orgMember.username
    orgModId = orgMod.id
    orgModUsername = orgMod.username
    rsvpUserId = rsvpUser.id
    rsvpUsername = rsvpUser.username
    userIds.push(hostId, memberId, strangerId, orgMemberId, orgModId, rsvpUserId)

    const now = new Date()
    const startsAt = new Date(Date.now() + 86_400_000)

    await db.insert(schema.profiles).values(
      userIds.map((userId) => ({ userId, displayName: userId.slice(0, 8), updatedAt: now })),
    )

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

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-org-${tag}`,
      displayName: `CI org ${tag}`,
      ownerId: hostId,
      visibility: 'MEMBERS',
    })
    await db.insert(schema.organizationMembers).values([
      { organizationId: orgId, userId: orgMemberId, role: 'MEMBER' },
      { organizationId: orgId, userId: orgModId, role: 'MODERATOR' },
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
      {
        id: privateOrgEventId,
        hostId,
        organizationId: orgId,
        title: `Private org ${tag}`,
        startsAt,
        visibility: 'private',
      },
      {
        id: rsvpPrivateEventId,
        hostId,
        title: `Private RSVP ${tag}`,
        startsAt,
        visibility: 'private',
      },
    ])

    await db.insert(schema.eventRsvps).values({
      eventId: rsvpPrivateEventId,
      userId: rsvpUserId,
      status: 'going',
    })

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      const anonPublic = await app.inject({ method: 'GET', url: `/api/v1/events/${publicEventId}` })
      assert.equal(anonPublic.statusCode, 200)
      assert.equal((anonPublic.json() as { event?: { id?: string } }).event?.id, publicEventId)

      const memberPublic = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${publicEventId}`,
        headers: cookieHeader(strangerId, strangerUsername),
      })
      assert.equal(memberPublic.statusCode, 200)

      const anonPrivate = await app.inject({ method: 'GET', url: `/api/v1/events/${privateEventId}` })
      assert.equal(anonPrivate.statusCode, 404)

      const strangerPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateEventId}`,
        headers: cookieHeader(strangerId, strangerUsername),
      })
      assert.equal(strangerPrivate.statusCode, 404)

      const hostPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateEventId}`,
        headers: cookieHeader(hostId, hostUsername),
      })
      assert.equal(hostPrivate.statusCode, 200)

      const memberGroupPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateGroupEventId}`,
        headers: cookieHeader(memberId, memberUsername),
      })
      assert.equal(memberGroupPrivate.statusCode, 200)

      const strangerGroupPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateGroupEventId}`,
        headers: cookieHeader(strangerId, strangerUsername),
      })
      assert.equal(strangerGroupPrivate.statusCode, 404)

      const orgMemberPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateOrgEventId}`,
        headers: cookieHeader(orgMemberId, orgMemberUsername),
      })
      assert.equal(orgMemberPrivate.statusCode, 200)

      const orgStrangerPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateOrgEventId}`,
        headers: cookieHeader(strangerId, strangerUsername),
      })
      assert.equal(orgStrangerPrivate.statusCode, 404)

      const orgModPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${privateOrgEventId}`,
        headers: cookieHeader(orgModId, orgModUsername),
      })
      assert.equal(orgModPrivate.statusCode, 200)

      const rsvpHolderPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/events/${rsvpPrivateEventId}`,
        headers: cookieHeader(rsvpUserId, rsvpUsername),
      })
      assert.equal(rsvpHolderPrivate.statusCode, 200)

      const globalAnon = await app.inject({ method: 'GET', url: '/api/v1/events' })
      assert.equal(globalAnon.statusCode, 200)
      const globalAnonIds = ((globalAnon.json() as { items?: Array<{ id: string }> }).items ?? []).map((e) => e.id)
      assert.ok(globalAnonIds.includes(publicEventId))
      assert.ok(!globalAnonIds.includes(privateEventId))
      assert.ok(!globalAnonIds.includes(privateGroupEventId))
      assert.ok(!globalAnonIds.includes(privateOrgEventId))
    } finally {
      await app.close()
    }
  })
})
