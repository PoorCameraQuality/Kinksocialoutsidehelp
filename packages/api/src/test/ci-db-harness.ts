import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { encodeSession, SESSION_COOKIE_NAME } from '@c2k/shared/session-token'
import { db, schema } from '../db/index.js'

/** Run DB-backed integration smokes in CI (`check-db` job) or locally with the same env. */
export const runDbIntegration =
  process.env.CI_API_INTEGRATION_DB === 'true' || process.env.CI_NOTIFICATIONS_DB === 'true'

const CI_AUTH_SECRET = 'ci-wave7-integration-auth-secret'

export function ensureCiAuthSecret(): void {
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = CI_AUTH_SECRET
  }
}

export function sessionCookie(userId: string, username: string): string {
  ensureCiAuthSecret()
  const token = encodeSession({ sub: userId, username })
  return `${SESSION_COOKIE_NAME}=${token}`
}

export function cookieHeader(userId: string, username: string): Record<string, string> {
  return { cookie: sessionCookie(userId, username) }
}

export async function insertCiUser(tag: string, id = randomUUID()) {
  const username = `ci_${tag}_${id.slice(0, 8)}`
  await db.insert(schema.users).values({
    id,
    username,
    email: `${username}@ci.c2k.test`,
    passwordHash: 'ci-test-hash',
  })
  return { id, username }
}

export async function buildCookieApp(register: (app: FastifyInstance) => Promise<void>) {
  ensureCiAuthSecret()
  const cookie = (await import('@fastify/cookie')).default
  const Fastify = (await import('fastify')).default
  const app = Fastify()
  await app.register(cookie)
  await register(app)
  return app
}

export async function deleteUsers(userIds: string[]) {
  if (userIds.length === 0) return
  for (const userId of userIds) {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
  }
}
