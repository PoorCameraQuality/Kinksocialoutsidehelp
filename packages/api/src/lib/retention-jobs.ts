import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { loadRetentionPolicy } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { isUnderLegalHold } from './legal-hold.js'
import { deleteObject, getS3Client } from './s3-upload.js'

const PASSWORD_RESET_PURGE_AFTER_MS = Number(
  process.env.PASSWORD_RESET_TOKEN_PURGE_MS ?? 24 * 60 * 60 * 1000
)
const QUARANTINE_STALE_MS = Number(process.env.QUARANTINE_STALE_MS ?? 7 * 24 * 60 * 60 * 1000)

/** Feed composer photos are committed to the gallery on upload; purge ones never posted. */
const FEED_COMPOSER_DRAFT_TTL_MS = Number(
  process.env.FEED_COMPOSER_DRAFT_TTL_MS ?? 24 * 60 * 60 * 1000,
)

export type RetentionJobResult = {
  passwordResetTokensDeleted: number
  registrationIpNulled: number
  quarantineObjectsDeleted: number
  quarantineRowsUpdated: number
  rejectedMediaPurged: number
  deletedMediaPurged: number
  abandonedFeedDraftsPurged: number
  notificationsDeleted: number
  staleSessionsDeleted: number
  skippedLegalHold: number
}

export async function purgeExpiredPasswordResetTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - PASSWORD_RESET_PURGE_AFTER_MS)
  const deleted = await db
    .delete(schema.passwordResetTokens)
    .where(
      or(
        lt(schema.passwordResetTokens.expiresAt, cutoff),
        isNotNull(schema.passwordResetTokens.usedAt),
      ),
    )
    .returning({ id: schema.passwordResetTokens.id })
  return deleted.length
}

export async function nullStaleRegistrationIpPrefixes(): Promise<{ nulled: number; skippedLegalHold: number }> {
  const policy = loadRetentionPolicy()
  const cutoff = new Date(Date.now() - policy.rawIpRetentionDays * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      id: schema.users.id,
      registrationIpPrefix: schema.users.registrationIpPrefix,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.registrationIpPrefix),
        lt(schema.users.createdAt, cutoff),
      ),
    )
    .limit(500)

  let nulled = 0
  let skippedLegalHold = 0
  for (const row of rows) {
    if (await isUnderLegalHold('user', row.id)) {
      skippedLegalHold += 1
      continue
    }
    await db
      .update(schema.users)
      .set({ registrationIpPrefix: null })
      .where(eq(schema.users.id, row.id))
    nulled += 1
  }
  return { nulled, skippedLegalHold }
}

export async function purgeStaleQuarantineMedia(): Promise<{ objectsDeleted: number; rowsUpdated: number }> {
  const staleBefore = new Date(Date.now() - QUARANTINE_STALE_MS)
  const staleStatuses = ['REJECTED', 'REMOVED', 'PENDING_ATTESTATION'] as const
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      quarantineStorageKey: schema.mediaAssets.quarantineStorageKey,
      uploadStatus: schema.mediaAssets.uploadStatus,
      uploaderUserId: schema.mediaAssets.uploaderUserId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        isNotNull(schema.mediaAssets.quarantineStorageKey),
        inArray(schema.mediaAssets.uploadStatus, [...staleStatuses]),
        lt(schema.mediaAssets.createdAt, staleBefore),
      ),
    )
    .limit(100)

  let objectsDeleted = 0
  let rowsUpdated = 0
  for (const row of rows) {
    if (await isUnderLegalHold('media', row.id)) continue
    if (await isUnderLegalHold('user', row.uploaderUserId)) continue
    const key = row.quarantineStorageKey
    if (key) {
      const client = getS3Client()
      if (client) {
        await deleteObject(client, key)
        objectsDeleted += 1
      }
    }
    await db
      .update(schema.mediaAssets)
      .set({ quarantineStorageKey: null, updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id))
    rowsUpdated += 1
  }
  return { objectsDeleted, rowsUpdated }
}

const STALE_SESSION_DAYS = Number(process.env.STALE_SESSION_RETENTION_DAYS ?? 90)

export async function purgeStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.createdAt, cutoff))
    .returning({ id: schema.sessions.id })
  return deleted.length
}

