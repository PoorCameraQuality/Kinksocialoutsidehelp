/**
 * DB smoke: group forum thread creation emits feed activity with privacy filtering.
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

describe('group forum activity (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const publicGroupId = randomUUID()
  const privateGroupId = randomUUID()
  const userIds: string[] = []
  const threadIds: string[] = []
  let authorId = ''
  let authorUsername = ''
  let followerId = ''
  let followerUsername = ''
  let strangerId = ''
  let strangerUsername = ''
  let prevInline: string | undefined

  before(() => {
    prevInline = process.env.C2K_FEED_ACTIVITIES_INLINE
    process.env.C2K_FEED_ACTIVITIES_INLINE = 'true'
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    process.env.C2K_FEED_ACTIVITIES_INLINE = prevInline
    if (threadIds.length) {
      await db.delete(schema.forumPosts).where(inArray(schema.forumPosts.threadId, threadIds))
      await db.delete(schema.forumThreads).where(inArray(schema.forumThreads.id, threadIds))
    }
    if (authorId) {
      await db.delete(schema.feedActivities).where(eq(schema.feedActivities.actorId, authorId))
    }
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, publicGroupId))
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, privateGroupId))
    await db.delete(schema.groups).where(eq(schema.groups.id, publicGroupId))
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

  test('thread creation emits activity visible only to allowed viewers', async () => {
    const author = await insertCiUser(`${tag}_author`)
    const follower = await insertCiUser(`${tag}_follower`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    authorId = author.id
    authorUsername = author.username
    followerId = follower.id
    followerUsername = follower.username
    strangerId = stranger.id
    strangerUsername = stranger.username
    userIds.push(authorId, followerId, strangerId)

    const now = new Date()
    for (const userId of userIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.connections).values({
      requesterId: followerId,
      recipientId: authorId,
      status: 'ACCEPTED',
      createdAt: now,
    })

    const settingsRow = await ensureUserSettingsRow(authorId)
    const privacy = mergePrivacySettings(settingsRow.privacySettings, {
      feedActivityPrivacy: { showComments: 'on' },
    })
    await db
      .update(schema.userSettings)
      .set({ privacySettings: privacy, updatedAt: now })
      .where(eq(schema.userSettings.userId, authorId))

    await db.insert(schema.groups).values({
      id: publicGroupId,
      slug: `ci-grp-public-${tag}`,
      name: `CI Public ${tag}`,
      ownerId: authorId,
      visibility: 'public',
    })
    await db.insert(schema.groups).values({
      id: privateGroupId,
      slug: `ci-grp-private-${tag}`,
      name: `CI Private ${tag}`,
      ownerId: authorId,
      visibility: 'private',
    })
    await db.insert(schema.groupMembers).values({
      groupId: publicGroupId,
      userId: authorId,
      role: 'owner',
      memberListVisibility: 'visible',
    })
    await db.insert(schema.groupMembers).values({
      groupId: privateGroupId,
      userId: authorId,
      role: 'owner',
      memberListVisibility: 'visible',
    })

    const app = await buildCookieApp(async (a) => {
      const { registerGroupForumRoutes } = await import('../routes/group-forums.js')
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerGroupForumRoutes(a)
      await registerFeedRoutes(a)
    })

    try {
      const publicThreadRes = await app.inject({
        method: 'POST',
        url: `/api/v1/groups/${publicGroupId}/forum/threads`,
        headers: {
          ...cookieHeader(authorId, authorUsername),
          'content-type': 'application/json',
        },
        payload: { title: `Public thread ${tag}`, body: 'Hello group' },
      })
      assert.equal(publicThreadRes.statusCode, 200)
      const publicThreadId = (JSON.parse(publicThreadRes.body) as { thread: { id: string } }).thread.id
      threadIds.push(publicThreadId)

      const activities = await db
        .select()
        .from(schema.feedActivities)
        .where(
          and(
            eq(schema.feedActivities.actorId, authorId),
            eq(schema.feedActivities.verb, 'group_thread_created'),
            eq(schema.feedActivities.objectId, publicThreadId),
          ),
        )
      assert.equal(activities.length, 1)
      const meta = activities[0]!.metadata as { groupName?: string; threadTitle?: string }
      assert.equal(meta.groupName, `CI Public ${tag}`)
      assert.equal(meta.threadTitle, `Public thread ${tag}`)

      const followerHome = await app.inject({
        method: 'GET',
        url: '/api/v1/feed/home?limit=20',
        headers: cookieHeader(followerId, followerUsername),
      })
      assert.equal(followerHome.statusCode, 200)
      const followerCards = (JSON.parse(followerHome.body) as {
        cards: Array<{ verb?: string; object?: Record<string, unknown>; deepLink?: string }>
      }).cards
      const publicCard = followerCards.find((c) => c.verb === 'group_thread_created')
      assert.ok(publicCard)
      assert.equal(publicCard!.object?.threadTitle, `Public thread ${tag}`)
      assert.equal(publicCard!.object?.groupName, `CI Public ${tag}`)
      assert.ok(publicCard!.deepLink?.includes(`thread=${encodeURIComponent(publicThreadId)}`))

      const privateThreadRes = await app.inject({
        method: 'POST',
        url: `/api/v1/groups/${privateGroupId}/forum/threads`,
        headers: {
          ...cookieHeader(authorId, authorUsername),
          'content-type': 'application/json',
        },
        payload: { title: `Private thread ${tag}`, body: 'Members only' },
      })
      assert.equal(privateThreadRes.statusCode, 200)
      const privateThreadId = (JSON.parse(privateThreadRes.body) as { thread: { id: string } }).thread.id
      threadIds.push(privateThreadId)

      const strangerHome = await app.inject({
        method: 'GET',
        url: '/api/v1/feed/home?limit=20',
        headers: cookieHeader(strangerId, strangerUsername),
      })
      assert.equal(strangerHome.statusCode, 200)
      const strangerCards = (JSON.parse(strangerHome.body) as {
        cards: Array<{ verb?: string; object?: Record<string, unknown> }>
      }).cards
      assert.equal(
        strangerCards.some(
          (c) => c.verb === 'group_thread_created' && c.object?.threadTitle === `Private thread ${tag}`,
        ),
        false,
      )

      await db.insert(schema.blocks).values({ blockerId: followerId, blockedId: authorId })
      const blockedHome = await app.inject({
        method: 'GET',
        url: '/api/v1/feed/home?limit=20',
        headers: cookieHeader(followerId, followerUsername),
      })
      assert.equal(blockedHome.statusCode, 200)
      const blockedCards = (JSON.parse(blockedHome.body) as { cards: Array<{ verb?: string }> }).cards
      assert.equal(blockedCards.some((c) => c.verb === 'group_thread_created'), false)
    } finally {
      await app.close()
    }
  })
})
