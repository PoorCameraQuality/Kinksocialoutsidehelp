import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isUserIdentityBanned } from './peer-reputation.js'
import { isSiteAdmin, isSiteOwner, isTrustSafetyAdmin } from './platform-staff.js'
import { getEmailFromUserRow, userEmailSelect } from './user-email.js'
import { isUnderLegalHold } from './legal-hold.js'

export async function loadOwnerInvestigationSummary(targetUserId: string) {
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      createdAt: schema.users.createdAt,
      registrationIpPrefix: schema.users.registrationIpPrefix,
      sessionVersion: schema.users.sessionVersion,
      lastSeenAt: schema.users.lastSeenAt,
      ageVerificationStatus: schema.users.ageVerificationStatus,
    })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1)

  if (!user) return null

  const [profile] = await db
    .select({
      displayName: schema.profiles.displayName,
      updatedAt: schema.profiles.updatedAt,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, targetUserId))
    .limit(1)

  const [staffRow] = await db
    .select({ role: schema.platformStaff.role })
    .from(schema.platformStaff)
    .where(eq(schema.platformStaff.userId, targetUserId))
    .limit(1)

  const legalHoldActive = await isUnderLegalHold('user', targetUserId)
  const identityBanned = await isUserIdentityBanned(targetUserId)

  const [postCount] = await db
    .select({ c: count() })
    .from(schema.feedPosts)
    .where(eq(schema.feedPosts.authorId, targetUserId))

  const [dmConvCount] = await db
    .select({ c: count() })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, targetUserId))

  const [mediaCount] = await db
    .select({ c: count() })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.uploaderUserId, targetUserId))

  const roles: string[] = []
  if (await isSiteOwner(targetUserId)) roles.push('OWNER_ADMIN')
  if (await isSiteAdmin(targetUserId)) roles.push('SITE_ADMIN')
  if (await isTrustSafetyAdmin(targetUserId)) roles.push('TRUST_SAFETY_ADMIN')
  if (staffRow?.role === 'MODERATOR') roles.push('MODERATOR')
  if (staffRow?.role === 'LEGAL_ADMIN') roles.push('LEGAL_ADMIN')

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: profile?.displayName ?? null,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      ageVerificationStatus: user.ageVerificationStatus,
      accountStatus: identityBanned ? 'identity_banned' : 'active',
      platformRoles: roles,
      legalHoldActive,
    },
    counts: {
      feedPosts: Number(postCount?.c ?? 0),
      dmConversations: Number(dmConvCount?.c ?? 0),
      mediaAssets: Number(mediaCount?.c ?? 0),
    },
    profileUpdatedAt: profile?.updatedAt?.toISOString() ?? null,
  }
}

export async function loadOwnerSensitiveAccount(targetUserId: string) {
  const [user] = await db
    .select({
      ...userEmailSelect,
      registrationIpPrefix: schema.users.registrationIpPrefix,
    })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1)
  if (!user) return null

  const now = new Date()
  const [activeResetTokens] = await db
    .select({ c: count() })
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.userId, targetUserId),
        isNull(schema.passwordResetTokens.usedAt),
        gt(schema.passwordResetTokens.expiresAt, now),
      ),
    )

  const [usedResetTokens] = await db
    .select({ c: count() })
    .from(schema.passwordResetTokens)
    .where(
      and(eq(schema.passwordResetTokens.userId, targetUserId), sql`${schema.passwordResetTokens.usedAt} IS NOT NULL`),
    )

  return {
    email: getEmailFromUserRow(user),
    registrationIpPrefix: user.registrationIpPrefix ?? null,
    emailVerified: false,
    passwordResetSummary: {
      activeTokens: Number(activeResetTokens?.c ?? 0),
      completedResets: Number(usedResetTokens?.c ?? 0),
    },
  }
}

