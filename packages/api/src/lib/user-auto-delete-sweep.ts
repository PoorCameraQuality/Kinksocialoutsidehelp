import { and, eq, lt, sql } from 'drizzle-orm'
import { normalizePrivacySettings, type PrivacySettings } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { isUnderLegalHold } from './legal-hold.js'
import { secureDeleteDirectMessage, secureDeleteHubMessage } from './secure-delete.js'

export type UserAutoDeleteSweepResult = {
  directMessagesErased: number
  hubMessagesErased: number
  activityRowsErased: number
  skippedLegalHold: number
}

function cutoffSql(days: number) {
  return sql`now() - (${days}::int * interval '1 day')`
}

async function eraseExpiredDirectMessages(
  userId: string,
  days: number,
  skippedLegalHold: { count: number }
): Promise<number> {
  if (await isUnderLegalHold('user', userId)) {
    skippedLegalHold.count += 1
    return 0
  }

  const rows = await db
    .select({
      id: schema.messages.id,
      conversationId: schema.messages.conversationId,
    })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.senderId, userId),
        lt(schema.messages.createdAt, cutoffSql(days))
      )
    )
    .limit(500)

  let erased = 0
  for (const row of rows) {
    if (await isUnderLegalHold('message_thread', row.conversationId)) {
      skippedLegalHold.count += 1
      continue
    }
    await secureDeleteDirectMessage(row.id)
    erased += 1
  }
  return erased
}

async function eraseExpiredHubMessages(
  userId: string,
  days: number,
  skippedLegalHold: { count: number }
): Promise<number> {
  if (await isUnderLegalHold('user', userId)) {
    skippedLegalHold.count += 1
    return 0
  }

  const rows = await db
    .select({ id: schema.conventionHubChannelMessages.id })
    .from(schema.conventionHubChannelMessages)
    .where(
      and(
        eq(schema.conventionHubChannelMessages.senderId, userId),
        lt(schema.conventionHubChannelMessages.createdAt, cutoffSql(days))
      )
    )
    .limit(500)

  let erased = 0
  for (const row of rows) {
    await secureDeleteHubMessage(row.id)
    erased += 1
  }
  return erased
}

async function eraseExpiredActivity(
  userId: string,
  days: number,
  skippedLegalHold: { count: number }
): Promise<number> {
  if (await isUnderLegalHold('user', userId)) {
    skippedLegalHold.count += 1
    return 0
  }

  const deleted = await db
    .delete(schema.feedActivities)
    .where(
      and(eq(schema.feedActivities.actorId, userId), lt(schema.feedActivities.createdAt, cutoffSql(days)))
    )
    .returning({ id: schema.feedActivities.id })

  return deleted.length
}

function hasAutoDelete(settings: PrivacySettings): boolean {
  return (
    settings.directMessageAutoDeleteDays !== null ||
    settings.hubChatAutoDeleteDays !== null ||
    settings.activityAutoDeleteDays !== null
  )
}

/** Erase member content past user-configured TTLs. Respects legal holds. */
export async function runUserAutoDeleteSweep(): Promise<UserAutoDeleteSweepResult> {
  const skippedLegalHold = { count: 0 }
  let directMessagesErased = 0
  let hubMessagesErased = 0
  let activityRowsErased = 0

  const settingsRows = await db
    .select({
      userId: schema.userSettings.userId,
      privacySettings: schema.userSettings.privacySettings,
    })
    .from(schema.userSettings)

  for (const row of settingsRows) {
    const privacy = normalizePrivacySettings(row.privacySettings)
    if (!hasAutoDelete(privacy)) continue

    if (privacy.directMessageAutoDeleteDays !== null) {
      directMessagesErased += await eraseExpiredDirectMessages(
        row.userId,
        privacy.directMessageAutoDeleteDays,
        skippedLegalHold
      )
    }
    if (privacy.hubChatAutoDeleteDays !== null) {
      hubMessagesErased += await eraseExpiredHubMessages(
        row.userId,
        privacy.hubChatAutoDeleteDays,
        skippedLegalHold
      )
    }
    if (privacy.activityAutoDeleteDays !== null) {
      activityRowsErased += await eraseExpiredActivity(
        row.userId,
        privacy.activityAutoDeleteDays,
        skippedLegalHold
      )
    }
  }

  return {
    directMessagesErased,
    hubMessagesErased,
    activityRowsErased,
    skippedLegalHold: skippedLegalHold.count,
  }
}
