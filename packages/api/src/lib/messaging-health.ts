import { MESSAGING_HEALTH_STATES, type MessagingHealthState } from '@c2k/shared'
import { and, count, eq, gt, gte, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const WINDOW_HOURS = 24

export type MessagingHealthSummary = {
  state: MessagingHealthState
  windowStart: string
  windowEnd: string
  outboundMessageCount: number
  uniqueRecipientCount: number
  newConversationCount: number
  blockAfterContactCount: number
  muteAfterContactCount: number
  reportAfterContactCount: number
  independentReporterCount: number
  activeRestriction: {
    type: string
    reasonCategory: string
    expiresAt: string | null
    userNotice: string | null
  } | null
}

function deriveState(metrics: {
  accountAgeDays: number
  outboundMessageCount: number
  uniqueRecipientCount: number
  newConversationCount: number
  blockAfterContactCount: number
  reportAfterContactCount: number
  hasActiveRestriction: boolean
}): MessagingHealthState {
  if (metrics.hasActiveRestriction) return MESSAGING_HEALTH_STATES.restricted
  if (metrics.accountAgeDays < 14 && metrics.outboundMessageCount < 5) {
    return MESSAGING_HEALTH_STATES.newLimitedHistory
  }
  if (metrics.reportAfterContactCount >= 2 || metrics.blockAfterContactCount >= 3) {
    return MESSAGING_HEALTH_STATES.modReviewRecommended
  }
  if (metrics.newConversationCount >= 15 || metrics.uniqueRecipientCount >= 20) {
    return MESSAGING_HEALTH_STATES.highOutreachVolume
  }
  if (metrics.newConversationCount >= 10) {
    return MESSAGING_HEALTH_STATES.needsCooldown
  }
  return MESSAGING_HEALTH_STATES.healthy
}

export async function recomputeMessagingHealthRollup(userId: string): Promise<MessagingHealthSummary> {
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - WINDOW_HOURS * 60 * 60 * 1000)

  const [user] = await db
    .select({ createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  const accountAgeDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0

  const outboundRows = await db
    .select({ c: count() })
    .from(schema.messages)
    .where(and(eq(schema.messages.senderId, userId), gte(schema.messages.createdAt, windowStart)))

  const recipientRows = await db
    .selectDistinct({ otherUserId: schema.conversationParticipants.userId })
    .from(schema.messages)
    .innerJoin(
      schema.conversationParticipants,
      eq(schema.conversationParticipants.conversationId, schema.messages.conversationId)
    )
    .where(
      and(
        eq(schema.messages.senderId, userId),
        gte(schema.messages.createdAt, windowStart),
        sql`${schema.conversationParticipants.userId} <> ${userId}`
      )
    )

  const newConvRows = await db
    .select({ c: count() })
    .from(schema.conversations)
    .where(
      and(eq(schema.conversations.initiatorUserId, userId), gte(schema.conversations.createdAt, windowStart))
    )

  const [blockAfterRow] = await db
    .select({ c: count() })
    .from(schema.blocks)
    .where(
      and(
        eq(schema.blocks.blockedId, userId),
        gte(schema.blocks.createdAt, windowStart),
        sql`EXISTS (
          SELECT 1 FROM ${schema.messages} m
          INNER JOIN ${schema.conversationParticipants} cp_self
            ON cp_self.conversation_id = m.conversation_id AND cp_self.user_id = ${userId}
          INNER JOIN ${schema.conversationParticipants} cp_other
            ON cp_other.conversation_id = m.conversation_id AND cp_other.user_id = ${schema.blocks.blockerId}
          WHERE m.sender_id = ${userId} AND m.created_at < ${schema.blocks.createdAt}
        )`
      )
    )

  const [muteAfterRow] = await db
    .select({ c: count() })
    .from(schema.mutes)
    .where(
      and(
        eq(schema.mutes.targetKind, 'USER'),
        eq(schema.mutes.targetId, userId),
        gte(schema.mutes.createdAt, windowStart),
        sql`EXISTS (
          SELECT 1 FROM ${schema.messages} m
          INNER JOIN ${schema.conversationParticipants} cp_self
            ON cp_self.conversation_id = m.conversation_id AND cp_self.user_id = ${userId}
          INNER JOIN ${schema.conversationParticipants} cp_other
            ON cp_other.conversation_id = m.conversation_id AND cp_other.user_id = ${schema.mutes.userId}
          WHERE m.sender_id = ${userId} AND m.created_at < ${schema.mutes.createdAt}
        )`
      )
    )

  const [reportAfterRow] = await db
    .select({ c: count() })
    .from(schema.moderationReports)
    .innerJoin(schema.moderationCases, eq(schema.moderationReports.caseId, schema.moderationCases.id))
    .where(
      and(
        eq(schema.moderationCases.targetUserId, userId),
        gte(schema.moderationReports.createdAt, windowStart),
        sql`EXISTS (
          SELECT 1 FROM ${schema.messages} m
          INNER JOIN ${schema.conversationParticipants} cp_self
            ON cp_self.conversation_id = m.conversation_id AND cp_self.user_id = ${userId}
          INNER JOIN ${schema.conversationParticipants} cp_other
            ON cp_other.conversation_id = m.conversation_id AND cp_other.user_id = ${schema.moderationReports.reporterId}
          WHERE m.sender_id = ${userId} AND m.created_at < ${schema.moderationReports.createdAt}
        )`
      )
    )

  const [independentReporterRow] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${schema.incidentReports.reporterUserId})` })
    .from(schema.incidentReports)
    .innerJoin(schema.moderationIncidents, eq(schema.incidentReports.incidentId, schema.moderationIncidents.id))
    .where(
      and(
        eq(schema.moderationIncidents.primaryUserId, userId),
        eq(schema.incidentReports.isDuplicate, false),
        gte(schema.incidentReports.createdAt, windowStart)
      )
    )

  const blockAfterContactCount = Number(blockAfterRow?.c ?? 0)
  const muteAfterContactCount = Number(muteAfterRow?.c ?? 0)
  const reportAfterContactCount = Number(reportAfterRow?.c ?? 0)
  const independentReporterCount = Number(independentReporterRow?.c ?? 0)

  const [activeRestriction] = await db
    .select()
    .from(schema.messagingRestrictions)
    .where(
      and(
        eq(schema.messagingRestrictions.userId, userId),
        eq(schema.messagingRestrictions.status, 'ACTIVE'),
        or(
          isNull(schema.messagingRestrictions.expiresAt),
          gt(schema.messagingRestrictions.expiresAt, new Date())
        )
      )
    )
    .limit(1)

  const outboundMessageCount = Number(outboundRows[0]?.c ?? 0)
  const newConversationCount = Number(newConvRows[0]?.c ?? 0)

  const state = deriveState({
    accountAgeDays,
    outboundMessageCount,
    uniqueRecipientCount: recipientRows.length,
    newConversationCount,
    blockAfterContactCount,
    reportAfterContactCount,
    hasActiveRestriction: Boolean(activeRestriction),
  })

  await db.insert(schema.messagingHealthRollups).values({
    userId,
    windowStart,
    windowEnd,
    outboundMessageCount,
    uniqueRecipientCount: recipientRows.length,
    newConversationCount,
    blockAfterContactCount,
    muteAfterContactCount,
    reportAfterContactCount,
    independentReporterCount,
    state,
  })

  return {
    state,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    outboundMessageCount,
    uniqueRecipientCount: recipientRows.length,
    newConversationCount,
    blockAfterContactCount,
    muteAfterContactCount,
    reportAfterContactCount,
    independentReporterCount,
    activeRestriction: activeRestriction
      ? {
          type: activeRestriction.restrictionType,
          reasonCategory: activeRestriction.reasonCategory,
          expiresAt: activeRestriction.expiresAt?.toISOString() ?? null,
          userNotice:
            'Your ability to start new conversations is temporarily limited because recent outreach looked unusually high or unwanted.',
        }
      : null,
  }
}

export async function getMessagingHealthForUser(userId: string): Promise<MessagingHealthSummary> {
  const [latest] = await db
    .select()
    .from(schema.messagingHealthRollups)
    .where(eq(schema.messagingHealthRollups.userId, userId))
    .orderBy(sql`${schema.messagingHealthRollups.lastRecomputedAt} DESC`)
    .limit(1)

  if (!latest || Date.now() - latest.lastRecomputedAt.getTime() > WINDOW_HOURS * 60 * 60 * 1000) {
    return recomputeMessagingHealthRollup(userId)
  }

  const [activeRestriction] = await db
    .select()
    .from(schema.messagingRestrictions)
    .where(
      and(
        eq(schema.messagingRestrictions.userId, userId),
        eq(schema.messagingRestrictions.status, 'ACTIVE'),
        or(
          isNull(schema.messagingRestrictions.expiresAt),
          gt(schema.messagingRestrictions.expiresAt, new Date())
        )
      )
    )
    .limit(1)

  return {
    state: latest.state,
    windowStart: latest.windowStart.toISOString(),
    windowEnd: latest.windowEnd.toISOString(),
    outboundMessageCount: latest.outboundMessageCount,
    uniqueRecipientCount: latest.uniqueRecipientCount,
    newConversationCount: latest.newConversationCount,
    blockAfterContactCount: latest.blockAfterContactCount,
    muteAfterContactCount: latest.muteAfterContactCount,
    reportAfterContactCount: latest.reportAfterContactCount,
    independentReporterCount: latest.independentReporterCount,
    activeRestriction: activeRestriction
      ? {
          type: activeRestriction.restrictionType,
          reasonCategory: activeRestriction.reasonCategory,
          expiresAt: activeRestriction.expiresAt?.toISOString() ?? null,
          userNotice:
            'Your ability to start new conversations is temporarily limited because recent outreach looked unusually high or unwanted.',
        }
      : null,
  }
}

export async function assertCanStartNewConversation(userId: string): Promise<{
  allowed: boolean
  reason?: string
  userNotice?: string
}> {
  const health = await getMessagingHealthForUser(userId)
  if (health.activeRestriction) {
    return {
      allowed: false,
      reason: 'messaging_restriction_active',
      userNotice: health.activeRestriction.userNotice ?? undefined,
    }
  }
  if (health.state === MESSAGING_HEALTH_STATES.restricted) {
    return {
      allowed: false,
      reason: 'messaging_restricted',
      userNotice:
        'Your ability to start new conversations is temporarily limited because recent outreach looked unusually high or unwanted.',
    }
  }
  if (health.state === MESSAGING_HEALTH_STATES.needsCooldown && health.newConversationCount >= 10) {
    await db.insert(schema.messagingRestrictions).values({
      userId,
      restrictionType: 'DM_COOLDOWN',
      reasonCategory: 'high_outreach_volume',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      metadata: { auto: true, newConversationCount: health.newConversationCount },
    })
    return {
      allowed: false,
      reason: 'dm_cooldown_applied',
      userNotice:
        'Your ability to start new conversations is temporarily limited because recent outreach looked unusually high or unwanted.',
    }
  }
  return { allowed: true }
}
