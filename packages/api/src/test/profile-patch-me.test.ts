/**
 * PATCH /api/profile/me — identity, about, and looking-for persistence.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildCookieApp, cookieHeader, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('PATCH /api/profile/me', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let userId: string
  let username: string

  after(async () => {
    if (!userId) return
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
    await db.delete(schema.users).where(eq(schema.users.id, userId))
  })

  test('setup user', async () => {
    const user = await insertCiUser(`prof_patch_${tag}`)
    userId = user.id
    username = user.username
  })

  test('PATCH persists bio, identity arrays, and lookingFor', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRoutes } = await import('../routes/profile.js')
      await registerProfileRoutes(a)
    })
    try {
      const patchBody = {
        bio: 'Profile save smoke test',
        genders: ['non-binary'],
        sexualOrientations: ['demisexual'],
        romanticOrientations: ['panromantic'],
        pronounTags: ['They/Them'],
        lifestyleActivity: 'Very active',
        lookingFor: ['friends', 'play-partners'],
      }
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: patchBody,
      })
      assert.equal(patchRes.statusCode, 200, patchRes.body)
      const patched = patchRes.json() as { profile?: Record<string, unknown> }
      assert.equal(patched.profile?.bio, patchBody.bio)
      assert.deepEqual(patched.profile?.genders, patchBody.genders)
      assert.deepEqual(patched.profile?.sexualOrientations, patchBody.sexualOrientations)
      assert.deepEqual(patched.profile?.lookingFor, patchBody.lookingFor)

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/profile/me',
        headers: cookieHeader(userId, username),
      })
      assert.equal(getRes.statusCode, 200, getRes.body)
      const loaded = getRes.json() as { profile?: Record<string, unknown> }
      assert.equal(loaded.profile?.bio, patchBody.bio)
      assert.deepEqual(loaded.profile?.sexualOrientations, patchBody.sexualOrientations)
      assert.deepEqual(loaded.profile?.lookingFor, patchBody.lookingFor)
    } finally {
      await app.close()
    }
  })

  test('PATCH rejects standalone age without birthDate', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRoutes } = await import('../routes/profile.js')
      await registerProfileRoutes(a)
    })
    try {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: { age: 25 },
      })
      assert.equal(res.statusCode, 400, res.body)
      const body = res.json() as { error?: string }
      assert.match(body.error ?? '', /birthDate/i)
    } finally {
      await app.close()
    }
  })

  test('PATCH allows null bio to clear about text', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRoutes } = await import('../routes/profile.js')
      await registerProfileRoutes(a)
    })
    try {
      const setRes = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: { bio: 'Temporary bio' },
      })
      assert.equal(setRes.statusCode, 200, setRes.body)

      const clearRes = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: { bio: null },
      })
      assert.equal(clearRes.statusCode, 200, clearRes.body)
      const cleared = clearRes.json() as { profile?: { bio?: string | null } }
      assert.equal(cleared.profile?.bio, null)
    } finally {
      await app.close()
    }
  })

  test('PATCH rejects partial invalid homeZip without blocking null zip', async () => {
    ensureCiAuthSecret()
    const app = await buildCookieApp(async (a) => {
      const { registerProfileRoutes } = await import('../routes/profile.js')
      await registerProfileRoutes(a)
    })
    try {
      const okRes = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: { bio: 'Zip null ok', homeZip: null },
      })
      assert.equal(okRes.statusCode, 200, okRes.body)

      const badRes = await app.inject({
        method: 'PATCH',
        url: '/api/profile/me',
        headers: { ...cookieHeader(userId, username), 'content-type': 'application/json' },
        payload: { bio: 'Bad zip', homeZip: '1234' },
      })
      assert.equal(badRes.statusCode, 400, badRes.body)
    } finally {
      await app.close()
    }
  })
})
