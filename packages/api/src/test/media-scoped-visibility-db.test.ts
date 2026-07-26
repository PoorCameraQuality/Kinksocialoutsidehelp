/**
 * DB smoke: scoped media visibility on feed read paths.
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

describe('scoped media visibility (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const postIds: string[] = []
  const mediaItemIds: string[] = []
  const mediaAssetIds: string[] = []
  const groupIds: string[] = []
  const orgIds: string[] = []
  const eventIds: string[] = []
  const conventionIds: string[] = []

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
    for (const groupId of groupIds) {
      await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId))
      await db.delete(schema.groups).where(eq(schema.groups.id, groupId))
    }
    for (const eventId of eventIds) {
      await db.delete(schema.eventRsvps).where(eq(schema.eventRsvps.eventId, eventId))
      await db.delete(schema.events).where(eq(schema.events.id, eventId))
    }
    for (const conventionId of conventionIds) {
      await db.delete(schema.conventionRegistrants).where(eq(schema.conventionRegistrants.conventionId, conventionId))
      await db.delete(schema.conventionAccessGrants).where(eq(schema.conventionAccessGrants.conventionId, conventionId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, conventionId))
    }
    for (const orgId of orgIds) {
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    }
    for (const userId of userIds) {
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function insertPublishedAsset(ownerId: string, profileId: string, suffix: string) {
    const now = new Date()
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
        visibility: MEDIA_VISIBILITIES.loggedIn,
        updatedAt: now,
      })
      .returning({ id: schema.mediaAssets.id })
    mediaAssetIds.push(asset!.id)
    return asset!.id
  }

  async function insertScopedFeedPost(params: {
    ownerId: string
    profileId: string
    body: string
    visibility: string
    sourceGroupId?: string | null
    sourceEventId?: string | null
    sourceConventionId?: string | null
  }) {
    const assetId = await insertPublishedAsset(params.ownerId, params.profileId, `${tag}-${params.body.slice(0, 8)}`)
    const now = new Date()
    const [item] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: params.ownerId,
        mediaAssetId: assetId,
        mediaKind: 'image',
        visibility: params.visibility,
        sourceSurface: 'feed_post',
        sourceGroupId: params.sourceGroupId ?? null,
        sourceEventId: params.sourceEventId ?? null,
        sourceConventionId: params.sourceConventionId ?? null,
        updatedAt: now,
      })
      .returning({ id: schema.mediaItems.id })
    mediaItemIds.push(item!.id)

    const attachment = {
      type: 'media' as const,
      mediaKind: 'image' as const,
      mediaItemId: item!.id,
      mediaAssetId: assetId,
      previewUrl: mediaContentProxyPath(assetId),
      visibility: params.visibility,
    }

    const [post] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: params.ownerId,
        kind: 'status',
        body: params.body,
        bodyFormat: 'text',
        attachments: [attachment],
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    postIds.push(post!.id)
    return post!.id
  }

  test('group-only media respects membership on feed permalink', async () => {
    const owner = await insertCiUser(`${tag}_grp_owner`)
    const member = await insertCiUser(`${tag}_grp_member`)
    const stranger = await insertCiUser(`${tag}_grp_stranger`)
    userIds.push(owner.id, member.id, stranger.id)

    const groupId = randomUUID()
    groupIds.push(groupId)
    const now = new Date()
    for (const userId of [owner.id, member.id, stranger.id]) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.groups).values({
      id: groupId,
      slug: `ci-scoped-grp-${tag}`,
      name: 'Scoped Media Group',
      ownerId: owner.id,
      visibility: 'public',
    })
    await db.insert(schema.groupMembers).values({ groupId, userId: member.id, role: 'member' })

    const [profile] = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, owner.id))
      .limit(1)

    const postId = await insertScopedFeedPost({
      ownerId: owner.id,
      profileId: profile!.id,
      body: `ci scoped group ${tag}`,
      visibility: MEDIA_VISIBILITIES.groupOnly,
      sourceGroupId: groupId,
    })

    const missingScopePostId = await insertScopedFeedPost({
      ownerId: owner.id,
      profileId: profile!.id,
      body: `ci scoped group missing ${tag}`,
      visibility: MEDIA_VISIBILITIES.groupOnly,
      sourceGroupId: null,
    })

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const strangerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${postId}`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal(strangerRes.statusCode, 200)
    assert.equal((JSON.parse(strangerRes.body) as { post: { attachments: unknown[] } }).post.attachments.length, 0)

    const memberRes = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${postId}`,
      headers: cookieHeader(member.id, member.username),
    })
    assert.equal(memberRes.statusCode, 200)
    assert.equal((JSON.parse(memberRes.body) as { post: { attachments: unknown[] } }).post.attachments.length, 1)

    const ownerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${postId}`,
      headers: cookieHeader(owner.id, owner.username),
    })
    assert.equal((JSON.parse(ownerRes.body) as { post: { attachments: unknown[] } }).post.attachments.length, 1)

    const missingScope = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${missingScopePostId}`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal((JSON.parse(missingScope.body) as { post: { attachments: unknown[] } }).post.attachments.length, 0)

    await app.close()
  })

  test('org-only media respects org membership', async () => {
    const owner = await insertCiUser(`${tag}_org_owner`)
    const member = await insertCiUser(`${tag}_org_member`)
    const stranger = await insertCiUser(`${tag}_org_stranger`)
    userIds.push(owner.id, member.id, stranger.id)

    const orgId = randomUUID()
    orgIds.push(orgId)
    const now = new Date()
    for (const userId of [owner.id, member.id, stranger.id]) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-scoped-org-${tag}`,
      displayName: 'Scoped Media Org',
      ownerId: owner.id,
      visibility: 'MEMBERS',
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: member.id,
      role: 'MEMBER',
    })

    const eventId = randomUUID()
    eventIds.push(eventId)
    await db.insert(schema.events).values({
      id: eventId,
      hostId: owner.id,
      organizationId: orgId,
      title: 'Org scoped media event',
      startsAt: new Date(Date.now() + 86_400_000),
      visibility: 'public',
    })

    const ownerProfileId = (
      await db
        .select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, owner.id))
        .limit(1)
    )[0]!.id

    const postId = await insertScopedFeedPost({
      ownerId: owner.id,
      profileId: ownerProfileId,
      body: `ci scoped org ${tag}`,
      visibility: MEDIA_VISIBILITIES.orgOnly,
      sourceEventId: eventId,
    })

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    const strangerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${postId}`,
      headers: cookieHeader(stranger.id, stranger.username),
    })
    assert.equal((JSON.parse(strangerRes.body) as { post: { attachments: unknown[] } }).post.attachments.length, 0)

    const memberRes = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/posts/${postId}`,
      headers: cookieHeader(member.id, member.username),
    })
    assert.equal((JSON.parse(memberRes.body) as { post: { attachments: unknown[] } }).post.attachments.length, 1)

    await app.close()
  })

  test('event-attendee media respects going RSVP', async () => {
    const host = await insertCiUser(`${tag}_evt_host`)
    const attendee = await insertCiUser(`${tag}_evt_going`)
    const waitlist = await insertCiUser(`${tag}_evt_wait`)
    const stranger = await insertCiUser(`${tag}_evt_stranger`)
    userIds.push(host.id, attendee.id, waitlist.id, stranger.id)

    const eventId = randomUUID()
    eventIds.push(eventId)
    const now = new Date()
    for (const userId of [host.id, attendee.id, waitlist.id, stranger.id]) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.events).values({
      id: eventId,
      hostId: host.id,
      title: 'Scoped media event',
      startsAt: new Date(Date.now() + 86_400_000),
      visibility: 'public',
    })
    await db.insert(schema.eventRsvps).values({
      eventId,
      userId: attendee.id,
      status: 'going',
      rsvpApprovalStatus: 'not_required',
    })
    await db.insert(schema.eventRsvps).values({
      eventId,
      userId: waitlist.id,
      status: 'waitlist',
      rsvpApprovalStatus: 'not_required',
    })

    const profileId = (await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.userId, host.id)).limit(1))[0]!.id
    const postId = await insertScopedFeedPost({
      ownerId: host.id,
      profileId,
      body: `ci scoped event ${tag}`,
      visibility: MEDIA_VISIBILITIES.eventAttendees,
      sourceEventId: eventId,
    })

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    assert.equal(
      (JSON.parse((await app.inject({
        method: 'GET',
        url: `/api/v1/feed/posts/${postId}`,
        headers: cookieHeader(stranger.id, stranger.username),
      })).body) as { post: { attachments: unknown[] } }).post.attachments.length,
      0,
    )
    assert.equal(
      (JSON.parse((await app.inject({
        method: 'GET',
        url: `/api/v1/feed/posts/${postId}`,
        headers: cookieHeader(waitlist.id, waitlist.username),
      })).body) as { post: { attachments: unknown[] } }).post.attachments.length,
      0,
    )
    assert.equal(
      (JSON.parse((await app.inject({
        method: 'GET',
        url: `/api/v1/feed/posts/${postId}`,
        headers: cookieHeader(attendee.id, attendee.username),
      })).body) as { post: { attachments: unknown[] } }).post.attachments.length,
      1,
    )

    await app.close()
  })

  test('convention-attendee media respects registrant access', async () => {
    const owner = await insertCiUser(`${tag}_conv_owner`)
    const registrant = await insertCiUser(`${tag}_conv_reg`)
    const stranger = await insertCiUser(`${tag}_conv_stranger`)
    userIds.push(owner.id, registrant.id, stranger.id)

    const orgId = randomUUID()
    const conventionId = randomUUID()
    orgIds.push(orgId)
    conventionIds.push(conventionId)
    const now = new Date()
    for (const userId of [owner.id, registrant.id, stranger.id]) {
      await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    }

    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-scoped-conv-org-${tag}`,
      displayName: 'Scoped Conv Org',
      ownerId: owner.id,
    })
    const starts = new Date(Date.now() + 7 * 86_400_000)
    await db.insert(schema.conventions).values({
      id: conventionId,
      slug: `ci-scoped-conv-${tag}`,
      name: 'Scoped Conv',
      organizationId: orgId,
      startsAt: starts,
      endsAt: new Date(starts.getTime() + 3 * 86_400_000),
    })
    await db.insert(schema.conventionRegistrants).values({
      conventionId,
      userId: registrant.id,
      displayName: 'Registrant',
      email: `${registrant.username}@ci.c2k.test`,
    })

    const profileId = (await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.userId, owner.id)).limit(1))[0]!.id
    const postId = await insertScopedFeedPost({
      ownerId: owner.id,
      profileId,
      body: `ci scoped convention ${tag}`,
      visibility: MEDIA_VISIBILITIES.conventionAttendees,
      sourceConventionId: conventionId,
    })

    const app = await buildCookieApp(async (a) => {
      const { registerFeedRoutes } = await import('../routes/feed-routes.js')
      await registerFeedRoutes(a)
    })

    assert.equal(
      (JSON.parse((await app.inject({
        method: 'GET',
        url: `/api/v1/feed/posts/${postId}`,
        headers: cookieHeader(stranger.id, stranger.username),
      })).body) as { post: { attachments: unknown[] } }).post.attachments.length,
      0,
    )
    assert.equal(
      (JSON.parse((await app.inject({
        method: 'GET',
        url: `/api/v1/feed/posts/${postId}`,
        headers: cookieHeader(registrant.id, registrant.username),
      })).body) as { post: { attachments: unknown[] } }).post.attachments.length,
      1,
    )

    await app.close()
  })
})
