/**
 * DB smoke: activity metadata preview URLs respect media visibility.
 * Gated on CI_API_INTEGRATION_DB or CI_NOTIFICATIONS_DB.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import {
  MEDIA_CONTENT_RATINGS,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { mediaContentProxyPath } from '../lib/media-pipeline.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('feed activity metadata media visibility (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const postIds: string[] = []
  const activityIds: string[] = []
  const mediaItemIds: string[] = []
  const mediaAssetIds: string[] = []
  let ownerId = ''
  let ownerUsername = ''
  let followerId = ''
  let followerUsername = ''
  let privatePostId = ''
  let privateProxyUrl = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    if (activityIds.length) {
      await db.delete(schema.feedActivities).where(inArray(schema.feedActivities.id, activityIds))
    }
    if (postIds.length) {
      await db.delete(schema.feedPosts).where(inArray(schema.feedPosts.id, postIds))
    }
    if (mediaItemIds.length) {
      await db.delete(schema.mediaItems).where(inArray(schema.mediaItems.id, mediaItemIds))
    }
    if (mediaAssetIds.length) {
      await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, mediaAssetIds))
    }
    for (const userId of userIds) {
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, userId))
      await db.delete(schema.connections).where(eq(schema.connections.recipientId, userId))
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('following and home feeds omit hidden activity preview URLs for connected viewer', async () => {
    const owner = await insertCiUser(`${tag}_owner`)
    const follower = await insertCiUser(`${tag}_follower`)
    ownerId = owner.id
    ownerUsername = owner.username
    followerId = follower.id
    followerUsername = follower.username
    userIds.push(ownerId, followerId)

    const now = new Date()
    await db.insert(schema.connections).values({
      requesterId: followerId,
      recipientId: ownerId,
      status: 'ACCEPTED',
      createdAt: now,
    })

    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Owner', updatedAt: now })
      .returning({ id: schema.profiles.id })

    const [privateAsset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: ownerId,
        ownerType: 'profile',
        ownerId: profile!.id,
        sourceSurface: 'feed_post',
        storageKey: `public/${ownerId}/${tag}-private.jpg`,
        publicStorageKey: `public/${ownerId}/${tag}-private.jpg`,
        storageState: MEDIA_STORAGE_STATES.approvedPublic,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
        contentRating: MEDIA_CONTENT_RATINGS.safePublic,
        visibility: MEDIA_VISIBILITIES.privateProfile,
        updatedAt: now,
      })
      .returning({ id: schema.mediaAssets.id })
    mediaAssetIds.push(privateAsset!.id)
    privateProxyUrl = mediaContentProxyPath(privateAsset!.id)

    const [privateItem] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: ownerId,
        mediaAssetId: privateAsset!.id,
        mediaKind: 'image',
        visibility: MEDIA_VISIBILITIES.privateProfile,
        sourceSurface: 'feed_post',
        updatedAt: now,
      })
      .returning({ id: schema.mediaItems.id })
    mediaItemIds.push(privateItem!.id)

    const privateAttachment = {
      type: 'media' as const,
      mediaKind: 'image' as const,
      mediaItemId: privateItem!.id,
      mediaAssetId: privateAsset!.id,
      previewUrl: privateProxyUrl,
      visibility: MEDIA_VISIBILITIES.privateProfile,
    }

    const [post] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: ownerId,
        kind: 'status',
        body: `ci activity metadata ${tag}`,
        bodyFormat: 'text',
        attachments: [privateAttachment],
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    privatePostId = post!.id
    postIds.push(privatePostId)

    const [activity] = await db
      .insert(schema.feedActivities)
      .values({
        actorId: ownerId,
        verb: 'loved',
        objectType: 'feed_post',
        objectId: privatePostId,
        metadata: {
          postAuthorUsername: ownerUsername,
          previewUrls: [privateProxyUrl, 'https://leaked.example.com/stale.jpg'],
          count: 1,
        },
        createdAt: now,
      })
      .returning({ id: schema.feedActivities.id })
    activityIds.push(activity!.id)

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const followerFollowing = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/following?limit=20',
      headers: cookieHeader(followerId, followerUsername),
    })
    assert.equal(followerFollowing.statusCode, 200)
    const items = (JSON.parse(followerFollowing.body) as {
      items: Array<{ kind: string; verb?: string; object?: { previewUrls?: string[] } }>
    }).items
    const loved = items.find((item) => item.kind === 'activity' && item.verb === 'loved')
    assert.ok(loved)
    assert.equal(loved.object?.previewUrls, undefined)

    // Owner's Following tab is FetLife-style: own activity must not appear.
    const ownerFollowing = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/following?limit=20',
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(ownerFollowing.statusCode, 200)
    const ownerItems = (JSON.parse(ownerFollowing.body) as {
      items: Array<{ kind: string; verb?: string; actor?: { id?: string }; object?: { previewUrls?: string[] } }>
    }).items
    const ownerLoved = ownerItems.find((item) => item.kind === 'activity' && item.verb === 'loved')
    assert.equal(ownerLoved, undefined)
    assert.ok(
      ownerItems.every((item) => item.actor?.id !== ownerId),
      'following feed must exclude the viewer',
    )

    const followerHome = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/home?limit=20',
      headers: cookieHeader(followerId, followerUsername),
    })
    assert.equal(followerHome.statusCode, 200)
    const cards = (JSON.parse(followerHome.body) as {
      cards: Array<{ cardType: string; verb?: string; object?: { previewUrls?: string[] } }>
    }).cards
    const homeLoved = cards.find((card) => card.cardType === 'activity' && card.verb === 'loved')
    assert.ok(homeLoved)
    assert.equal(homeLoved.object?.previewUrls, undefined)

    await app.close()
  })
})
