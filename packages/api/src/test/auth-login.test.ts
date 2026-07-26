/**
 * Login identifier + password reset integration tests.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  confirmPasswordReset,
  generatePasswordResetToken,
  hashPasswordResetToken,
  requestPasswordReset,
} from '../lib/password-reset.js'
import { prepareEmailStorage } from '../lib/user-email.js'
import { buildCookieApp, deleteUsers, ensureCiAuthSecret } from './ci-db-harness.js'

const runDbTests = process.env.USE_DATABASE === 'true'

async function buildAuthApp() {
  return buildCookieApp(async (a) => {
    const { registerAuthRoutes } = await import('../routes/auth.js')
    const { registerApiRateLimit } = await import('../lib/register-rate-limit.js')
    await registerApiRateLimit(a)
    await registerAuthRoutes(a)
  })
}

async function login(app: Awaited<ReturnType<typeof buildAuthApp>>, identifier: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/session',
    payload: { username: identifier, password },
  })
}

describe('auth login identifier', { skip: !runDbTests }, () => {
  const tag = randomUUID().slice(0, 8)
  let userId: string
  let username: string
  let email: string
  const password = 'OldPassword!234'
  const userIds: string[] = []

  before(async () => {
    ensureCiAuthSecret()
    process.env.C2K_MAIL_TRANSPORT = 'disabled'
    userId = randomUUID()
    username = `login_${tag}`
    email = `${username}@ci.c2k.test`
    userIds.push(userId)
    const hash = await bcrypt.hash(password, 12)
    await db.insert(schema.users).values({
      id: userId,
      username,
      ...prepareEmailStorage(email),
      passwordHash: hash,
    })
    await db.insert(schema.profiles).values({ userId })
  })

  after(async () => {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))
    await deleteUsers(userIds)
  })

  test('login by username works', async () => {
    const app = await buildAuthApp()
    const res = await login(app, username, password)
    assert.equal(res.statusCode, 200)
    const body = res.json() as { authenticated?: boolean; username?: string }
    assert.equal(body.authenticated, true)
    assert.equal(body.username, username)
    await app.close()
  })

  test('login by email works', async () => {
    const app = await buildAuthApp()
    const res = await login(app, email, password)
    assert.equal(res.statusCode, 200)
    const body = res.json() as { authenticated?: boolean; username?: string }
    assert.equal(body.authenticated, true)
    assert.equal(body.username, username)
    await app.close()
  })

  test('login by email with different casing works', async () => {
    const app = await buildAuthApp()
    const res = await login(app, email.toUpperCase(), password)
    assert.equal(res.statusCode, 200)
    await app.close()
  })

  test('wrong password returns generic invalid credentials', async () => {
    const app = await buildAuthApp()
    const res = await login(app, email, 'NotThePassword!234')
    assert.equal(res.statusCode, 401)
    const body = res.json() as { error?: string }
    assert.equal(body.error, 'Invalid credentials')
    await app.close()
  })

  test('unknown identifier returns generic invalid credentials', async () => {
    const app = await buildAuthApp()
    const res = await login(app, `missing_${tag}@example.com`, password)
    assert.equal(res.statusCode, 401)
    const body = res.json() as { error?: string }
    assert.equal(body.error, 'Invalid credentials')
    await app.close()
  })

  test('dormant account login is a generic failure without deleting user (PR 3 A7)', async () => {
    const dormantId = randomUUID()
    const dormantUsername = `dormant_${tag}`
    userIds.push(dormantId)
    const hash = await bcrypt.hash(password, 12)
    const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
    await db.insert(schema.users).values({
      id: dormantId,
      username: dormantUsername,
      ...prepareEmailStorage(`${dormantUsername}@ci.c2k.test`),
      passwordHash: hash,
    })
    await db.insert(schema.profiles).values({ userId: dormantId, updatedAt: threeYearsAgo })

    const app = await buildAuthApp()
    const res = await login(app, dormantUsername, password)
    assert.equal(res.statusCode, 401)
    const body = res.json() as { error?: string; code?: string }
    assert.equal(body.error, 'Invalid credentials')
    assert.equal(body.code, undefined, 'no lifecycle state code may be disclosed')

    const [stillThere] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, dormantId))
      .limit(1)
    assert.ok(stillThere, 'dormant login must not delete the user row')
    await app.close()
  })

  test('deleted account login is a generic failure (PR 3 A7)', async () => {
    const deletedId = randomUUID()
    const deletedUsername = `deleted_${tag}`
    userIds.push(deletedId)
    const hash = await bcrypt.hash(password, 12)
    await db.insert(schema.users).values({
      id: deletedId,
      username: deletedUsername,
      ...prepareEmailStorage(`${deletedUsername}@ci.c2k.test`),
      passwordHash: hash,
      deletedAt: new Date(),
    })
    await db.insert(schema.profiles).values({ userId: deletedId })

    const app = await buildAuthApp()
    const res = await login(app, deletedUsername, password)
    assert.equal(res.statusCode, 401)
    const body = res.json() as { error?: string; code?: string }
    assert.equal(body.error, 'Invalid credentials')
    assert.equal(body.code, undefined)
    await app.close()
  })

  test('revoked session reports unauthenticated and leaks no email on GET /api/auth/session (PR 3 A2)', async () => {
    const app = await buildAuthApp()
    const loginRes = await login(app, username, password)
    assert.equal(loginRes.statusCode, 200)
    const cookie = loginRes.cookies.find((c) => c.name === 'c2k_session')
    assert.ok(cookie)

    const liveSession = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `c2k_session=${cookie!.value}` },
    })
    assert.equal((liveSession.json() as { authenticated?: boolean }).authenticated, true)

    // Revoke every session (as a password reset would).
    const [row] = await db
      .select({ sessionVersion: schema.users.sessionVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    await db
      .update(schema.users)
      .set({ sessionVersion: (row?.sessionVersion ?? 0) + 1 })
      .where(eq(schema.users.id, userId))

    const staleSession = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `c2k_session=${cookie!.value}` },
    })
    assert.equal(staleSession.statusCode, 200)
    const staleBody = staleSession.json() as {
      authenticated?: boolean
      email?: string | null
      userId?: string | null
    }
    assert.equal(staleBody.authenticated, false)
    assert.equal(staleBody.email, null)
    assert.equal(staleBody.userId, null)
    await app.close()
  })

  test('logout revokes the session server-side, not just the cookie (PR 3 A1)', async () => {
    const app = await buildAuthApp()
    const loginRes = await login(app, username, password)
    assert.equal(loginRes.statusCode, 200)
    const cookie = loginRes.cookies.find((c) => c.name === 'c2k_session')
    assert.ok(cookie)
    const cookieHeader = { cookie: `c2k_session=${cookie!.value}` }

    const logoutRes = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: cookieHeader })
    assert.equal(logoutRes.statusCode, 200)

    // Replaying the captured cookie after logout must be unauthenticated.
    const replay = await app.inject({ method: 'GET', url: '/api/auth/session', headers: cookieHeader })
    assert.equal((replay.json() as { authenticated?: boolean }).authenticated, false)
    await app.close()
  })

  test('confirming a reset consumes every outstanding token (PR 3 A6)', async () => {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))
    const stubLog = { warn: () => {} }
    const stubReq = { log: stubLog } as never

    await requestPasswordReset({ identifier: email, req: stubReq, log: stubLog })
    await requestPasswordReset({ identifier: email, req: stubReq, log: stubLog })

    const tokenRows = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId))
      .orderBy(desc(schema.passwordResetTokens.createdAt))
    assert.ok(tokenRows.length >= 2)

    // Replace both hashes with known raw tokens.
    const rawFirst = generatePasswordResetToken()
    const rawSecond = generatePasswordResetToken()
    await db
      .update(schema.passwordResetTokens)
      .set({ tokenHash: hashPasswordResetToken(rawFirst) })
      .where(eq(schema.passwordResetTokens.id, tokenRows[1]!.id))
    await db
      .update(schema.passwordResetTokens)
      .set({ tokenHash: hashPasswordResetToken(rawSecond) })
      .where(eq(schema.passwordResetTokens.id, tokenRows[0]!.id))

    const confirm = await confirmPasswordReset({
      rawToken: rawSecond,
      newPassword: 'AnotherPassword!2345',
      log: stubLog,
    })
    assert.equal(confirm.ok, true)

    const replayFirst = await confirmPasswordReset({
      rawToken: rawFirst,
      newPassword: 'AttackerPassword!2345',
      log: stubLog,
    })
    assert.equal(replayFirst.ok, false)
    if (!replayFirst.ok) assert.equal(replayFirst.status, 410)
  })

  test('reset by email then login by username and email with new password', async () => {
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))
    const newPassword = 'NewPassword!234567'

    await requestPasswordReset({
      identifier: email,
      req: { log: { warn: () => {} } } as never,
      log: { warn: () => {} },
    })

    const [tokenRow] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId))
      .orderBy(desc(schema.passwordResetTokens.createdAt))
      .limit(1)
    assert.ok(tokenRow)

    const raw = generatePasswordResetToken()
    await db
      .update(schema.passwordResetTokens)
      .set({ tokenHash: hashPasswordResetToken(raw) })
      .where(eq(schema.passwordResetTokens.id, tokenRow!.id))

    const confirm = await confirmPasswordReset({
      rawToken: raw,
      newPassword,
      log: { warn: () => {} },
    })
    assert.equal(confirm.ok, true)

    const app = await buildAuthApp()
    const oldLogin = await login(app, username, password)
    assert.equal(oldLogin.statusCode, 401)

    const byUsername = await login(app, username, newPassword)
    assert.equal(byUsername.statusCode, 200)

    const byEmail = await login(app, email, newPassword)
    assert.equal(byEmail.statusCode, 200)
    await app.close()
  })
})