export async function loadOwnerActivityTimeline(targetUserId: string, limit = 50) {
  const posts = await db
    .select({
      id: schema.feedPosts.id,
      kind: schema.feedPosts.kind,
      title: schema.feedPosts.title,
      bodyPreview: sql<string>`left(${schema.feedPosts.body}, 200)`,
      createdAt: schema.feedPosts.createdAt,
    })
    .from(schema.feedPosts)
    .where(eq(schema.feedPosts.authorId, targetUserId))
    .orderBy(desc(schema.feedPosts.createdAt))
    .limit(limit)

  const comments = await db
    .select({
      id: schema.feedPostComments.id,
      postId: schema.feedPostComments.postId,
      bodyPreview: sql<string>`left(${schema.feedPostComments.body}, 200)`,
      createdAt: schema.feedPostComments.createdAt,
    })
    .from(schema.feedPostComments)
    .where(eq(schema.feedPostComments.authorId, targetUserId))
    .orderBy(desc(schema.feedPostComments.createdAt))
    .limit(limit)

  const activities = await db
    .select({
      id: schema.feedActivities.id,
      verb: schema.feedActivities.verb,
      objectType: schema.feedActivities.objectType,
      objectId: schema.feedActivities.objectId,
      createdAt: schema.feedActivities.createdAt,
    })
    .from(schema.feedActivities)
    .where(eq(schema.feedActivities.actorId, targetUserId))
    .orderBy(desc(schema.feedActivities.createdAt))
    .limit(limit)

  const filedReports = await db
    .select({
      id: schema.moderationReports.id,
      caseId: schema.moderationReports.caseId,
      policyReason: schema.moderationReports.policyReason,
      createdAt: schema.moderationReports.createdAt,
    })
    .from(schema.moderationReports)
    .where(eq(schema.moderationReports.reporterId, targetUserId))
    .orderBy(desc(schema.moderationReports.createdAt))
    .limit(limit)

  return {
    posts: posts.map((p) => ({
      type: 'feed_post' as const,
      id: p.id,
      kind: p.kind,
      title: p.title,
      preview: p.bodyPreview,
      at: p.createdAt.toISOString(),
    })),
    comments: comments.map((c) => ({
      type: 'feed_comment' as const,
      id: c.id,
      postId: c.postId,
      preview: c.bodyPreview,
      at: c.createdAt.toISOString(),
    })),
    activities: activities.map((a) => ({
      type: 'feed_activity' as const,
      id: a.id,
      verb: a.verb,
      objectType: a.objectType,
      objectId: a.objectId,
      at: a.createdAt.toISOString(),
    })),
    reportsFiled: filedReports.map((r) => ({
      type: 'report_filed' as const,
      id: r.id,
      caseId: r.caseId,
      policyReason: r.policyReason,
      at: r.createdAt.toISOString(),
    })),
  }
}

export async function loadOwnerDmConversations(targetUserId: string, limit = 50) {
  const memberships = await db
    .select({
      conversationId: schema.conversationParticipants.conversationId,
      acceptanceStatus: schema.conversationParticipants.acceptanceStatus,
      lastReadAt: schema.conversationParticipants.lastReadAt,
    })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, targetUserId))
    .limit(limit)

  const items = []
  for (const m of memberships) {
    const participants = await db
      .select({
        userId: schema.conversationParticipants.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.conversationParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.conversationParticipants.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conversationParticipants.userId))
      .where(eq(schema.conversationParticipants.conversationId, m.conversationId))

    const [msgCount] = await db
      .select({ c: count() })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, m.conversationId))

    const [lastMsg] = await db
      .select({ createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, m.conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1)

    items.push({
      conversationId: m.conversationId,
      acceptanceStatus: m.acceptanceStatus,
      messageCount: Number(msgCount?.c ?? 0),
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      participants: participants.map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName ?? null,
        isTarget: p.userId === targetUserId,
      })),
    })
  }

  return items
}

