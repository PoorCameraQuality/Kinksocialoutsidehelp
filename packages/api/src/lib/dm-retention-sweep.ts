import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm'
import { loadRetentionPolicy, normalizePrivacySettings, resolveEffectiveDmRetentionDays } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  cutoffSql,
  hasCaseSnapshotForMessage,
  isConversationUnderRetentionHold,
  isMessageProtectedFromRetention,
} from './retention-protection.js'
import { secureDeleteDirectMessage } from './secure-delete.js'

export type DmRetentionSweepResult = {
  messagesErased: number
  conversationsPurged: number
  skippedLegalHold: number
  skippedRetentionPreference: number
}

type ParticipantRetention = { userId: string; retentionDays: number | null }

async function loadParticipantRetentions(conversationId: string): Promise<ParticipantRetention[]> {
  const participants = await db
    .select({ userId: schema.conversationParticipants.userId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.conversationId, conversationId))

  const settingsByUser = new Map<string, number | null>()
  for (const p of participants) {
    const [row] = await db
      .select({ privacySettings: schema.userSettings.privacySettings })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, p.userId))
      .limit(1)
    const privacy = normalizePrivacySettings(row?.privacySettings)
    settingsByUser.set(p.userId, resolveEffectiveDmRetentionDays(privacy.dmRetentionDays))
  }

  return participants.map((p) => ({
    userId: p.userId,
    retentionDays: settingsByUser.get(p.userId) ?? loadRetentionPolicy().platformDmRetentionDays,
  }))
}

/** Longest retention among participants; null if any participant chose keep-until-delete. */
export function effectiveConversationRetentionDays(
  participants: { retentionDays: number | null }[]
): number | null {
  if (participants.some((p) => p.retentionDays === null)) return null
  return Math.max(...participants.map((p) => p.retentionDays ?? 0))
}

export async function purgeExpiredDirectMessages(): Promise<{
  erased: number
  skippedLegalHold: number
  skippedRetentionPreference: number
}> {
  const policy = loadRetentionPolicy()
  const maxLookbackDays = Math.max(policy.platformDmRetentionDays, 730)
  const batch = await db
    .select({
      id: schema.messages.id,
      conversationId: schema.messages.conversationId,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(lt(schema.messages.createdAt, cutoffSql(maxLookbackDays)))
    .limit(200)

  let erased = 0
  let skippedLegalHold = 0
  let skippedRetentionPreference = 0
  const retentionCache = new Map<string, number | null>()

  for (const msg of batch) {
    if (await isMessageProtectedFromRetention(msg.id, msg.conversationId)) {
      skippedLegalHold += 1
      continue
    }

    let effectiveDays = retentionCache.get(msg.conversationId)
    if (effectiveDays === undefined) {
      const retentions = await loadParticipantRetentions(msg.conversationId)
      effectiveDays = effectiveConversationRetentionDays(retentions)
      retentionCache.set(msg.conversationId, effectiveDays)
    }

    if (effectiveDays === null) {
      skippedRetentionPreference += 1
      continue
    }

    const ageMs = Date.now() - msg.createdAt.getTime()
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    if (ageDays < effectiveDays) {
      skippedRetentionPreference += 1
      continue
    }

    if (await hasCaseSnapshotForMessage(msg.id)) {
      await secureDeleteDirectMessage(msg.id)
      erased += 1
      continue
    }

    await secureDeleteDirectMessage(msg.id)
    erased += 1
  }

  return { erased, skippedLegalHold, skippedRetentionPreference }
}

export async function purgeUserDeletedConversations(): Promise<{ purged: number; skippedLegalHold: number }> {
  const policy = loadRetentionPolicy()
  const cutoff = cutoffSql(policy.deletedConversationPurgeDays)

  const deletedRows = await db
    .select({
      conversationId: schema.conversationParticipants.conversationId,
      userId: schema.conversationParticipants.userId,
      deletedAt: schema.conversationParticipants.deletedAt,
    })
    .from(schema.conversationParticipants)
    .where(and(isNotNull(schema.conversationParticipants.deletedAt), lt(schema.conversationParticipants.deletedAt, cutoff)))
    .limit(100)

  const conversationIds = [...new Set(deletedRows.map((r) => r.conversationId))]
  let purged = 0
  let skippedLegalHold = 0

  for (const conversationId of conversationIds) {
    if (await isConversationUnderRetentionHold(conversationId)) {
      skippedLegalHold += 1
      continue
    }

    const participants = await db
      .select({ deletedAt: schema.conversationParticipants.deletedAt })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, conversationId))

    if (participants.length === 0) continue
    const allDeleted = participants.every((p) => p.deletedAt !== null)
    if (!allDeleted) continue

    const messages = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))

    for (const msg of messages) {
      if (await isMessageProtectedFromRetention(msg.id, conversationId)) {
        skippedLegalHold += 1
        continue
      }
      await secureDeleteDirectMessage(msg.id)
    }

    await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId))
    purged += 1
  }

  return { purged, skippedLegalHold }
}

export async function runDmRetentionSweep(): Promise<DmRetentionSweepResult> {
  const messages = await purgeExpiredDirectMessages()
  const conversations = await purgeUserDeletedConversations()
  return {
    messagesErased: messages.erased,
    conversationsPurged: conversations.purged,
    skippedLegalHold: messages.skippedLegalHold + conversations.skippedLegalHold,
    skippedRetentionPreference: messages.skippedRetentionPreference,
  }
}
