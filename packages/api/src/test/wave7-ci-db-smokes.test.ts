/**
 * Wave 7 - DB-backed CI integration smokes for alpha-gate risks.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB (see check-db workflow).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { encodeSession, SESSION_COOKIE_NAME } from '@c2k/shared/session-token'
import { db, schema } from '../db/index.js'
import { hashSecret } from '../routes/convention-organizer/shared.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('Wave 7 CI DB integration smokes', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.scopeBans).where(eq(schema.scopeBans.userId, userId))
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.authorId, userId))
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.authorId, userId))
      await db.delete(schema.orgChannelMessages).where(eq(schema.orgChannelMessages.senderId, userId))
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.userId, userId))
      await db.delete(schema.groupMembers).where(eq(schema.groupMembers.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function trackUser(tagSuffix: string) {
    const u = await insertCiUser(`${tag}_${tagSuffix}`)
    userIds.push(u.id)
    return u
  }

  describe('calendar feed token behavior', () => {
    const convId = randomUUID()
    const orgId = randomUUID()
    const ownerId = randomUUID()
    const slug = `ci-cal-${tag}`
    const rawToken = `feed-${tag}-valid`
    const revokedToken = `feed-${tag}-revoked`
    let feedId: string

    after(async () => {
      await db
        .delete(schema.conventionCalendarFeedTokens)
        .where(eq(schema.conventionCalendarFeedTokens.conventionId, convId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('valid token 200; invalid 404; revoked 410', async () => {
      userIds.push(ownerId)
      await db.insert(schema.users).values({
        id: ownerId,
        username: `ci_cal_owner_${tag}`,
        email: `ci_cal_owner_${tag}@ci.c2k.test`,
        passwordHash: 'ci',
      })
      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-org-cal-${tag}`,
        displayName: 'CI Calendar Org',
        ownerId,
      })
      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ends = new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000)
      await db.insert(schema.conventions).values({
        id: convId,
        slug,
        name: 'CI Calendar Conv',
        organizationId: orgId,
        startsAt: starts,
        endsAt: ends,
      })
      const [feed] = await db
        .insert(schema.conventionCalendarFeedTokens)
        .values({
          conventionId: convId,
          tokenHash: hashSecret(rawToken),
          label: 'CI smoke',
          scope: 'full',
        })
        .returning()
      feedId = feed!.id
      await db.insert(schema.conventionCalendarFeedTokens).values({
        conventionId: convId,
        tokenHash: hashSecret(revokedToken),
        label: 'CI revoked',
        scope: 'full',
        revokedAt: new Date(),
      })

      const app = await buildCookieApp(async (a) => {
        const { registerConventionRoutes } = await import('../routes/conventions-routes.js')
        await registerConventionRoutes(a)
      })

      try {
        const valid = await app.inject({
          method: 'GET',
          url: `/api/v1/conventions/${slug}/calendar-feed/${rawToken}.ics`,
        })
        assert.equal(valid.statusCode, 200)
        assert.match(String(valid.headers['content-type'] ?? ''), /text\/calendar/)

        const invalid = await app.inject({
          method: 'GET',
          url: `/api/v1/conventions/${slug}/calendar-feed/not-a-real-token`,
        })
        assert.equal(invalid.statusCode, 404)

        const revoked = await app.inject({
          method: 'GET',
          url: `/api/v1/conventions/${slug}/calendar-feed/${revokedToken}`,
        })
        assert.equal(revoked.statusCode, 410)
        const revokedBody = revoked.json() as { error?: string }
        assert.equal(revokedBody.error, 'Feed revoked')
      } finally {
        await app.close()
      }
      void feedId
    })
  })

  describe('door check-in parity', () => {
    const convId = randomUUID()
    const orgId = randomUUID()
    const slug = `ci-door-${tag}`
    let registrantId: string
    let doorActorId: string

    after(async () => {
      await db.delete(schema.conventionRegistrants).where(eq(schema.conventionRegistrants.conventionId, convId))
      await db
        .delete(schema.conventionRegistrationCategories)
        .where(eq(schema.conventionRegistrationCategories.conventionId, convId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('early check-in 409; override succeeds with checked_in', async () => {
      const doorActor = await trackUser('door_actor')
      doorActorId = doorActor.id
      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-org-door-${tag}`,
        displayName: 'CI Door Org',
        ownerId: doorActorId,
      })
      await db.insert(schema.organizationMembers).values({
        organizationId: orgId,
        userId: doorActorId,
        role: 'OWNER',
      })
      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ends = new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000)
      await db.insert(schema.conventions).values({
        id: convId,
        slug,
        name: 'CI Door Conv',
        organizationId: orgId,
        startsAt: starts,
        endsAt: ends,
      })
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const [category] = await db
        .insert(schema.conventionRegistrationCategories)
        .values({
          conventionId: convId,
          name: 'Attendee',
          checkInValidFrom: future,
        })
        .returning()
      const [registrant] = await db
        .insert(schema.conventionRegistrants)
        .values({
          conventionId: convId,
          categoryId: category!.id,
          displayName: 'CI Registrant',
          email: `ci-reg-${tag}@ci.c2k.test`,
          registrationStatus: 'confirmed',
        })
        .returning()
      registrantId = registrant!.id

      const app = await buildCookieApp(async (a: FastifyInstance) => {
        const { createRegistrar } = await import('../routes/convention-organizer/shared.js')
        const { registerDoorRoutes } = await import('../routes/convention-organizer/door-routes.js')
        const registered: string[] = []
        registerDoorRoutes(createRegistrar(a, registered))
      })

      try {
        const early = await app.inject({
          method: 'POST',
          url: `/api/v1/conventions/${slug}/registrants/check-in`,
          headers: {
            ...cookieHeader(doorActorId, doorActor.username),
            'content-type': 'application/json',
          },
          payload: { registrantId },
        })
        assert.equal(early.statusCode, 409)
        const earlyBody = early.json() as { code?: string }
        assert.equal(earlyBody.code, 'EARLY_CHECK_IN')

        const override = await app.inject({
          method: 'POST',
          url: `/api/v1/conventions/${slug}/registrants/check-in`,
          headers: {
            ...cookieHeader(doorActorId, doorActor.username),
            'content-type': 'application/json',
          },
          payload: { registrantId, earlyCheckInOverride: true },
        })
        assert.equal(override.statusCode, 200)
        const body = override.json() as { registrant?: { status?: string } }
        assert.equal(body.registrant?.status, 'checked_in')

        const [row] = await db
          .select({ registrationStatus: schema.conventionRegistrants.registrationStatus })
          .from(schema.conventionRegistrants)
          .where(eq(schema.conventionRegistrants.id, registrantId))
          .limit(1)
        assert.equal(row?.registrationStatus, 'checked_in')
      } finally {
        await app.close()
      }
    })
  })

  describe('org scope-ban enforcement', () => {
    const orgId = randomUUID()
    const channelId = randomUUID()
    const threadId = randomUUID()
    let ownerId: string
    let bannedId: string
    let allowedId: string
    const orgSlug = `ci-org-ban-${tag}`

    after(async () => {
      await db.delete(schema.scopeBans).where(eq(schema.scopeBans.scopeId, orgId))
      await db.delete(schema.orgChannelMessages).where(eq(schema.orgChannelMessages.orgChannelId, channelId))
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.threadId, threadId))
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.id, threadId))
      await db.delete(schema.orgChannels).where(eq(schema.orgChannels.id, channelId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('banned user cannot chat or forum write; allowed user succeeds', async () => {
      const owner = await trackUser('org_owner')
      const banned = await trackUser('org_banned')
      const allowed = await trackUser('org_allowed')
      ownerId = owner.id
      bannedId = banned.id
      allowedId = allowed.id

      await db.insert(schema.organizations).values({
        id: orgId,
        slug: orgSlug,
        displayName: 'CI Ban Org',
        ownerId,
      })
      for (const [userId, role] of [
        [ownerId, 'OWNER'],
        [bannedId, 'MEMBER'],
        [allowedId, 'MEMBER'],
      ] as const) {
        await db.insert(schema.organizationMembers).values({
          organizationId: orgId,
          userId,
          role,
        })
      }
      await db.insert(schema.scopeBans).values({
        scopeType: 'organization',
        scopeId: orgId,
        userId: bannedId,
        bannedByUserId: ownerId,
        active: true,
      })
      await db.insert(schema.orgChannels).values({
        id: channelId,
        organizationId: orgId,
        slug: 'general',
        name: 'General',
        kind: 'TEXT',
      })
      await db.insert(schema.forumThreads).values({
        id: threadId,
        organizationId: orgId,
        title: 'CI thread',
        authorId: ownerId,
      })

      const app = await buildCookieApp(async (a) => {
        const { registerOrganizationRoutes } = await import('../routes/organizations.js')
        await registerOrganizationRoutes(a)
      })

      try {
        const bannedChat = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgSlug}/channels/${channelId}/messages`,
          headers: {
            ...cookieHeader(bannedId, banned.username),
            'content-type': 'application/json',
          },
          payload: { body: 'should fail' },
        })
        assert.equal(bannedChat.statusCode, 403)
        assert.match(bannedChat.json().error ?? '', /banned/i)

        const bannedThread = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgSlug}/forum/threads`,
          headers: {
            ...cookieHeader(bannedId, banned.username),
            'content-type': 'application/json',
          },
          payload: { title: 'Nope', body: 'blocked' },
        })
        assert.equal(bannedThread.statusCode, 403)

        const bannedReply = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgSlug}/forum/threads/${threadId}/posts`,
          headers: {
            ...cookieHeader(bannedId, banned.username),
            'content-type': 'application/json',
          },
          payload: { body: 'also blocked' },
        })
        assert.equal(bannedReply.statusCode, 403)

        const allowedChat = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgSlug}/channels/${channelId}/messages`,
          headers: {
            ...cookieHeader(allowedId, allowed.username),
            'content-type': 'application/json',
          },
          payload: { body: 'hello from allowed' },
        })
        assert.equal(allowedChat.statusCode, 200)

        const allowedThread = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgSlug}/forum/threads`,
          headers: {
            ...cookieHeader(allowedId, allowed.username),
            'content-type': 'application/json',
          },
          payload: { title: 'Allowed thread', body: 'first post' },
        })
        assert.equal(allowedThread.statusCode, 200)
      } finally {
        await app.close()
      }
    })
  })

  describe('group locked thread enforcement', () => {
    const groupId = randomUUID()
    const lockedThreadId = randomUUID()
    const openThreadId = randomUUID()
    const groupSlug = `ci-grp-lock-${tag}`
    let ownerId: string
    let memberId: string
    let modId: string

    after(async () => {
      await db.delete(schema.forumPosts).where(
        and(
          eq(schema.forumPosts.threadId, lockedThreadId),
        ),
      )
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.threadId, openThreadId))
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.groupId, groupId))
      await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
      await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    })

    test('non-mod blocked on locked thread; mod bypass; open thread allows member', async () => {
      const owner = await trackUser('grp_owner')
      const member = await trackUser('grp_member')
      const mod = await trackUser('grp_mod')
      ownerId = owner.id
      memberId = member.id
      modId = mod.id

      await db.insert(schema.groups).values({
        id: groupId,
        slug: groupSlug,
        name: 'CI Lock Group',
        ownerId,
      })
      await db.insert(schema.groupMembers).values({ groupId, userId: ownerId, role: 'owner' })
      await db.insert(schema.groupMembers).values({ groupId, userId: memberId, role: 'member' })
      await db.insert(schema.groupMembers).values({ groupId, userId: modId, role: 'moderator' })
      await db.insert(schema.forumThreads).values({
        id: lockedThreadId,
        groupId,
        title: 'Locked',
        authorId: ownerId,
        lockedAt: new Date(),
        lockedByUserId: ownerId,
      })
      await db.insert(schema.forumThreads).values({
        id: openThreadId,
        groupId,
        title: 'Open',
        authorId: ownerId,
      })

      const app = await buildCookieApp(async (a) => {
        const { registerGroupForumRoutes } = await import('../routes/group-forums.js')
        await registerGroupForumRoutes(a)
      })

      try {
        const memberLocked = await app.inject({
          method: 'POST',
          url: `/api/v1/groups/${groupSlug}/forum/threads/${lockedThreadId}/posts`,
          headers: {
            ...cookieHeader(memberId, member.username),
            'content-type': 'application/json',
          },
          payload: { body: 'blocked' },
        })
        assert.equal(memberLocked.statusCode, 403)
        assert.equal(memberLocked.json().error, 'Thread is locked')

        const modLocked = await app.inject({
          method: 'POST',
          url: `/api/v1/groups/${groupSlug}/forum/threads/${lockedThreadId}/posts`,
          headers: {
            ...cookieHeader(modId, mod.username),
            'content-type': 'application/json',
          },
          payload: { body: 'mod reply ok' },
        })
        assert.equal(modLocked.statusCode, 200)

        const memberOpen = await app.inject({
          method: 'POST',
          url: `/api/v1/groups/${groupSlug}/forum/threads/${openThreadId}/posts`,
          headers: {
            ...cookieHeader(memberId, member.username),
            'content-type': 'application/json',
          },
          payload: { body: 'member reply ok' },
        })
        assert.equal(memberOpen.statusCode, 200)
      } finally {
        await app.close()
      }
    })
  })

  describe('ECKE publish bridge gating', () => {
    const convId = randomUUID()
    const orgId = randomUUID()
    const slug = `ci-ecke-${tag}`
    let adminId: string

    after(async () => {
      await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('publish returns 503 when bridge is not configured', async () => {
      const admin = await trackUser('ecke_admin')
      adminId = admin.id
      const prevEcke = process.env.ECKE_PUBLISH_ENABLED
      delete process.env.ECKE_PUBLISH_ENABLED

      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-org-ecke-${tag}`,
        displayName: 'CI ECKE Org',
        ownerId: adminId,
      })
      await db.insert(schema.organizationMembers).values({
        organizationId: orgId,
        userId: adminId,
        role: 'OWNER',
      })
      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const ends = new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000)
      await db.insert(schema.conventions).values({
        id: convId,
        slug,
        name: 'CI ECKE Conv',
        organizationId: orgId,
        startsAt: starts,
        endsAt: ends,
      })

      const app = await buildCookieApp(async (a) => {
        const { registerEckePublishControlRoutes } = await import('../routes/ecke-publish-control-routes.js')
        await registerEckePublishControlRoutes(a)
      })

      try {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/conventions/${slug}/ecke-publish/publish`,
          headers: {
            ...cookieHeader(adminId, admin.username),
            'content-type': 'application/json',
          },
          payload: {
            sourceKind: 'convention_event_anchor',
            sourceId: convId,
          },
        })
        assert.equal(res.statusCode, 503)
        assert.match(res.json().error ?? '', /not configured/i)
      } finally {
        if (prevEcke !== undefined) process.env.ECKE_PUBLISH_ENABLED = prevEcke
        await app.close()
      }
    })
  })

  describe('WS subscribe and LiveKit scope-ban parity', () => {
    const orgId = randomUUID()
    const textChannelId = randomUUID()
    const voiceChannelId = randomUUID()
    const gatedChannelId = randomUUID()
    const wsConvId = randomUUID()
    let ownerId: string
    let ownerUsername: string
    let bannedId: string
    let allowedId: string
    let allowedUsername: string

    after(async () => {
      await db.delete(schema.conventionAccessGrants).where(eq(schema.conventionAccessGrants.conventionId, wsConvId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, wsConvId))
      await db.delete(schema.scopeBans).where(eq(schema.scopeBans.scopeId, orgId))
      await db.delete(schema.orgChannels).where(eq(schema.orgChannels.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('scope-banned user cannot WS subscribe or receive LiveKit voice token', async () => {
      const owner = await trackUser('ws_owner')
      const banned = await trackUser('ws_banned')
      const allowed = await trackUser('ws_allowed')
      ownerId = owner.id
      ownerUsername = owner.username
      bannedId = banned.id
      allowedId = allowed.id
      allowedUsername = allowed.username

      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-ws-${tag}`,
        displayName: 'CI WS Org',
        ownerId,
      })
      for (const [userId, role] of [
        [ownerId, 'OWNER'],
        [bannedId, 'MEMBER'],
        [allowedId, 'MEMBER'],
      ] as const) {
        await db.insert(schema.organizationMembers).values({
          organizationId: orgId,
          userId,
          role,
        })
      }
      await db.insert(schema.scopeBans).values({
        scopeType: 'organization',
        scopeId: orgId,
        userId: bannedId,
        bannedByUserId: ownerId,
        active: true,
      })
      await db.insert(schema.orgChannels).values({
        id: textChannelId,
        organizationId: orgId,
        slug: 'chat',
        name: 'Chat',
        kind: 'TEXT',
      })
      await db.insert(schema.orgChannels).values({
        id: voiceChannelId,
        organizationId: orgId,
        slug: 'voice',
        name: 'Voice',
        kind: 'VOICE',
      })

      const scope = `org:${orgId}:channel:${textChannelId}`
      const { authorizeWebSocketSubscribe } = await import('../lib/ws-subscribe-auth.js')
      ensureCiAuthSecret()

      const wsCookie = (userId: string, username: string): FastifyRequest =>
        ({ cookies: { [SESSION_COOKIE_NAME]: encodeSession({ sub: userId, username }) } }) as unknown as FastifyRequest

      assert.equal(await authorizeWebSocketSubscribe(wsCookie(bannedId, banned.username), scope), false)
      assert.equal(await authorizeWebSocketSubscribe(wsCookie(allowedId, allowed.username), scope), true)

      const prevKey = process.env.LIVEKIT_API_KEY
      const prevSecret = process.env.LIVEKIT_API_SECRET
      const prevUrl = process.env.LIVEKIT_URL
      process.env.LIVEKIT_API_KEY = 'ci-test-key'
      process.env.LIVEKIT_API_SECRET = 'ci-test-secret'
      process.env.LIVEKIT_URL = 'wss://ci-livekit.example'

      const app = await buildCookieApp(async (a) => {
        const { registerLiveKitVoiceRoutes } = await import('../routes/livekit-voice-routes.js')
        await registerLiveKitVoiceRoutes(a)
      })

      try {
        const bannedVoice = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/channels/${voiceChannelId}/voice/token`,
          headers: cookieHeader(bannedId, banned.username),
        })
        assert.equal(bannedVoice.statusCode, 403)
        assert.match(bannedVoice.json().error ?? '', /banned/i)

        const allowedVoice = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgId}/channels/${voiceChannelId}/voice/token`,
          headers: cookieHeader(allowedId, allowed.username),
        })
        assert.equal(allowedVoice.statusCode, 200)
        assert.ok(allowedVoice.json().token)
      } finally {
        if (prevKey !== undefined) process.env.LIVEKIT_API_KEY = prevKey
        else delete process.env.LIVEKIT_API_KEY
        if (prevSecret !== undefined) process.env.LIVEKIT_API_SECRET = prevSecret
        else delete process.env.LIVEKIT_API_SECRET
        if (prevUrl !== undefined) process.env.LIVEKIT_URL = prevUrl
        else delete process.env.LIVEKIT_URL
        await app.close()
      }
    })

    test('convention-gated channel requires convention access over WS (PR 3 Z1)', async () => {
      const attendee = await trackUser('ws_attendee')

      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await db.insert(schema.conventions).values({
        id: wsConvId,
        slug: `ci-ws-conv-${tag}`,
        name: 'CI WS Conv',
        organizationId: orgId,
        startsAt: starts,
        endsAt: new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000),
      })
      await db.insert(schema.organizationMembers).values({
        organizationId: orgId,
        userId: attendee.id,
        role: 'MEMBER',
      })
      await db.insert(schema.conventionAccessGrants).values({
        conventionId: wsConvId,
        userId: attendee.id,
        paidConfirmed: true,
        attendingConfirmed: true,
      })
      await db.insert(schema.orgChannels).values({
        id: gatedChannelId,
        organizationId: orgId,
        slug: 'con-chat',
        name: 'Con Chat',
        kind: 'TEXT',
        requiresConventionId: wsConvId,
      })

      const scope = `org:${orgId}:channel:${gatedChannelId}`
      const { authorizeWebSocketSubscribe } = await import('../lib/ws-subscribe-auth.js')
      ensureCiAuthSecret()
      const wsCookie = (userId: string, username: string): FastifyRequest =>
        ({ cookies: { [SESSION_COOKIE_NAME]: encodeSession({ sub: userId, username }) } }) as unknown as FastifyRequest

      // Plain org member without convention access: HTTP denies — WS must too.
      assert.equal(await authorizeWebSocketSubscribe(wsCookie(allowedId, allowedUsername), scope), false)
      // Paid+attending grant: allowed.
      assert.equal(await authorizeWebSocketSubscribe(wsCookie(attendee.id, attendee.username), scope), true)
      // Org owner (manager): allowed.
      assert.equal(await authorizeWebSocketSubscribe(wsCookie(ownerId, ownerUsername), scope), true)
    })
  })
})
