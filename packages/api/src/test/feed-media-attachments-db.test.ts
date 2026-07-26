/**
 * DB smoke: feed read paths re-check media attachment visibility.
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

describe('feed media attachment visibility (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const postIds: string[] = []
  const mediaItemIds: string[] = []
  const mediaAssetIds: string[] = []
  let ownerId = ''
  let ownerUsername = ''
  let strangerId = ''
  let strangerUsername = ''
  let profileId = ''
  let publicPostId = ''
  let privateMediaPostId = ''

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
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
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  test('feed and permalink omit private media attachments for other viewers', async () => {
    const owner = await insertCiUser(`${tag}_owner`)
    const stranger = await insertCiUser(`${tag}_stranger`)
    ownerId = owner.id
    ownerUsername = owner.username
    strangerId = stranger.id
    strangerUsername = stranger.username
    userIds.push(ownerId, strangerId)

    const now = new Date()
    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId: ownerId, displayName: 'Owner', updatedAt: now })
      .returning({ id: schema.profiles.id })
    profileId = profile!.id

    async function insertPublishedAsset(suffix: string) {
      const [asset] = await db
        .insert(schema.mediaAssets)
        .values({
          uploaderUserId: ownerId,
          ownerType: 'profile',
          ownerId: profileId,
          sourceSurface: 'feed_post',
          storageKey: `public/${ownerId}/${suffix}.jpg`,
          publicStorageKey: `public/${ownerId}/${suffix}.jpg`,
          storageState: MEDIA_STORAGE_STATES.approvedPublic,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
          contentRating: MEDIA_CONTENT_RATINGS.safePublic,
          visibility: MEDIA_VISIBILITIES.publicPreview,
          updatedAt: now,
        })
        .returning({ id: schema.mediaAssets.id })
      mediaAssetIds.push(asset!.id)
      return asset!.id
    }

    const publicAssetId = await insertPublishedAsset(`${tag}-public`)
    const privateAssetId = await insertPublishedAsset(`${tag}-private`)

    const [publicItem] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: ownerId,
        mediaAssetId: publicAssetId,
        mediaKind: 'image',
        visibility: MEDIA_VISIBILITIES.publicPreview,
        sourceSurface: 'feed_post',
        updatedAt: now,
      })
      .returning({ id: schema.mediaItems.id })
    const [privateItem] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: ownerId,
        mediaAssetId: privateAssetId,
        mediaKind: 'image',
        visibility: MEDIA_VISIBILITIES.privateProfile,
        sourceSurface: 'feed_post',
        updatedAt: now,
      })
      .returning({ id: schema.mediaItems.id })
    mediaItemIds.push(publicItem!.id, privateItem!.id)

    const publicAttachment = {
      type: 'media' as const,
      mediaKind: 'image' as const,
      mediaItemId: publicItem!.id,
      mediaAssetId: publicAssetId,
      previewUrl: mediaContentProxyPath(publicAssetId),
      visibility: MEDIA_VISIBILITIES.publicPreview,
    }
    const privateAttachment = {
      type: 'media' as const,
      mediaKind: 'image' as const,
      mediaItemId: privateItem!.id,
      mediaAssetId: privateAssetId,
      previewUrl: mediaContentProxyPath(privateAssetId),
      visibility: MEDIA_VISIBILITIES.privateProfile,
    }

    const [publicPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: ownerId,
        kind: 'status',
        body: `ci feed public media ${tag}`,
        bodyFormat: 'text',
        attachments: [publicAttachment],
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    const [privateMediaPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: ownerId,
        kind: 'status',
        body: `ci feed private media ${tag}`,
        bodyFormat: 'text',
        attachments: [privateAttachment],
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    publicPostId = publicPost!.id
    privateMediaPostId = privateMediaPost!.id
    postIds.push(publicPostId, privateMediaPostId)

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      const { registerBookmarkRoutes } = await import('../routes/bookmark-routes.js')
      await registerFeedRoutes(a)
      await registerBookmarkRoutes(a)
    })

    const strangerPermalinkPublic = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${publicPostId}`,
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerPermalinkPublic.statusCode, 200)
    const strangerPublicBody = JSON.parse(strangerPermalinkPublic.body) as {
      post: { attachments: Array<{ type: string; previewUrl?: string }> }
    }
    assert.equal(strangerPublicBody.post.attachments.length, 1)
    assert.ok(strangerPublicBody.post.attachments[0]?.previewUrl)

    const strangerPermalinkPrivateMedia = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${privateMediaPostId}`,
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerPermalinkPrivateMedia.statusCode, 200)
    const strangerPrivateBody = JSON.parse(strangerPermalinkPrivateMedia.body) as {
      post: { attachments: unknown[] }
    }
    assert.equal(strangerPrivateBody.post.attachments.length, 0)

    const ownerPermalinkPrivateMedia = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${privateMediaPostId}`,
      headers: cookieHeader(ownerId, ownerUsername),
    })
    assert.equal(ownerPermalinkPrivateMedia.statusCode, 200)
    const ownerPrivateBody = JSON.parse(ownerPermalinkPrivateMedia.body) as {
      post: { attachments: Array<{ previewUrl?: string }> }
    }
    assert.equal(ownerPrivateBody.post.attachments.length, 1)
    assert.ok(ownerPrivateBody.post.attachments[0]?.previewUrl)

    await app.inject({
      method: 'POST',
      url: '/api/v1/me/bookmarks',
      headers: cookieHeader(strangerId, strangerUsername),
      payload: { objectType: 'feed_post', objectId: privateMediaPostId },
    })

    const strangerBookmarks = await app.inject({
      method: 'GET',
      url: '/api/v1/me/bookmarks',
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerBookmarks.statusCode, 200)
    const bookmarkItems = (JSON.parse(strangerBookmarks.body) as {
      items: Array<{ objectId: string; post: { attachments: unknown[] } | null }>
    }).items
    const bookmarked = bookmarkItems.find((item) => item.objectId === privateMediaPostId)
    assert.ok(bookmarked?.post)
    assert.equal(bookmarked.post!.attachments.length, 0)

    const strangerProfilePosts = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${encodeURIComponent(ownerUsername)}/feed-posts?limit=10`,
      headers: cookieHeader(strangerId, strangerUsername),
    })
    assert.equal(strangerProfilePosts.statusCode, 200)
    const profileItems = (JSON.parse(strangerProfilePosts.body) as {
      items: Array<{ id: string; attachments: unknown[] }>
    }).items
    const profilePublic = profileItems.find((item) => item.id === publicPostId)
    const profilePrivateMedia = profileItems.find((item) => item.id === privateMediaPostId)
    assert.ok(profilePublic)
    assert.equal(profilePublic!.attachments.length, 1)
    assert.ok(profilePrivateMedia)
    assert.equal(profilePrivateMedia!.attachments.length, 0)

    await app.close()
  })
})