/** Read-only DM fetch - never updates last_read_at, participants, or notifications. */
export async function loadOwnerDmMessages(
  targetUserId: string,
  conversationId: string,
  limit = 100,
): Promise<{ items: { id: string; senderId: string; body: string; createdAt: string }[] } | null> {
  const [membership] = await db
    .select({ userId: schema.conversationParticipants.userId })
    .from(schema.conversationParticipants)
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, conversationId),
        eq(schema.conversationParticipants.userId, targetUserId),
      ),
    )
    .limit(1)
  if (!membership) return null

  const rows = await db
    .select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(Math.min(limit, 200))

  return {
    items: [...rows].reverse().map((r) => ({
      id: r.id,
      senderId: r.senderId,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function loadOwnerModerationBundle(targetUserId: string, limit = 50) {
  const casesAgainst = await db
    .select({
      id: schema.moderationCases.id,
      status: schema.moderationCases.status,
      queue: schema.moderationCases.queue,
      policyReason: schema.moderationCases.policyReason,
      createdAt: schema.moderationCases.createdAt,
    })
    .from(schema.moderationCases)
    .where(eq(schema.moderationCases.targetUserId, targetUserId))
    .orderBy(desc(schema.moderationCases.createdAt))
    .limit(limit)

  const reportsFiled = await db
    .select({
      id: schema.moderationReports.id,
      caseId: schema.moderationReports.caseId,
      policyReason: schema.moderationReports.policyReason,
      createdAt: schema.moderationReports.createdAt,
    })
    .from(schema.moderationReports)
    .where(eq(schema.moderationReports.reporterId, targetUserId))
    .orderBy(desc(schema.moderationReports.createdAt))
    .limit(limit)

  const scopeBans = await db
    .select({
      id: schema.scopeBans.id,
      scopeType: schema.scopeBans.scopeType,
      scopeId: schema.scopeBans.scopeId,
      active: schema.scopeBans.active,
      reason: schema.scopeBans.reason,
      expiresAt: schema.scopeBans.expiresAt,
    })
    .from(schema.scopeBans)
    .where(eq(schema.scopeBans.userId, targetUserId))
    .limit(limit)

  const blocksOut = await db
    .select({ blockedId: schema.blocks.blockedId, createdAt: schema.blocks.createdAt })
    .from(schema.blocks)
    .where(eq(schema.blocks.blockerId, targetUserId))
    .limit(limit)

  const blocksIn = await db
    .select({ blockerId: schema.blocks.blockerId, createdAt: schema.blocks.createdAt })
    .from(schema.blocks)
    .where(eq(schema.blocks.blockedId, targetUserId))
    .limit(limit)

  const mutesOut = await db
    .select({
      targetKind: schema.mutes.targetKind,
      targetId: schema.mutes.targetId,
      createdAt: schema.mutes.createdAt,
    })
    .from(schema.mutes)
    .where(eq(schema.mutes.userId, targetUserId))
    .limit(limit)

  return {
    casesAgainst,
    reportsFiled,
    scopeBans,
    blocksOut,
    blocksIn,
    mutesOut,
    identityBanned: await isUserIdentityBanned(targetUserId),
  }
}

export async function loadOwnerMediaBundle(targetUserId: string, limit = 50) {
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      uploadStatus: schema.mediaAssets.uploadStatus,
      scanStatus: schema.mediaAssets.scanStatus,
      contentRating: schema.mediaAssets.contentRating,
      mimeType: schema.mediaAssets.mimeType,
      sizeBytes: schema.mediaAssets.sizeBytes,
      sourceSurface: schema.mediaAssets.sourceSurface,
      createdAt: schema.mediaAssets.createdAt,
      promotedAt: schema.mediaAssets.promotedAt,
      removedAt: schema.mediaAssets.removedAt,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.uploaderUserId, targetUserId))
    .orderBy(desc(schema.mediaAssets.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    uploadStatus: r.uploadStatus,
    scanStatus: r.scanStatus,
    contentRating: r.contentRating,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    sourceSurface: r.sourceSurface,
    createdAt: r.createdAt.toISOString(),
    promotedAt: r.promotedAt?.toISOString() ?? null,
    removedAt: r.removedAt?.toISOString() ?? null,
  }))
}

/** Test helper: snapshot participant read state for a conversation. */
export async function snapshotDmReadState(conversationId: string, userId: string) {
  const [row] = await db
    .select({
      lastReadAt: schema.conversationParticipants.lastReadAt,
    })
    .from(schema.conversationParticipants)
    .where(
      and(
        eq(schema.conversationParticipants.conversationId, conversationId),
        eq(schema.conversationParticipants.userId, userId),
      ),
    )
    .limit(1)
  return row?.lastReadAt ?? null
}

export async function countConversationParticipants(conversationId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.conversationId, conversationId))
  return Number(row?.c ?? 0)
}

export async function countNotificationsForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
  return Number(row?.c ?? 0)
}
