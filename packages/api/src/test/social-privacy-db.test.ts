/**
 * DB smokes (launch-hardening PR 3 Batch 3): social privacy boundaries.
 * - P2 discovery counts exclude non-visible media for non-owners
 * - P3 inbox omits 1:1 threads with blocked partners
 * - P5 follow lists honor connectionsListVisibility
 * - P6 connections previews filter viewer↔peer blocks
 * - P7 ISO DM entry point requires readable ISO visibility
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
  defaultPrivacySettings,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { listConversationsForInbox } from '../lib/conversations-inbox.js'
import { loadDiscoveryProfileStats } from '../lib/discovery-profile-stats.js'
import { loadPublicProfileConnections } from '../lib/profile-connections.js'
import { loadPublicProfileFollows } from '../lib/profile-social-summary.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('social privacy boundaries (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const conversationIds: string[] = []
  const mediaAssetIds: string[] = []
  const mediaItemIds: string[] = []

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
    if (conversationIds.length) {
      await db.delete(schema.messages).where(inArray(schema.messages.conversationId, conversationIds))
      await db
        .delete(schema.conversationParticipants)
        .where(inArray(schema.conversationParticipants.conversationId, conversationIds))
      await db.delete(schema.conversations).where(inArray(schema.conversations.id, conversationIds))
    }
    if (mediaItemIds.length) {
      await db.delete(schema.mediaItems).where(inArray(schema.mediaItems.id, mediaItemIds))
    }
    if (mediaAssetIds.length) {
      await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, mediaAssetIds))
    }
    for (const userId of userIds) {
      await db.delete(schema.blocks).where(eq(schema.blocks.blockerId, userId))
      await db.delete(schema.blocks).where(eq(schema.blocks.blockedId, userId))
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, userId))
      await db.delete(schema.connections).where(eq(schema.connections.recipientId, userId))
      await db.delete(schema.userFollows).where(eq(schema.userFollows.followerId, userId))
      await db.delete(schema.userFollows).where(eq(schema.userFollows.followingId, userId))
      await db.delete(schema.userIsoPosts).where(eq(schema.userIsoPosts.userId, userId))
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, userId))
      await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function insertProfileAndSettings(userId: string, privacyOverrides: Record<string, unknown> = {}) {
    const now = new Date()
    await db.insert(schema.profiles).values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
    await db.insert(schema.userSettings).values({
      userId,
      privacySettings: { ...defaultPrivacySettings, ...privacyOverrides },
    })
  }

  test('P2: discovery counts exclude scoped/private media for non-owners', async () => {
    const owner = await insertCiUser(`p2_owner_${tag}`)
    const stranger = await insertCiUser(`p2_stranger_${tag}`)
    userIds.push(owner.id, stranger.id)
    await insertProfileAndSettings(owner.id)
    await insertProfileAndSettings(stranger.id)

    const [profile] = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, owner.id))
      .limit(1)

    const now = new Date()
    for (const [suffix, visibility] of [
      ['p2-public', MEDIA_VISIBILITIES.loggedIn],
      ['p2-private', MEDIA_VISIBILITIES.privateProfile],
      ['p2-group', MEDIA_VISIBILITIES.groupOnly],
    ] as const) {
      const [asset] = await db
        .insert(schema.mediaAssets)
        .values({
          uploaderUserId: owner.id,
          ownerType: 'profile',
          ownerId: profile!.id,
          sourceSurface: 'feed_post',
          storageKey: `public/${owner.id}/${tag}-${suffix}.jpg`,
          publicStorageKey: `public/${owner.id}/${tag}-${suffix}.jpg`,
          storageState: MEDIA_STORAGE_STATES.approvedPublic,
          mimeType: 'image/jpeg',
          sizeBytes: 512,
          uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
          contentRating: MEDIA_CONTENT_RATINGS.safePublic,
          visibility,
          updatedAt: now,
        })
        .returning({ id: schema.mediaAssets.id })
      mediaAssetIds.push(asset!.id)
      const [item] = await db
        .insert(schema.mediaItems)
        .values({
          ownerUserId: owner.id,
          mediaAssetId: asset!.id,
          mediaKind: 'image',
          visibility,
          sourceSurface: 'feed_post',
          updatedAt: now,
        })
        .returning({ id: schema.mediaItems.id })
      mediaItemIds.push(item!.id)
    }

    const strangerStats = await loadDiscoveryProfileStats([owner.id], stranger.id)
    assert.equal(strangerStats.get(owner.id)?.photoCount, 1, 'stranger sees only broadly visible media')

    const ownerStats = await loadDiscoveryProfileStats([owner.id], owner.id)
    assert.equal(ownerStats.get(owner.id)?.photoCount, 3, 'owner sees full library counts')
  })

  test('P3: inbox omits 1:1 threads with blocked partners', async () => {
    const viewer = await insertCiUser(`p3_viewer_${tag}`)
    const friendly = await insertCiUser(`p3_friendly_${tag}`)
    const hostile = await insertCiUser(`p3_hostile_${tag}`)
    userIds.push(viewer.id, friendly.id, hostile.id)
    for (const u of [viewer, friendly, hostile]) await insertProfileAndSettings(u.id)

    async function makeDm(partnerId: string): Promise<string> {
      const [conv] = await db
        .insert(schema.conversations)
        .values({ initiatorUserId: viewer.id })
        .returning({ id: schema.conversations.id })
      conversationIds.push(conv!.id)
      await db.insert(schema.conversationParticipants).values([
        { conversationId: conv!.id, userId: viewer.id, acceptanceStatus: 'ACCEPTED' },
        { conversationId: conv!.id, userId: partnerId, acceptanceStatus: 'ACCEPTED' },
      ])
      return conv!.id
    }

    const friendlyConvId = await makeDm(friendly.id)
    const hostileConvId = await makeDm(hostile.id)

    // The hostile partner blocked the viewer.
    await db.insert(schema.blocks).values({ blockerId: hostile.id, blockedId: viewer.id })

    const items = await listConversationsForInbox({ userId: viewer.id, folder: 'main' })
    const ids = items.map((i) => i.id)
    assert.ok(ids.includes(friendlyConvId), 'unblocked thread stays listed')
    assert.ok(!ids.includes(hostileConvId), 'blocked-pair thread is omitted')
  })

  test('P5: follow lists honor connectionsListVisibility', async () => {
    const target = await insertCiUser(`p5_target_${tag}`)
    const friend = await insertCiUser(`p5_friend_${tag}`)
    const stranger = await insertCiUser(`p5_stranger_${tag}`)
    const follower = await insertCiUser(`p5_follower_${tag}`)
    userIds.push(target.id, friend.id, stranger.id, follower.id)
    await insertProfileAndSettings(target.id, { connectionsListVisibility: 'connections_only' })
    for (const u of [friend, stranger, follower]) await insertProfileAndSettings(u.id)

    await db.insert(schema.connections).values({
      requesterId: friend.id,
      recipientId: target.id,
      status: 'ACCEPTED',
    })
    await db.insert(schema.userFollows).values({ followerId: follower.id, followingId: target.id })

    const strangerView = await loadPublicProfileFollows(target.id, 'followers', stranger.id)
    assert.equal(strangerView.listsVisible, false, 'authenticated stranger must not bypass connections_only')
    assert.equal(strangerView.items.length, 0)

    const friendView = await loadPublicProfileFollows(target.id, 'followers', friend.id)
    assert.equal(friendView.listsVisible, true)
    assert.ok(friendView.items.some((i) => i.username === follower.username))

    const ownerView = await loadPublicProfileFollows(target.id, 'followers', target.id)
    assert.equal(ownerView.listsVisible, true)
  })

  test('P6: connections preview filters viewer↔peer blocks', async () => {
    const target = await insertCiUser(`p6_target_${tag}`)
    const peerA = await insertCiUser(`p6_peer_a_${tag}`)
    const peerB = await insertCiUser(`p6_peer_b_${tag}`)
    const viewer = await insertCiUser(`p6_viewer_${tag}`)
    userIds.push(target.id, peerA.id, peerB.id, viewer.id)
    // Target exposes their list to members so the block filter (not the list
    // gate) is what this test exercises.
    await insertProfileAndSettings(target.id, { connectionsListVisibility: 'members' })
    for (const u of [peerA, peerB, viewer]) await insertProfileAndSettings(u.id)

    await db.insert(schema.connections).values([
      { requesterId: peerA.id, recipientId: target.id, status: 'ACCEPTED' },
      { requesterId: peerB.id, recipientId: target.id, status: 'ACCEPTED' },
    ])
    // Viewer blocked peerB.
    await db.insert(schema.blocks).values({ blockerId: viewer.id, blockedId: peerB.id })

    const { access, items } = await loadPublicProfileConnections(target.id, viewer.id)
    assert.equal(access.listVisible, true)
    const usernames = items.map((i) => i.username)
    assert.ok(usernames.includes(peerA.username), 'unblocked peer listed')
    assert.ok(!usernames.includes(peerB.username), 'viewer-blocked peer omitted')
  })

  test('P7: ISO DM entry point requires readable ISO visibility', async () => {
    const sender = await insertCiUser(`p7_sender_${tag}`)
    const privateIso = await insertCiUser(`p7_private_${tag}`)
    const publicIso = await insertCiUser(`p7_public_${tag}`)
    userIds.push(sender.id, privateIso.id, publicIso.id)
    await insertProfileAndSettings(sender.id)
    // ISO owners accept open DMs so the ISO visibility gate (P7) is the only
    // thing standing between the sender and the thread.
    for (const u of [privateIso, publicIso]) {
      await insertProfileAndSettings(u.id, { whoCanMessage: 'open' })
    }

    await db.insert(schema.userIsoPosts).values([
      {
        userId: privateIso.id,
        body: 'private iso',
        visibility: 'PRIVATE',
        acceptDmsViaIso: true,
        updatedAt: new Date(),
      },
      {
        userId: publicIso.id,
        body: 'public iso',
        visibility: 'PUBLIC',
        acceptDmsViaIso: true,
        updatedAt: new Date(),
      },
    ])

    const app = await buildCookieApp(async (a) => {
      const { registerEcosystemStubRoutes } = await import('../routes/ecosystem-stubs.js')
      await registerEcosystemStubRoutes(a)
    })

    try {
      const blocked = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: cookieHeader(sender.id, sender.username),
        payload: {
          participantId: privateIso.id,
          entryPoint: 'iso',
          isoSubjectUserId: privateIso.id,
        },
      })
      assert.equal(blocked.statusCode, 403, 'private ISO must not accept ISO-routed DMs')

      const allowed = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: cookieHeader(sender.id, sender.username),
        payload: {
          participantId: publicIso.id,
          entryPoint: 'iso',
          isoSubjectUserId: publicIso.id,
        },
      })
      assert.equal(allowed.statusCode, 200)
      const convId = (allowed.json() as { conversation?: { id?: string } }).conversation?.id
      if (convId) conversationIds.push(convId)
    } finally {
      await app.close()
    }
  })
})
