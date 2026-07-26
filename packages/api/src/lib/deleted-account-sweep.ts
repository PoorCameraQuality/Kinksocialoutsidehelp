import { and, eq, isNotNull, lt } from 'drizzle-orm'
import { loadRetentionPolicy } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { isUnderLegalHold } from './legal-hold.js'
import { cutoffSql } from './retention-protection.js'
import { secureDeleteDirectMessage } from './secure-delete.js'
import { deleteObject, getS3Client } from './s3-upload.js'

export type DeletedAccountSweepResult = {
  accountsPurged: number
  sessionsDeleted: number
  messagesErased: number
  mediaObjectsDeleted: number
  skippedLegalHold: number
}

const DELETED_USERNAME_PREFIX = 'deleted_'

async function anonymizeUserAccount(userId: string): Promise<{
  sessionsDeleted: number
  messagesErased: number
  mediaObjectsDeleted: number
}> {
  const sessionsDeleted = (
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).returning({ id: schema.sessions.id })
  ).length

  await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, userId))

  const [userRow] = await db
    .select({ sessionVersion: schema.users.sessionVersion })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  await db
    .update(schema.users)
    .set({
      email: null,
      emailCiphertext: null,
      emailLookupHash: null,
      passwordHash: '$deleted-account$',
      registrationIpPrefix: null,
      sessionVersion: (userRow?.sessionVersion ?? 0) + 1,
    })
    .where(eq(schema.users.id, userId))

  await db
    .update(schema.profiles)
    .set({
      displayName: 'Deleted account',
      bio: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.profiles.userId, userId))

  const messageRows = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(eq(schema.messages.senderId, userId))
    .limit(500)

  let messagesErased = 0
  for (const row of messageRows) {
    await secureDeleteDirectMessage(row.id)
    messagesErased += 1
  }

  const mediaRows = await db
    .select({
      id: schema.mediaAssets.id,
      storageKey: schema.mediaAssets.storageKey,
      quarantineStorageKey: schema.mediaAssets.quarantineStorageKey,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.uploaderUserId, userId))
    .limit(200)

  let mediaObjectsDeleted = 0
  const client = getS3Client()
  for (const row of mediaRows) {
    if (await isUnderLegalHold('media', row.id)) continue
    for (const key of [row.storageKey, row.quarantineStorageKey]) {
      if (key && client) {
        await deleteObject(client, key)
        mediaObjectsDeleted += 1
      }
    }
    await db
      .update(schema.mediaAssets)
      .set({
        quarantineStorageKey: null,
        uploadStatus: 'REMOVED',
        removedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAssets.id, row.id))
  }

  await db
    .update(schema.userPrivacyRequests)
    .set({ status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.userPrivacyRequests.userId, userId),
        eq(schema.userPrivacyRequests.requestType, 'DELETE'),
        eq(schema.userPrivacyRequests.status, 'PROCESSING')
      )
    )

  return { sessionsDeleted, messagesErased, mediaObjectsDeleted }
}

/** Purge private data for accounts past the deleted-account retention window. */
export async function runDeletedAccountSweep(): Promise<DeletedAccountSweepResult> {
  const policy = loadRetentionPolicy()
  const cutoff = cutoffSql(policy.deletedAccountPurgeDays)

  const rows = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(and(isNotNull(schema.users.deletedAt), lt(schema.users.deletedAt, cutoff)))
    .limit(50)

  let accountsPurged = 0
  let sessionsDeleted = 0
  let messagesErased = 0
  let mediaObjectsDeleted = 0
  let skippedLegalHold = 0

  for (const user of rows) {
    if (await isUnderLegalHold('user', user.id)) {
      skippedLegalHold += 1
      continue
    }

    const result = await anonymizeUserAccount(user.id)
    sessionsDeleted += result.sessionsDeleted
    messagesErased += result.messagesErased
    mediaObjectsDeleted += result.mediaObjectsDeleted

    if (!user.username.startsWith(DELETED_USERNAME_PREFIX)) {
      const suffix = user.id.replace(/-/g, '').slice(0, 8)
      await db
        .update(schema.users)
        .set({ username: `${DELETED_USERNAME_PREFIX}${suffix}` })
        .where(eq(schema.users.id, user.id))
    }

    accountsPurged += 1
  }

  return {
    accountsPurged,
    sessionsDeleted,
    messagesErased,
    mediaObjectsDeleted,
    skippedLegalHold,
  }
}

/** Mark account deleted: disable login, hide profile, queue purge. */
export async function softDeleteUserAccount(userId: string): Promise<void> {
  const [user] = await db
    .select({ sessionVersion: schema.users.sessionVersion })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  const now = new Date()
  await db
    .update(schema.users)
    .set({
      deletedAt: now,
      sessionVersion: (user?.sessionVersion ?? 0) + 1,
    })
    .where(eq(schema.users.id, userId))

  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId))
}
