/**
 * Media social layer API tests.
 * Requires USE_DATABASE=true and migrated schema.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { and, eq } from 'drizzle-orm'
import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_VISIBILITIES,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { buildCookieApp, cookieHeader, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'
process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'
process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
process.env.C2K_ALLOW_NUDITY = 'true'
process.env.MEDIA_POLICY_MODE = 'attested_explicit_beta'

const attestation = {
  contentRating: MEDIA_CONTENT_RATINGS.adultNonExplicit,
  depictedPeople: DEPICTED_PEOPLE.onlyMe,
  visibility: MEDIA_VISIBILITIES.loggedIn,
  uploaderConfirmed18: true as const,
  uploaderConfirmedDepictedAdults18: true as const,
  uploaderConfirmedConsent: true as const,
  uploaderConfirmedRightToUpload: true as const,
  uploaderConfirmedNoNcii: true as const,
  uploaderConfirmedNoMinors: true as const,
  uploaderConfirmedNoHiddenCamera: true as const,
  uploaderConfirmedNoAiDeepfakeWithoutConsent: true as const,
}

describe('media social layer', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let ownerId: string
  let ownerUsername: string
  let otherId: string
  let ownerHeaders: Record<string, string>

  after(async () => {
    await db.delete(schema.mediaComments).where(eq(schema.mediaComments.authorId, ownerId))
    await db.delete(schema.mediaReactions).where(eq(schema.mediaReactions.userId, ownerId))
    await db.delete(schema.mediaPostItems)
    await db.delete(schema.mediaPosts).where(eq(schema.mediaPosts.ownerUserId, ownerId))
    await db.delete(schema.mediaAlbumItems)
    await db.delete(schema.mediaItemTags)
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.ownerUserId, ownerId))
    await db.delete(schema.mediaAlbums).where(eq(schema.mediaAlbums.ownerUserId, ownerId))
    await db.delete(schema.feedPosts).where(eq(schema.feedPosts.authorId, ownerId))
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, ownerId))
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, otherId))
    await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, ownerId))
    await db.delete(schema.users).where(eq(schema.users.id, ownerId))
    await db.delete(schema.users).where(eq(schema.users.id, otherId))
  })

  test('setup', async () => {
    const owner = await insertCiUser(`media_soc_${tag}`)
    const other = await insertCiUser(`media_soc_o_${tag}`)
    ownerId = owner.id
    ownerUsername = owner.username
    otherId = other.id
    await db.insert(schema.profiles).values({ userId: ownerId, displayName: 'Media Social Owner' })
    ownerHeaders = cookieHeader(owner.id, owner.username)
  })

  test('POST /api/v1/me/media/uploads creates item and optional feed post', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerUserMediaRoutes } = await import('../routes/user-media-routes.js')
      await registerUserMediaRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/media/uploads',
        headers: ownerHeaders,
        payload: {
          caption: 'Test upload',
          items: [
            {
              quarantineKey: `quarantine/${ownerId}/test-${tag}.jpg`,
              mediaKind: 'image',
              mimeType: 'image/jpeg',
              sizeBytes: 1024,
              imageWidth: 800,
              imageHeight: 600,
            },
          ],
          visibility: MEDIA_VISIBILITIES.loggedIn,
          commentPolicy: 'connections',
          postToFeed: true,
          attestation,
        },
      })
      assert.equal(res.statusCode, 201, res.body)
      const body = JSON.parse(res.body) as { mediaItemIds: string[]; feedPostId: string | null }
      assert.equal(body.mediaItemIds.length, 1)
      assert.ok(body.feedPostId)

      const resPrivate = await app.inject({
        method: 'POST',
        url: '/api/v1/me/media/uploads',
        headers: ownerHeaders,
        payload: {
          items: [
            {
              quarantineKey: `quarantine/${ownerId}/private-${tag}.jpg`,
              mediaKind: 'image',
              mimeType: 'image/jpeg',
              sizeBytes: 512,
            },
          ],
          visibility: MEDIA_VISIBILITIES.privateProfile,
          commentPolicy: 'no_one',
          postToFeed: false,
          attestation,
        },
      })
      assert.equal(resPrivate.statusCode, 201)
    } finally {
      await app.close()
    }
  })

  test('GET profile media enforces visibility', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerUserMediaRoutes } = await import('../routes/user-media-routes.js')
      await registerUserMediaRoutes(a)
    })
    try {
      const ownerRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${ownerUsername}/media?kind=image`,
        headers: ownerHeaders,
      })
      assert.equal(ownerRes.statusCode, 200, ownerRes.body)
      const ownerBody = JSON.parse(ownerRes.body) as { items: Array<{ id: string }> }
      assert.ok(ownerBody.items.length >= 1, `owner sees uploaded media: ${ownerRes.body}`)

      const other = await insertCiUser(`media_soc_v_${tag}`)
      const otherHeaders = cookieHeader(other.id, other.username)
      const otherRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${ownerUsername}/media?kind=image`,
        headers: otherHeaders,
      })
      assert.equal(otherRes.statusCode, 200, otherRes.body)
      const otherBody = JSON.parse(otherRes.body) as { items: Array<{ visibility?: string }> }
      const leakedPrivate = otherBody.items.some(
        (i) => i.visibility === MEDIA_VISIBILITIES.privateProfile,
      )
      assert.equal(leakedPrivate, false, 'private items must not leak to other members')
      await db.delete(schema.users).where(eq(schema.users.id, other.id))
    } finally {
      await app.close()
    }
  })
})
