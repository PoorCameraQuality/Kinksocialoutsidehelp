/**
 * DB smoke: global feed and post permalink respect showPostsInFeeds and blocks.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq, inArray, and } from 'drizzle-orm'
import { defaultFeedActivityPrivacy } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('feed post global access (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const postIds: string[] = []
  let normalAuthorId = ''
  let privateAuthorId = ''
  let connAuthorId = ''
  let viewerId = ''
  let strangerId = ''
  let viewerUsername = ''
  let strangerUsername = ''
  let privatePostId = ''
  let connPostId = ''
  let normalPostId = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    if (postIds.length) {
      await db.delete(schema.feedPosts).where(inArray(schema.feedPosts.id, postIds))
    }
    if (userIds.length) {
      await db
        .delete(schema.blocks)
        .where(inArray(schema.blocks.blockerId, userIds))
      await db
        .delete(schema.connections)
        .where(inArray(schema.connections.requesterId, userIds))
    }
    for (const userId of userIds) {
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('local feed and permalink hide blocked and private posts', async () => {
    const normalAuthor = await insertCiUser(`${tag}_normal`)
    const privateAuthor = await insertCiUser(`${tag}_private`)
    const connAuthor = await insertCiUser(`${tag}_conn`)
    const viewer = await insertCiUser(`${tag}_viewer`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    normalAuthorId = normalAuthor.id
    privateAuthorId = privateAuthor.id
    connAuthorId = connAuthor.id
    viewerId = viewer.id
    strangerId = stranger.id
    viewerUsername = viewer.username
    strangerUsername = stranger.username
    userIds.push(normalAuthorId, privateAuthorId, connAuthorId, viewerId, strangerId)

    const now = new Date()
    for (const userId of userIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.userSettings).values({
      userId: privateAuthorId,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'only_me',
        },
      },
      updatedAt: now,
    })
    await db.insert(schema.userSettings).values({
      userId: connAuthorId,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'connections_only',
        },
      },
      updatedAt: now,
    })

    await db.insert(schema.connections).values({
      requesterId: viewerId,
      recipientId: connAuthorId,
      status: 'ACCEPTED',
    })

    const [normalPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: normalAuthorId,
        kind: 'status',
        body: `ci feed public ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [privatePost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: privateAuthorId,
        kind: 'status',
        body: `ci feed only_me ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [connPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: connAuthorId,
        kind: 'status',
        body: `ci feed connections_only ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    normalPostId = normalPost!.id
    privatePostId = privatePost!.id
    connPostId = connPost!.id
    postIds.push(normalPostId, privatePostId, connPostId)

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const strangerFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/feed?limit=80',
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerFeed.statusCode, 200)
    const strangerBodies = (JSON.parse(strangerFeed.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(strangerBodies.includes(`ci feed public ${tag}`))
    assert.ok(!strangerBodies.includes(`ci feed only_me ${tag}`))
    assert.ok(!strangerBodies.includes(`ci feed connections_only ${tag}`))

    const viewerFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/feed?limit=80',
      headers: cookieHeader(viewerId, viewerUsername),
    })
    assert.equal(viewerFeed.statusCode, 200)
    const viewerBodies = (JSON.parse(viewerFeed.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(viewerBodies.includes(`ci feed public ${tag}`))
    assert.ok(!viewerBodies.includes(`ci feed only_me ${tag}`))
    assert.ok(viewerBodies.includes(`ci feed connections_only ${tag}`))

    const privatePermalink = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${privatePostId}`,
      headers: cookieHeader(viewerId, viewerUsername),
    })
    assert.equal(privatePermalink.statusCode, 404)

    const ownPrivatePermalink = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${privatePostId}`,
      headers: cookieHeader(privateAuthorId, privateAuthor.username),
    })
    assert.equal(ownPrivatePermalink.statusCode, 200)

    await db.insert(schema.blocks).values({
      blockerId: viewerId,
      blockedId: normalAuthorId,
    })

    const blockedFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/feed?limit=80',
      headers: cookieHeader(viewerId, viewerUsername),
    })
    assert.equal(blockedFeed.statusCode, 200)
    const blockedBodies = (JSON.parse(blockedFeed.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(!blockedBodies.includes(`ci feed public ${tag}`))

    const blockedPermalink = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${normalPostId}`,
      headers: cookieHeader(viewerId, viewerUsername),
    })
    assert.equal(blockedPermalink.statusCode, 404)

    await app.close()
  })

  test('post-adjacent endpoints and quoted reposts respect access rules', async () => {
    const tag = `${randomUUID().slice(0, 8)}_adj`
    const normalAuthor = await insertCiUser(`${tag}_normal`)
    const privateAuthor = await insertCiUser(`${tag}_private`)
    const connAuthor = await insertCiUser(`${tag}_conn`)
    const viewer = await insertCiUser(`${tag}_viewer`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    const adjUserIds = [normalAuthor.id, privateAuthor.id, connAuthor.id, viewer.id, stranger.id]
    userIds.push(...adjUserIds)

    const now = new Date()
    for (const userId of adjUserIds) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.userSettings).values({
      userId: privateAuthor.id,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'only_me',
        },
      },
      updatedAt: now,
    })
    await db.insert(schema.userSettings).values({
      userId: connAuthor.id,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'connections_only',
        },
      },
      updatedAt: now,
    })

    await db.insert(schema.connections).values({
      requesterId: viewer.id,
      recipientId: connAuthor.id,
      status: 'ACCEPTED',
    })

    const [normalPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: normalAuthor.id,
        kind: 'status',
        body: `ci adj public ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [privatePost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: privateAuthor.id,
        kind: 'status',
        body: `ci adj only_me ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [connPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: connAuthor.id,
        kind: 'status',
        body: `ci adj connections_only ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const adjNormalPostId = normalPost!.id
    const adjPrivatePostId = privatePost!.id
    const adjConnPostId = connPost!.id
    postIds.push(adjNormalPostId, adjPrivatePostId, adjConnPostId)

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      const { registerBookmarkRoutes } = await import('../routes/bookmark-routes.js')
      await registerFeedRoutes(a)
      await registerBookmarkRoutes(a)
    })

    const strangerHeaders = cookieHeader(stranger.id, stranger.username)
    const viewerHeaders = cookieHeader(viewer.id, viewer.username)
    const privateHeaders = cookieHeader(privateAuthor.id, privateAuthor.username)

    const denyOnPrivate = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
      const res = await app.inject({
        method,
        url,
        headers: strangerHeaders,
        ...(payload ? { payload } : {}),
      })
      assert.equal(res.statusCode, 404, `${method} ${url}`)
    }

    await denyOnPrivate('GET', `/api/v1/feed/posts/${adjPrivatePostId}/comments`)
    await denyOnPrivate('POST', `/api/v1/feed/posts/${adjPrivatePostId}/comments`, { body: 'nope' })
    await denyOnPrivate('PUT', `/api/v1/feed/posts/${adjPrivatePostId}/reactions`, { kind: 'love' })
    await denyOnPrivate('POST', `/api/v1/feed/posts/${adjPrivatePostId}/repost`)
    await denyOnPrivate('POST', `/api/v1/me/bookmarks`, {
      objectType: 'feed_post',
      objectId: adjPrivatePostId,
    })

    const ownComment = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/posts/${adjPrivatePostId}/comments`,
      headers: privateHeaders,
      payload: { body: 'author comment ok' },
    })
    assert.equal(ownComment.statusCode, 200)

    const allowOnPublic = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
      const res = await app.inject({
        method,
        url,
        headers: strangerHeaders,
        ...(payload ? { payload } : {}),
      })
      assert.ok(res.statusCode >= 200 && res.statusCode < 300, `${method} ${url} -> ${res.statusCode}`)
    }

    await allowOnPublic('GET', `/api/v1/feed/posts/${adjNormalPostId}/comments`)
    await allowOnPublic('POST', `/api/v1/feed/posts/${adjNormalPostId}/comments`, { body: 'hello' })
    await allowOnPublic('PUT', `/api/v1/feed/posts/${adjNormalPostId}/reactions`, { kind: 'love' })
    const bookmarkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/me/bookmarks',
      headers: strangerHeaders,
      payload: { objectType: 'feed_post', objectId: adjNormalPostId },
    })
    assert.equal(bookmarkRes.statusCode, 200)

    await db.insert(schema.blocks).values({
      blockerId: normalAuthor.id,
      blockedId: viewer.id,
    })

    const blockedByAuthor = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${adjNormalPostId}/comments`,
      headers: viewerHeaders,
    })
    assert.equal(blockedByAuthor.statusCode, 404)

    await db.delete(schema.blocks).where(
      and(eq(schema.blocks.blockerId, normalAuthor.id), eq(schema.blocks.blockedId, viewer.id)),
    )
    await db.insert(schema.blocks).values({
      blockerId: viewer.id,
      blockedId: normalAuthor.id,
    })

    const viewerBlockedAuthor = await app.inject({
      method: 'PUT',
      url: `/api/v1/feed/posts/${adjNormalPostId}/reactions`,
      headers: viewerHeaders,
      payload: { kind: 'love' },
    })
    assert.equal(viewerBlockedAuthor.statusCode, 404)

    await db.delete(schema.blocks).where(
      and(eq(schema.blocks.blockerId, viewer.id), eq(schema.blocks.blockedId, normalAuthor.id)),
    )

    const connRepost = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/posts/${adjConnPostId}/repost`,
      headers: viewerHeaders,
    })
    assert.equal(connRepost.statusCode, 200)
    const connRepostId = (JSON.parse(connRepost.body) as { post: { id: string } }).post.id
    postIds.push(connRepostId)

    const connRepostPermalink = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${connRepostId}`,
      headers: strangerHeaders,
    })
    assert.equal(connRepostPermalink.statusCode, 200)
    const connRepostBody = JSON.parse(connRepostPermalink.body) as { post: { quotedPost?: { body: string } } }
    assert.equal(connRepostBody.post.quotedPost, undefined)

    const publicRepost = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/posts/${adjNormalPostId}/repost`,
      headers: viewerHeaders,
    })
    assert.equal(publicRepost.statusCode, 200)
    const publicRepostId = (JSON.parse(publicRepost.body) as { post: { id: string } }).post.id
    postIds.push(publicRepostId)

    const publicRepostPermalink = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${publicRepostId}`,
      headers: strangerHeaders,
    })
    assert.equal(publicRepostPermalink.statusCode, 200)
    const publicRepostBody = JSON.parse(publicRepostPermalink.body) as { post: { quotedPost?: { body: string } } }
    assert.equal(publicRepostBody.post.quotedPost?.body, `ci adj public ${tag}`)

    await app.close()
  })

  test('profile feed-posts endpoint respects access rules', async () => {
    const tag = `${randomUUID().slice(0, 8)}_prof`
    const normalAuthor = await insertCiUser(`${tag}_normal`)
    const privateAuthor = await insertCiUser(`${tag}_private`)
    const connAuthor = await insertCiUser(`${tag}_conn`)
    const viewer = await insertCiUser(`${tag}_viewer`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    userIds.push(normalAuthor.id, privateAuthor.id, connAuthor.id, viewer.id, stranger.id)

    const now = new Date()
    for (const userId of [normalAuthor.id, privateAuthor.id, connAuthor.id, viewer.id, stranger.id]) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.userSettings).values({
      userId: privateAuthor.id,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'only_me',
        },
      },
      updatedAt: now,
    })
    await db.insert(schema.userSettings).values({
      userId: connAuthor.id,
      privacySettings: {
        feedActivityPrivacy: {
          ...defaultFeedActivityPrivacy,
          showPostsInFeeds: 'connections_only',
        },
      },
      updatedAt: now,
    })

    await db.insert(schema.connections).values({
      requesterId: viewer.id,
      recipientId: connAuthor.id,
      status: 'ACCEPTED',
    })

    const [privatePost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: privateAuthor.id,
        kind: 'status',
        body: `ci profile only_me ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [connPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: connAuthor.id,
        kind: 'status',
        body: `ci profile connections_only ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [normalPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: normalAuthor.id,
        kind: 'status',
        body: `ci profile public ${tag}`,
        bodyFormat: 'text',
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    postIds.push(privatePost!.id, connPost!.id, normalPost!.id)

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const strangerPrivateProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(privateAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(strangerPrivateProfile.statusCode, 200)
    assert.equal(
      (JSON.parse(strangerPrivateProfile.body) as { items: unknown[] }).items.length,
      0,
    )

    const viewerConnProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(connAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(viewer.id, viewer.username),
    })
    assert.equal(viewerConnProfile.statusCode, 200)
    const viewerConnBodies = (JSON.parse(viewerConnProfile.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(viewerConnBodies.includes(`ci profile connections_only ${tag}`))

    const strangerConnProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(connAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(strangerConnProfile.statusCode, 200)
    assert.equal(
      (JSON.parse(strangerConnProfile.body) as { items: unknown[] }).items.length,
      0,
    )

    const ownerPrivateProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/me/feed-posts?limit=10`,
      headers: cookieHeader(privateAuthor.id, privateAuthor.username),
    })
    assert.equal(ownerPrivateProfile.statusCode, 200)
    const ownerBodies = (JSON.parse(ownerPrivateProfile.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(ownerBodies.includes(`ci profile only_me ${tag}`))

    const strangerNormalProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(normalAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(strangerNormalProfile.statusCode, 200)
    const strangerNormalBodies = (JSON.parse(strangerNormalProfile.body) as { items: { body: string }[] }).items.map(
      (i) => i.body,
    )
    assert.ok(strangerNormalBodies.includes(`ci profile public ${tag}`))

    await db.insert(schema.blocks).values({
      blockerId: viewer.id,
      blockedId: normalAuthor.id,
    })

    const blockedProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(normalAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(viewer.id, viewer.username),
    })
    assert.equal(blockedProfile.statusCode, 200)
    assert.equal((JSON.parse(blockedProfile.body) as { items: unknown[] }).items.length, 0)

    await db.delete(schema.blocks).where(
      and(eq(schema.blocks.blockerId, viewer.id), eq(schema.blocks.blockedId, normalAuthor.id)),
    )
    await db.insert(schema.blocks).values({
      blockerId: normalAuthor.id,
      blockedId: viewer.id,
    })

    const blockedByAuthorProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(normalAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(viewer.id, viewer.username),
    })
    assert.equal(blockedByAuthorProfile.statusCode, 200)
    assert.equal((JSON.parse(blockedByAuthorProfile.body) as { items: unknown[] }).items.length, 0)

    const unknownProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(`missing_${tag}`)}/feed-posts?limit=10`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(unknownProfile.statusCode, 404)

    const [quoteRepost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: normalAuthor.id,
        kind: 'status',
        body: `ci profile quote repost ${tag}`,
        bodyFormat: 'text',
        repostOfId: privatePost!.id,
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    postIds.push(quoteRepost!.id)

    const strangerQuoteProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(normalAuthor.username)}/feed-posts?limit=10`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(strangerQuoteProfile.statusCode, 200)
    const strangerQuoteItems = (JSON.parse(strangerQuoteProfile.body) as {
      items: Array<{ body: string; quotedPost?: { body: string } }>
    }).items
    const quoteItem = strangerQuoteItems.find((i) => i.body === `ci profile quote repost ${tag}`)
    assert.ok(quoteItem)
    assert.equal(quoteItem!.quotedPost, undefined)

    await app.close()
  })
})
