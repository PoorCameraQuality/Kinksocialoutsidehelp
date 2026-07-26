/**
 * Scoped moderation - target aliases and group/event/convention permission gates.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  normalizeModerationReportTargetType,
  toLegacyContextTargetType,
} from '../lib/moderation-ts-target-validate.js'
import {
  buildCookieApp,
  cookieHeader,
  ensureCiAuthSecret,
  insertCiUser,
} from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('moderation report target aliases', () => {
  test('normalizes legacy web aliases to canonical types', () => {
    assert.equal(normalizeModerationReportTargetType('feed_post'), 'post')
    assert.equal(
      normalizeModerationReportTargetType('convention_hub_channel_message'),
      'convention_chat_message'
    )
    assert.equal(normalizeModerationReportTargetType('conversation'), 'conversation')
    assert.equal(normalizeModerationReportTargetType('media_episode'), 'media_episode')
    assert.equal(normalizeModerationReportTargetType('education_article'), 'education_article')
    assert.equal(normalizeModerationReportTargetType('media_show'), 'media_show')
  })

  test('maps canonical types to legacy context resolver names', () => {
    assert.equal(toLegacyContextTargetType('convention_chat_message'), 'convention_hub_channel_message')
    assert.equal(toLegacyContextTargetType('post'), 'feed_post')
    assert.equal(toLegacyContextTargetType('org_chat_message'), 'org_channel_message')
    assert.equal(toLegacyContextTargetType('media_show'), 'media_show')
  })
})

describe('scoped moderation permissions', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []

  after(async () => {
    for (const userId of userIds) {
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function trackUser(label: string) {
    const user = await insertCiUser(`scoped_mod_${label}_${tag}`)
    userIds.push(user.id)
    return user
  }

  describe('group moderation', () => {
    const groupId = randomUUID()
    const threadId = randomUUID()
    let memberId: string
    let modId: string

    after(async () => {
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.id, threadId))
      await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
      await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    })

    test('non-mod forbidden; group mod may lock thread', async () => {
      ensureCiAuthSecret()
      const owner = await trackUser('grp_own')
      const member = await trackUser('grp_mem')
      const mod = await trackUser('grp_mod')
      memberId = member.id
      modId = mod.id

      await db.insert(schema.groups).values({
        id: groupId,
        slug: `ci-scoped-grp-${tag}`,
        name: 'Scoped Mod Group',
        ownerId: owner.id,
      })
      await db.insert(schema.groupMembers).values({ groupId, userId: owner.id, role: 'owner' })
      await db.insert(schema.groupMembers).values({ groupId, userId: memberId, role: 'member' })
      await db.insert(schema.groupMembers).values({ groupId, userId: modId, role: 'moderator' })
      await db.insert(schema.forumThreads).values({
        id: threadId,
        groupId,
        title: 'Group thread',
        authorId: owner.id,
      })

      const app = await buildCookieApp(async (a) => {
        const { registerGroupModerationRoutes } = await import('../routes/group-moderation.js')
        await registerGroupModerationRoutes(a)
      })

      try {
        const forbidden = await app.inject({
          method: 'POST',
          url: `/api/v1/groups/${groupId}/forum/threads/${threadId}/moderate`,
          headers: {
            ...cookieHeader(memberId, member.username),
            'content-type': 'application/json',
          },
          payload: { locked: true },
        })
        assert.equal(forbidden.statusCode, 403)

        const ok = await app.inject({
          method: 'POST',
          url: `/api/v1/groups/${groupId}/forum/threads/${threadId}/moderate`,
          headers: {
            ...cookieHeader(modId, mod.username),
            'content-type': 'application/json',
          },
          payload: { locked: true },
        })
        assert.equal(ok.statusCode, 200)
        assert.equal(ok.json().ok, true)
      } finally {
        await app.close()
      }
    })
  })

  describe('event moderation', () => {
    const eventId = randomUUID()
    const threadId = randomUUID()
    const postId = randomUUID()
    let hostId: string
    let strangerId: string

    after(async () => {
      await db.delete(schema.forumPosts).where(eq(schema.forumPosts.id, postId))
      await db.delete(schema.forumThreads).where(eq(schema.forumThreads.id, threadId))
      await db.delete(schema.events).where(eq(schema.events.id, eventId))
    })

    test('host may hide post; non-host forbidden', async () => {
      ensureCiAuthSecret()
      const host = await trackUser('evt_host')
      const stranger = await trackUser('evt_str')
      hostId = host.id
      strangerId = stranger.id
      const starts = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.insert(schema.events).values({
        id: eventId,
        hostId,
        title: 'Scoped mod event',
        startsAt: starts,
        visibility: 'public',
      })
      await db.insert(schema.forumThreads).values({
        id: threadId,
        eventId,
        title: 'Event discussion',
        authorId: hostId,
      })
      await db.insert(schema.forumPosts).values({
        id: postId,
        threadId,
        authorId: hostId,
        body: 'test post',
      })

      const app = await buildCookieApp(async (a) => {
        const { registerEventModerationRoutes } = await import('../routes/event-moderation.js')
        await registerEventModerationRoutes(a)
      })

      try {
        const forbidden = await app.inject({
          method: 'POST',
          url: `/api/v1/events/${eventId}/forum/posts/${postId}/hide`,
          headers: cookieHeader(strangerId, stranger.username),
        })
        assert.equal(forbidden.statusCode, 403)

        const ok = await app.inject({
          method: 'POST',
          url: `/api/v1/events/${eventId}/forum/posts/${postId}/hide`,
          headers: cookieHeader(hostId, host.username),
        })
        assert.equal(ok.statusCode, 200)
        assert.equal(ok.json().ok, true)
      } finally {
        await app.close()
      }
    })
  })

  describe('convention hub chat hide', () => {
    const orgId = randomUUID()
    const convId = randomUUID()
    const channelId = randomUUID()
    const messageId = randomUUID()
    const convSlug = `ci-scoped-conv-${tag}`
    let adminId: string
    let attendeeId: string

    after(async () => {
      await db
        .delete(schema.conventionHubChannelMessages)
        .where(eq(schema.conventionHubChannelMessages.id, messageId))
      await db.delete(schema.conventionHubChannels).where(eq(schema.conventionHubChannels.id, channelId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, convId))
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    })

    test('staff may hide hub message; attendee forbidden', async () => {
      ensureCiAuthSecret()
      const admin = await trackUser('conv_admin')
      const attendee = await trackUser('conv_att')
      adminId = admin.id
      attendeeId = attendee.id
      const starts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await db.insert(schema.organizations).values({
        id: orgId,
        slug: `ci-scoped-org-${tag}`,
        displayName: 'Scoped Mod Org',
        ownerId: adminId,
      })
      await db.insert(schema.organizationMembers).values({
        organizationId: orgId,
        userId: adminId,
        role: 'ADMIN',
      })
      await db.insert(schema.conventions).values({
        id: convId,
        slug: convSlug,
        name: 'Scoped Mod Convention',
        organizationId: orgId,
        startsAt: starts,
        endsAt: new Date(starts.getTime() + 3 * 24 * 60 * 60 * 1000),
      })
      await db.insert(schema.conventionHubChannels).values({
        id: channelId,
        conventionId: convId,
        slug: 'general',
        name: 'General',
        kind: 'CHAT',
      })
      await db.insert(schema.conventionHubChannelMessages).values({
        id: messageId,
        channelId,
        senderId: attendeeId,
        body: 'message to hide',
      })

      const app = await buildCookieApp(async (a) => {
        const { registerConventionHubChannelsRoutes } = await import(
          '../routes/convention-hub-channels-routes.js'
        )
        await registerConventionHubChannelsRoutes(a)
      })

      try {
        const forbidden = await app.inject({
          method: 'POST',
          url: `/api/v1/conventions/${convSlug}/hub-channels/${channelId}/messages/${messageId}/hide`,
          headers: cookieHeader(attendeeId, attendee.username),
        })
        assert.equal(forbidden.statusCode, 403)

        const ok = await app.inject({
          method: 'POST',
          url: `/api/v1/conventions/${convSlug}/hub-channels/${channelId}/messages/${messageId}/hide`,
          headers: cookieHeader(adminId, admin.username),
        })
        assert.equal(ok.statusCode, 200)
        assert.equal(ok.json().ok, true)

        const [hidden] = await db
          .select({ hiddenAt: schema.conventionHubChannelMessages.hiddenAt })
          .from(schema.conventionHubChannelMessages)
          .where(eq(schema.conventionHubChannelMessages.id, messageId))
          .limit(1)
        assert.ok(hidden?.hiddenAt)
      } finally {
        await app.close()
      }
    })
  })
})
