import { eq } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'

/** JWT `sub` has no matching `users` row (common after DB reset without clearing cookies). */
export class ViewerUserNotFoundError extends Error {
  readonly code = 'VIEWER_USER_NOT_FOUND' as const

  constructor(readonly userId: string) {
    super(`No users row for viewer ${userId}`)
    this.name = 'ViewerUserNotFoundError'
  }
}

export function replyIfViewerUserNotFound(err: unknown, reply: FastifyReply): boolean {
  if (!(err instanceof ViewerUserNotFoundError)) return false
  void reply.status(401).send({
    error: 'Session user not found',
    code: err.code,
    hint: 'Sign out and sign in again. After a local DB reset, run db:seed and log in with a seed user.',
  })
  return true
}

async function assertViewerUserExists(userId: string) {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!user) throw new ViewerUserNotFoundError(userId)
}

export async function ensureUserSettingsRow(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1)
  if (existing) return existing
  await assertViewerUserExists(userId)
  const [row] = await db
    .insert(schema.userSettings)
    .values({
      userId,
      privacySettings: defaultPrivacySettings,
      notificationSettings: defaultNotificationSettings,
      feedSettings: defaultFeedSettings,
    })
    .returning()
  if (!row) throw new Error('insert user_settings failed')
  return row
}
