/**
 * DB smoke (launch-hardening PR 3, M1/M6): the direct media-asset serving path
 * enforces owner-, relationship-, and community-scoped visibility exactly like
 * the media-item path, and never returns raw storage keys to clients.
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
import { getMediaAssetForViewer } from '../lib/media-asset-viewer.js'
import {
  buildCookieApp,
  cookieHeader,
  insertCiUser,
  runDbIntegration,
} from './ci-db-harness.js'

describe('media asset scoped access (DB)', { skip: !runDbIntegration }, () => {
  const tag = randomUUID().slice(0, 8)
  const userIds: string[] = []
  const mediaItemIds: string[] = []
  const mediaAssetIds: string[] = []
  const groupIds: string[] = []
  const orgIds: string[] = []
  const eventIds: string[] = []
  const conventionIds: string[] = []
  const connectionPairs: Array<[string, string]> = []

  before(() => {
    process.env.USE_DATABASE = 'true'
  })

  after(async () => {
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
      await db
        .delete(schema.conventionRegistrants)
        .where(eq(schema.conventionRegistrants.conventionId, conventionId))
      await db.delete(schema.conventions).where(eq(schema.conventions.id, conventionId))
    }
    for (const orgId of orgIds) {
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId))
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId))
    }
    for (const [a, b] of connectionPairs) {
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, a))
      await db.delete(schema.connections).where(eq(schema.connections.requesterId, b))
    }
    for (const userId of userIds) {
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
      await db.delete(schema.users).where(eq(schema.users.id, userId))
    }
  })

  async function insertProfile(userId: string): Promise<string> {
    const now = new Date()
    const [profile] = await db
      .insert(schema.profiles)
      .values({ userId, displayName: userId.slice(0, 8), updatedAt: now })
      .returning({ id: schema.profiles.id })
    return profile!.id
  }

  async function insertScopedAsset(params: {
    ownerId: string
    profileId: string
    suffix: string
    visibility: string
    withItem?: boolean
    sourceGroupId?: string | null
    sourceEventId?: string | null
    sourceConventionId?: string | null
  }): Promise<string> {
    const now = new Date()
    const [asset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: params.ownerId,
        ownerType: 'profile',
        ownerId: params.profileId,
        sourceSurface: 'feed_post',
        storageKey: `public/${params.ownerId}/${tag}-${params.suffix}.jpg`,
        publicStorageKey: `public/${params.ownerId}/${tag}-${params.suffix}.jpg`,
        storageState: MEDIA_STORAGE_STATES.approvedPublic,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
        contentRating: MEDIA_CONTENT_RATINGS.safePublic,
        visibility: params.visibility,
        updatedAt: now,
      })
      .returning({ id: schema.mediaAssets.id })
    mediaAssetIds.push(asset!.id)

    if (params.withItem !== false) {
      const [item] = await db
        .insert(schema.mediaItems)
        .values({
          ownerUserId: params.ownerId,
          mediaAssetId: asset!.id,
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
    }
    return asset!.id
  }

  test('PRIVATE_PROFILE assets are owner-only on the direct asset path', async () => {
    const owner = await insertCiUser(`${tag}_ma_owner`)
    const stranger = await insertCiUser(`${tag}_ma_stranger`)
    userIds.push(owner.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(stranger.id)

    const assetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'private',
      visibility: MEDIA_VISIBILITIES.privateProfile,
    })

    const ownerView = await getMediaAssetForViewer(assetId, { userId: owner.id, adultContentPref: 'SHOW' })
    assert.ok(ownerView, 'owner must see their private asset')

    const strangerView = await getMediaAssetForViewer(assetId, {
      userId: stranger.id,
      adultContentPref: 'SHOW',
    })
    assert.equal(strangerView, null, 'authenticated stranger must not see PRIVATE_PROFILE asset')

    const staffView = await getMediaAssetForViewer(assetId, {
      userId: stranger.id,
      adultContentPref: 'SHOW',
      isStaff: true,
    })
    assert.ok(staffView, 'staff retain moderation visibility')
  })

  test('FOLLOWERS assets require an accepted connection', async () => {
    const owner = await insertCiUser(`${tag}_fo_owner`)
    const friend = await insertCiUser(`${tag}_fo_friend`)
    const stranger = await insertCiUser(`${tag}_fo_stranger`)
    userIds.push(owner.id, friend.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(friend.id)
    await insertProfile(stranger.id)

    await db.insert(schema.connections).values({
      requesterId: friend.id,
      recipientId: owner.id,
      status: 'ACCEPTED',
    })
    connectionPairs.push([friend.id, owner.id])

    const assetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'followers',
      visibility: MEDIA_VISIBILITIES.followers,
    })

    assert.ok(await getMediaAssetForViewer(assetId, { userId: friend.id, adultContentPref: 'SHOW' }))
    assert.equal(
      await getMediaAssetForViewer(assetId, { userId: stranger.id, adultContentPref: 'SHOW' }),
      null,
    )
  })

  test('GROUP_ONLY assets require group membership; missing scope fails closed', async () => {
    const owner = await insertCiUser(`${tag}_gr_owner`)
    const member = await insertCiUser(`${tag}_gr_member`)
    const stranger = await insertCiUser(`${tag}_gr_stranger`)
    userIds.push(owner.id, member.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(member.id)
    await insertProfile(stranger.id)

    const groupId = randomUUID()
    groupIds.push(groupId)
    await db.insert(schema.groups).values({
      id: groupId,
      slug: `ci-ma-grp-${tag}`,
      name: 'Asset scope group',
      ownerId: owner.id,
      visibility: 'public',
    })
    await db.insert(schema.groupMembers).values({ groupId, userId: member.id, role: 'member' })

    const assetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'group',
      visibility: MEDIA_VISIBILITIES.groupOnly,
      sourceGroupId: groupId,
    })
    const orphanAssetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'group-orphan',
      visibility: MEDIA_VISIBILITIES.groupOnly,
      withItem: false,
    })

    assert.ok(await getMediaAssetForViewer(assetId, { userId: member.id, adultContentPref: 'SHOW' }))
    assert.equal(
      await getMediaAssetForViewer(assetId, { userId: stranger.id, adultContentPref: 'SHOW' }),
      null,
    )
    assert.equal(
      await getMediaAssetForViewer(orphanAssetId, { userId: member.id, adultContentPref: 'SHOW' }),
      null,
      'scoped asset without resolvable scope must fail closed for non-owners',
    )
    assert.ok(
      await getMediaAssetForViewer(orphanAssetId, { userId: owner.id, adultContentPref: 'SHOW' }),
      'owner still sees their own orphaned asset',
    )
  })

  test('ORG_ONLY assets require org membership', async () => {
    const owner = await insertCiUser(`${tag}_or_owner`)
    const member = await insertCiUser(`${tag}_or_member`)
    const stranger = await insertCiUser(`${tag}_or_stranger`)
    userIds.push(owner.id, member.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(member.id)
    await insertProfile(stranger.id)

    const orgId = randomUUID()
    const eventId = randomUUID()
    orgIds.push(orgId)
    eventIds.push(eventId)
    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-ma-org-${tag}`,
      displayName: 'Asset scope org',
      ownerId: owner.id,
      visibility: 'MEMBERS',
    })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: member.id,
      role: 'MEMBER',
    })
    await db.insert(schema.events).values({
      id: eventId,
      hostId: owner.id,
      organizationId: orgId,
      title: 'Org asset event',
      startsAt: new Date(Date.now() + 86_400_000),
      visibility: 'public',
    })

    const assetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'org',
      visibility: MEDIA_VISIBILITIES.orgOnly,
      sourceEventId: eventId,
    })

    assert.ok(await getMediaAssetForViewer(assetId, { userId: member.id, adultContentPref: 'SHOW' }))
    assert.equal(
      await getMediaAssetForViewer(assetId, { userId: stranger.id, adultContentPref: 'SHOW' }),
      null,
    )
  })

  test('EVENT_ATTENDEES assets require a going RSVP', async () => {
    const host = await insertCiUser(`${tag}_ev_host`)
    const attendee = await insertCiUser(`${tag}_ev_going`)
    const stranger = await insertCiUser(`${tag}_ev_stranger`)
    userIds.push(host.id, attendee.id, stranger.id)
    const profileId = await insertProfile(host.id)
    await insertProfile(attendee.id)
    await insertProfile(stranger.id)

    const eventId = randomUUID()
    eventIds.push(eventId)
    await db.insert(schema.events).values({
      id: eventId,
      hostId: host.id,
      title: 'Attendee asset event',
      startsAt: new Date(Date.now() + 86_400_000),
      visibility: 'public',
    })
    await db.insert(schema.eventRsvps).values({
      eventId,
      userId: attendee.id,
      status: 'going',
      rsvpApprovalStatus: 'not_required',
    })

    const assetId = await insertScopedAsset({
      ownerId: host.id,
      profileId,
      suffix: 'event',
      visibility: MEDIA_VISIBILITIES.eventAttendees,
      sourceEventId: eventId,
    })

    assert.ok(await getMediaAssetForViewer(assetId, { userId: attendee.id, adultContentPref: 'SHOW' }))
    assert.equal(
      await getMediaAssetForViewer(assetId, { userId: stranger.id, adultContentPref: 'SHOW' }),
      null,
    )
  })

  test('CONVENTION_ATTENDEES assets require registration', async () => {
    const owner = await insertCiUser(`${tag}_cv_owner`)
    const registrant = await insertCiUser(`${tag}_cv_reg`)
    const stranger = await insertCiUser(`${tag}_cv_stranger`)
    userIds.push(owner.id, registrant.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(registrant.id)
    await insertProfile(stranger.id)

    const orgId = randomUUID()
    const conventionId = randomUUID()
    orgIds.push(orgId)
    conventionIds.push(conventionId)
    await db.insert(schema.organizations).values({
      id: orgId,
      slug: `ci-ma-conv-org-${tag}`,
      displayName: 'Asset scope conv org',
      ownerId: owner.id,
    })
    const starts = new Date(Date.now() + 7 * 86_400_000)
    await db.insert(schema.conventions).values({
      id: conventionId,
      slug: `ci-ma-conv-${tag}`,
      name: 'Asset scope conv',
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

    const assetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'conv',
      visibility: MEDIA_VISIBILITIES.conventionAttendees,
      sourceConventionId: conventionId,
    })

    assert.ok(await getMediaAssetForViewer(assetId, { userId: registrant.id, adultContentPref: 'SHOW' }))
    assert.equal(
      await getMediaAssetForViewer(assetId, { userId: stranger.id, adultContentPref: 'SHOW' }),
      null,
    )
  })

  test('asset route responses omit storageKey and 404 scoped assets for strangers', async () => {
    const owner = await insertCiUser(`${tag}_rt_owner`)
    const stranger = await insertCiUser(`${tag}_rt_stranger`)
    userIds.push(owner.id, stranger.id)
    const profileId = await insertProfile(owner.id)
    await insertProfile(stranger.id)

    const privateAssetId = await insertScopedAsset({
      ownerId: owner.id,
      profileId,
      suffix: 'route-private',
      visibility: MEDIA_VISIBILITIES.privateProfile,
    })
    // Quarantine-served (auth-proxy) asset: its S3 key embeds the uploader's
    // user UUID, which must never reach clients (M6).
    const now = new Date()
    const [quarantineAsset] = await db
      .insert(schema.mediaAssets)
      .values({
        uploaderUserId: owner.id,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface: 'feed_post',
        storageKey: `quarantine/${owner.id}/${tag}-route-proxy.jpg`,
        quarantineStorageKey: `quarantine/${owner.id}/${tag}-route-proxy.jpg`,
        storageState: MEDIA_STORAGE_STATES.validatedPrivate,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadStatus: MEDIA_UPLOAD_STATUSES.autoApproved,
        contentRating: MEDIA_CONTENT_RATINGS.safePublic,
        visibility: MEDIA_VISIBILITIES.loggedIn,
        updatedAt: now,
      })
      .returning({ id: schema.mediaAssets.id })
    const proxyAssetId = quarantineAsset!.id
    mediaAssetIds.push(proxyAssetId)

    const app = await buildCookieApp(async (a) => {
      const { registerMediaAssetRoutes } = await import('../routes/media-assets.js')
      await registerMediaAssetRoutes(a)
    })

    try {
      const strangerPrivate = await app.inject({
        method: 'GET',
        url: `/api/v1/media/assets/${privateAssetId}`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerPrivate.statusCode, 404)

      const strangerPrivateContent = await app.inject({
        method: 'GET',
        url: `/api/v1/media/assets/${privateAssetId}/content`,
        headers: cookieHeader(stranger.id, stranger.username),
      })
      assert.equal(strangerPrivateContent.statusCode, 404)

      for (const [who, headers] of [
        ['owner', cookieHeader(owner.id, owner.username)],
        ['stranger', cookieHeader(stranger.id, stranger.username)],
      ] as const) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/media/assets/${proxyAssetId}`,
          headers,
        })
        assert.equal(res.statusCode, 200, `${who} can load LOGGED_IN asset`)
        const body = res.json() as { asset: Record<string, unknown> }
        assert.ok(!('storageKey' in body.asset), `${who} response must omit storageKey`)
        assert.ok(
          !JSON.stringify(body).includes(owner.id),
          `${who} response must not leak the uploader user id via the quarantine key`,
        )
        assert.ok(
          !JSON.stringify(body).includes('quarantine/'),
          `${who} response must not expose internal storage layout`,
        )
      }
    } finally {
      await app.close()
    }
  })
})
