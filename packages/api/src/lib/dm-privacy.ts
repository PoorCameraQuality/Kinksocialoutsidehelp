import { and, count, eq, sql } from 'drizzle-orm'
import { normalizePrivacySettings, type PrivacySettings } from '@c2k/shared'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { isBlockedPair } from './blocks.js'

export type DmPrivacyDeny = { ok: false; status: 403; error: string }
export type DmPrivacyAllow = { ok: true }
export type DmPrivacyResult = DmPrivacyAllow | DmPrivacyDeny

export type ProfileMessageHint =
  | 'connect_first'
  | 'limited'
  | 'unavailable'
  | 'request_pending'

/** Safe profile copy when Message is hidden — never reveals blocks or private settings. */
export function resolveProfileMessageHint(input: {
  canMessage: boolean
  gateError?: string
  connected: boolean
}): ProfileMessageHint | null {
  if (input.canMessage) {
    return input.connected ? null : 'request_pending'
  }
  const err = (input.gateError ?? '').toLowerCase()
  if (err.includes('blocked')) return 'unavailable'
  if (err.includes('connections')) return 'connect_first'
  if (err.includes('shared groups') || err.includes('not accepting')) return 'limited'
  return 'unavailable'
}

async function recipientPrivacySettings(recipientUserId: string): Promise<PrivacySettings> {
  const [row] = await db
    .select({ privacySettings: schema.userSettings.privacySettings })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, recipientUserId))
    .limit(1)
  return normalizePrivacySettings(row?.privacySettings)
}

async function usersShareGroup(userA: string, userB: string): Promise<boolean> {
  const [row] = await db
    .select({ c: count() })
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.userId, userB),
        sql`${schema.groupMembers.groupId} IN (
          SELECT group_id FROM group_members WHERE user_id = ${userA}
        )`,
      ),
    )
  return (row?.c ?? 0) > 0
}

/** Whether `initiatorId` may start or continue a DM to `recipientId` per recipient privacy. */
export async function assertCanInitiateDm(initiatorId: string, recipientId: string): Promise<DmPrivacyResult> {
  if (initiatorId === recipientId) {
    return { ok: false, status: 403, error: 'Cannot message yourself' }
  }
  if (await isBlockedPair(initiatorId, recipientId)) {
    return { ok: false, status: 403, error: 'Blocked' }
  }
  const privacy = await recipientPrivacySettings(recipientId)
  if (privacy.whoCanMessage === 'nobody') {
    return {
      ok: false,
      status: 403,
      error: 'This member is not accepting new messages',
    }
  }
  if (privacy.whoCanMessage === 'open') return { ok: true }
  if (privacy.whoCanMessage === 'groups_only') {
    if (!(await usersShareGroup(initiatorId, recipientId))) {
      return {
        ok: false,
        status: 403,
        error: 'This member only accepts messages from people in shared groups',
      }
    }
    return { ok: true }
  }
  const connected = (await loadAcceptedFriendUserIds(recipientId)).has(initiatorId)
  // Legacy stored value `friends` is treated as mutual connections (same as connections_only).
  if (privacy.whoCanMessage === 'connections_only' || privacy.whoCanMessage === 'friends') {
    if (!connected) {
      return {
        ok: false,
        status: 403,
        error: 'This member only accepts messages from connections',
      }
    }
  }
  return { ok: true }
}

/** Block outbound message when recipient privacy forbids DMs from this sender. */
export async function assertCanSendDmMessage(
  senderId: string,
  recipientUserIds: string[],
): Promise<DmPrivacyResult> {
  for (const recipientId of recipientUserIds) {
    if (recipientId === senderId) continue
    const gate = await assertCanInitiateDm(senderId, recipientId)
    if (!gate.ok) return gate
  }
  return { ok: true }
}
