/**
 * Password reset flow - DB integration tests.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  confirmPasswordReset,
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_GENERIC_MESSAGE,
  requestPasswordReset,
  resolvePasswordResetTtlMs,
} from '../lib/password-reset.js'
import { buildCookieApp, deleteUsers, ensureCiAuthSecret, insertCiUser } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

describe('password reset TTL clamp (PR 3 A10)', () => {
  test('clamps to the 15–120 minute window and defaults on bad input', () => {
    const MIN = 15 * 60 * 1000
    const MAX = 120 * 60 * 1000
    const DEFAULT = 45 * 60 * 1000
    assert.equal(resolvePasswordResetTtlMs(undefined), DEFAULT)
    assert.equal(resolvePasswordResetTtlMs('not-a-number'), DEFAULT)
    assert.equal(resolvePasswordResetTtlMs('-5'), DEFAULT)
    assert.equal(resolvePasswordResetTtlMs('1000'), MIN)
    assert.equal(resolvePasswordResetTtlMs(String(30 * 60 * 1000)), 30 * 60 * 1000)
    assert.equal(resolvePasswordResetTtlMs(String(24 * 60 * 60 * 1000)), MAX)
  })
})

describe('password reset', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let userId: string
  let username: string
  const password = 'OldPassword!234'
  const userIds: string[] = []

  before(async () => {
    ensureCiAuthSecret()
    process.env.C2K_MAIL_TRANSPORT = 'disabled'
    process.env.C2K_PUBLIC_WEB_URL = 'http://127.0.0.1:5173'
    const user = await insertCiUser(`pwreset_${tag}`)
    userId = user.id
    username = user.username
    userIds.push(userId)
    const hash = await bcrypt.hash(password, 12)
    await db.update(schema.users).set({ passwordHash: hash, email: `${username}@ci.c2k.test` }).where(eq(schema.users.id, userId))
  })

  after(async () => {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))
    await deleteUsers(userIds)
  })

  test('request for existing account returns generic success', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerAuthRoutes } = await import('../routes/auth.js')
      const { registerApiRateLimit } = await import('../lib/register-rate-limit.js')
      await registerApiRateLimit(a)
      await registerAuthRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { identifier: username },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json() as { message?: string }
    assert.equal(body.message, PASSWORD_RESET_GENERIC_MESSAGE)
    await app.close()
  })

  test('request for nonexistent account returns same generic success', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerAuthRoutes } = await import('../routes/auth.js')
      await registerAuthRoutes(a)
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { identifier: `missing_${tag}@example.com` },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json() as { message?: string }
    assert.equal(body.message, PASSWORD_RESET_GENERIC_MESSAGE)
    await app.close()
  })

  test('token stored hashed not raw; valid token resets password', async () => {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))

    const raw = generatePasswordResetToken()
    const tokenHash = hashPasswordResetToken(raw)
    await db.insert(schema.passwordResetTokens).values({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const rows = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId))
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.tokenHash, tokenHash)
    assert.notEqual(rows[0]?.tokenHash, raw)

    const result = await confirmPasswordReset({
      rawToken: raw,
      newPassword: 'NewPassword!234567',
      log: { warn: () => {} },
    })
    assert.equal(result.ok, true)

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId))
    assert.ok(user)
    assert.equal(await bcrypt.compare('NewPassword!234567', user!.passwordHash), true)
    assert.equal(await bcrypt.compare(password, user!.passwordHash), false)
    assert.ok((user!.sessionVersion ?? 0) >= 1)
  })

  test('used token cannot be reused', async () => {
    const raw = generatePasswordResetToken()
    await db.insert(schema.passwordResetTokens).values({
      userId,
      tokenHash: hashPasswordResetToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
    })
    const result = await confirmPasswordReset({
      rawToken: raw,
      newPassword: 'AnotherPassword!234',
      log: { warn: () => {} },
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 410)
  })

  test('expired token fails', async () => {
    const raw = generatePasswordResetToken()
    await db.insert(schema.passwordResetTokens).values({
      userId,
      tokenHash: hashPasswordResetToken(raw),
      expiresAt: new Date(Date.now() - 1000),
    })
    const result = await confirmPasswordReset({
      rawToken: raw,
      newPassword: 'AnotherPassword!234',
      log: { warn: () => {} },
    })
    assert.equal(result.ok, false)
  })

  test('requestPasswordReset never throws for missing user', async () => {
    const res = await requestPasswordReset({
      identifier: `ghost_${tag}`,
      req: { log: { warn: () => {} } } as never,
      log: { warn: () => {} },
    })
    assert.equal(res.message, PASSWORD_RESET_GENERIC_MESSAGE)
  })

  test('logged-in password change rejects wrong current password', async () => {
    const app = await buildCookieApp(async (a) => {
      const { registerAuthRoutes } = await import('../routes/auth.js')
      const { registerApiRateLimit } = await import('../lib/register-rate-limit.js')
      await registerApiRateLimit(a)
      await registerAuthRoutes(a)
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/session',
      payload: { username, password: 'NewPassword!234567' },
    })
    assert.equal(login.statusCode, 200)
    const cookie = login.headers['set-cookie']
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/password/change',
      headers: { cookie: String(cookie) },
      payload: { currentPassword: 'wrong-password', newPassword: 'NewPassword!234567' },
    })
    assert.equal(bad.statusCode, 401)
    await app.close()
  })
})

describe('password reset rate limit smoke', () => {
  test('password reset request returns 429 after limit', async () => {
    const prevDisable = process.env.C2K_RATE_LIMIT_DISABLE
    const prevMax = process.env.C2K_RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX
    process.env.C2K_RATE_LIMIT_DISABLE = 'false'
    process.env.C2K_RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX = '2'
    process.env.USE_DATABASE = 'false'
    ensureCiAuthSecret()

    const cookie = (await import('@fastify/cookie')).default
    const Fastify = (await import('fastify')).default
    const app = Fastify()
    await app.register(cookie)
    const { registerApiRateLimit } = await import('../lib/register-rate-limit.js')
    await registerApiRateLimit(app)
    const { registerAuthRoutes } = await import('../routes/auth.js')
    await registerAuthRoutes(app)

    try {
      const payload = JSON.stringify({ identifier: 'someone@example.com' })
      const inject = () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/password-reset/request',
          payload,
          headers: { 'content-type': 'application/json' },
        })
      await inject()
      await inject()
      const third = await inject()
      assert.equal(third.statusCode, 429)
    } finally {
      process.env.C2K_RATE_LIMIT_DISABLE = prevDisable
      process.env.C2K_RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX = prevMax
      await app.close()
    }
  })
})
