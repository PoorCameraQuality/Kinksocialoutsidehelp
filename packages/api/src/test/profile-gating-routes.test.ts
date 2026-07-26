/**
 * Public profile sub-routes must respect profiles.visibility (404 when denied).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('profile gating on relationships and references', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let privateUserId: string
  let privateUsername: string
  let viewerId: string
  let viewerUsername: string

  after(async () => {
    for (const uid of [privateUserId, viewerId]) {
      if (!uid) continue
      await db.delete(schema.profileReferences).where(eq(schema.profileReferences.subjectUserId, uid))
      await db.delete(schema.profileRelationships).where(eq(schema.profileRelationships.userId, uid))
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, uid))
      await db.delete(schema.users).where(eq(schema.users.id, uid))
    }
  })

  test('setup private profile and viewer', async () => {
    const target = await insertCiUser(`gate_priv_${tag}`)
    const viewer = await insertCiUser(`gate_view_${tag}`)
    privateUserId = target.id
    privateUsername = target.username
    viewerId = viewer.id
    viewerUsername = viewer.username

    await db
      .update(schema.profiles)
      .set({ visibility: 'PRIVATE' })
      .where(eq(schema.profiles.userId, privateUserId))
  })

  test('GET relationships returns 404 for private profile stranger', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRelationshipRoutes } = await import('../routes/profile-relationships.js')
      await registerProfileRelationshipRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/profile/${encodeURIComponent(privateUsername)}/relationships`,
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(res.statusCode, 404, res.body)
    } finally {
      await app.close()
    }
  })

  test('GET references returns 404 for private profile stranger', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileReferenceRoutes } = await import('../routes/profile-references.js')
      await registerProfileReferenceRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${encodeURIComponent(privateUsername)}/references`,
        headers: cookieHeader(viewerId, viewerUsername),
      })
      assert.equal(res.statusCode, 404, res.body)
    } finally {
      await app.close()
    }
  })

  test('owner can read own private profile relationships', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRelationshipRoutes } = await import('../routes/profile-relationships.js')
      await registerProfileRelationshipRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/profile/${encodeURIComponent(privateUsername)}/relationships`,
        headers: cookieHeader(privateUserId, privateUsername),
      })
      assert.equal(res.statusCode, 200, res.body)
    } finally {
      await app.close()
    }
  })
})