export async function purgeOldNotifications(): Promise<number> {
  const policy = loadRetentionPolicy()
  const cutoff = new Date(Date.now() - policy.notificationRetentionDays * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(schema.notifications)
    .where(lt(schema.notifications.createdAt, cutoff))
    .returning({ id: schema.notifications.id })
  return deleted.length
}

export async function purgeRejectedAndDeletedMedia(): Promise<{ rejected: number; deleted: number }> {
  const policy = loadRetentionPolicy()
  const rejectedCutoff = new Date(Date.now() - policy.rejectedMediaRetentionDays * 24 * 60 * 60 * 1000)
  const deletedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const rejectedRows = await db
    .select({
      id: schema.mediaAssets.id,
      quarantineStorageKey: schema.mediaAssets.quarantineStorageKey,
      uploaderUserId: schema.mediaAssets.uploaderUserId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.uploadStatus, 'REJECTED'),
        lt(schema.mediaAssets.updatedAt, rejectedCutoff)
      )
    )
    .limit(100)

  let rejected = 0
  for (const row of rejectedRows) {
    if (await isUnderLegalHold('media', row.id)) continue
    if (await isUnderLegalHold('user', row.uploaderUserId)) continue
    const key = row.quarantineStorageKey
    const client = getS3Client()
    if (key && client) await deleteObject(client, key)
    await db
      .update(schema.mediaAssets)
      .set({ quarantineStorageKey: null, updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id))
    rejected += 1
  }

  const deletedRows = await db
    .select({
      id: schema.mediaAssets.id,
      storageKey: schema.mediaAssets.storageKey,
      uploaderUserId: schema.mediaAssets.uploaderUserId,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        inArray(schema.mediaAssets.uploadStatus, ['REMOVED']),
        lt(schema.mediaAssets.updatedAt, deletedCutoff)
      )
    )
    .limit(100)

  let deletedCount = 0
  for (const row of deletedRows) {
    if (await isUnderLegalHold('media', row.id)) continue
    if (await isUnderLegalHold('user', row.uploaderUserId)) continue
    const key = row.storageKey
    const client = getS3Client()
    if (key && client) await deleteObject(client, key)
    await db
      .update(schema.mediaAssets)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.mediaAssets.id, row.id))
    deletedCount += 1
  }

  return { rejected, deleted: deletedCount }
}

/**
 * Soft-delete feed composer photos that were staged into the gallery but never attached to a
 * feed post within the TTL. Identified by `feed_upload` source surface + null
 * `originalFeedPostId`. Soft-deleting the item removes it from the gallery and frees the user's
 * personal photo quota immediately; the asset is flagged REMOVED so S3 cleanup runs via the
 * existing rejected/removed media purge.
 */
export async function purgeAbandonedFeedComposerDrafts(): Promise<number> {
  const cutoff = new Date(Date.now() - FEED_COMPOSER_DRAFT_TTL_MS)
  const rows = await db
    .select({
      id: schema.mediaItems.id,
      mediaAssetId: schema.mediaItems.mediaAssetId,
      ownerUserId: schema.mediaItems.ownerUserId,
    })
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.sourceSurface, 'feed_upload'),
        isNull(schema.mediaItems.originalFeedPostId),
        isNull(schema.mediaItems.deletedAt),
        lt(schema.mediaItems.createdAt, cutoff),
      ),
    )
    .limit(200)

  if (rows.length === 0) return 0

  const now = new Date()
  let purged = 0
  for (const row of rows) {
    if (await isUnderLegalHold('media', row.mediaAssetId)) continue
    if (await isUnderLegalHold('user', row.ownerUserId)) continue

    await db
      .update(schema.mediaItems)
      .set({ deletedAt: now, updatedAt: now, showInFeed: false })
      .where(eq(schema.mediaItems.id, row.id))

    // Drop the orphan media post wrapper if it was never linked to a feed post.
    const postLinks = await db
      .select({ mediaPostId: schema.mediaPostItems.mediaPostId })
      .from(schema.mediaPostItems)
      .where(eq(schema.mediaPostItems.mediaItemId, row.id))
    const postIds = postLinks.map((p) => p.mediaPostId)
    if (postIds.length) {
      await db
        .update(schema.mediaPosts)
        .set({ deletedAt: now, updatedAt: now, showInFeed: false })
        .where(and(inArray(schema.mediaPosts.id, postIds), isNull(schema.mediaPosts.feedPostId)))
    }

    // Feed composer creates one dedicated asset per item, so flagging it REMOVED is safe and
    // lets the existing S3 purge reclaim storage.
    await db
      .update(schema.mediaAssets)
      .set({ uploadStatus: 'REMOVED', updatedAt: now })
      .where(eq(schema.mediaAssets.id, row.mediaAssetId))

    purged += 1
  }

  return purged
}

export async function runRetentionJobs(): Promise<RetentionJobResult> {
  const passwordResetTokensDeleted = await purgeExpiredPasswordResetTokens()
  const ipResult = await nullStaleRegistrationIpPrefixes()
  const quarantine = await purgeStaleQuarantineMedia()
  const media = await purgeRejectedAndDeletedMedia()
  const abandonedFeedDraftsPurged = await purgeAbandonedFeedComposerDrafts()
  const notificationsDeleted = await purgeOldNotifications()
  const staleSessionsDeleted = await purgeStaleSessions()
  return {
    passwordResetTokensDeleted,
    registrationIpNulled: ipResult.nulled,
    quarantineObjectsDeleted: quarantine.objectsDeleted,
    quarantineRowsUpdated: quarantine.rowsUpdated,
    rejectedMediaPurged: media.rejected,
    deletedMediaPurged: media.deleted,
    abandonedFeedDraftsPurged,
    notificationsDeleted,
    staleSessionsDeleted,
    skippedLegalHold: ipResult.skippedLegalHold,
  }
}

/** Batch-encrypt legacy plaintext emails (run after migration). */
export async function migratePlaintextEmailsBatch(limit = 200): Promise<number> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.email),
        isNull(schema.users.emailCiphertext),
      ),
    )
    .limit(limit)

  const { migrateUserEmailEncryption } = await import('./user-email.js')
  let migrated = 0
  for (const row of rows) {
    if (await migrateUserEmailEncryption(row.id)) migrated += 1
  }
  return migrated
}
