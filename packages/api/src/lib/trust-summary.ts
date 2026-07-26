import { MODERATION_CASE_STATUSES, MODERATION_QUEUES } from '@c2k/shared'
import { and, count, eq, gt, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { buildCommunityTrust } from './community-trust.js'
import { getIncidentSummaryForUser } from './incident-clustering.js'
import { getMessagingHealthForUser } from './messaging-health.js'
import { countLevelBoostingReferences } from './reference-trust.js'
import { loadReputationIntegritySignals, type ReputationIntegritySignal } from './trust-integrity-signals.js'

const RESTRICTED_QUEUE = MODERATION_QUEUES.minorSafetyRestricted

export type TrustSummaryUnavailable = {
  status: 'unavailable'
  reason: string
}

export type ModeratorTrustSummary = {
  userId: string
  username: string
  account: {
    createdAt: string
    accountAgeDays: number
    ageAffirmed: boolean
    profileComplete: boolean | null
    hasProfilePhoto: boolean
  }
  positiveSignals: {
    acceptedReferences: number
    countedReferencesForLevel: number
    conventionRegistrations: number
    staffConfirmedCheckIns: number
    verifiedPresenterCredits: number
    verifiedVendorCredits: number
    organizerRoles: number
  }
  moderationContext: {
    openCases: number
    closedNoViolationCases: number
    actionedCases: number
    profileReviewFlags: number
    scopeBansTotal: number
    activeScopeBans: number
    restrictedQueueCases: number | null
    blockedByUsersCount: number
    mutedByUsersCount: number
  }
  restrictions: {
    identityBanActive: boolean | null
  }
  communityTrust: {
    level: string
    headline: string
    badgeCount: number
  } | null
  messagingHealth: MessagingHealthSummary | TrustSummaryUnavailable
  incidentClustering: IncidentSummary | TrustSummaryUnavailable
  appeals: AppealsSummary | TrustSummaryUnavailable
  trustSignals: TrustSignalsSummary | TrustSummaryUnavailable
  reputationIntegritySignals: ReputationIntegritySignalsPayload | TrustSummaryUnavailable
  warnings: string[]
}

type ReputationIntegritySignalsPayload = {
  status: 'available'
  items: ReputationIntegritySignal[]
}

type TrustSignalsSummary = {
  status: 'available'
  platformMod: number
  scopedMod: number
  siteAdminOnly: number
}

type MessagingHealthSummary = {
  status: 'available'
  state: string
  outboundMessageCount: number
  uniqueRecipientCount: number
  newConversationCount: number
  blockAfterContactCount: number
  muteAfterContactCount: number
  reportAfterContactCount: number
  activeRestriction: boolean
}

type IncidentSummary = {
  status: 'available'
  openIncidents: number
  totalLinkedReports: number
  recentIncidents: Array<{
    id: string
    status: string
    policyReason: string | null
    linkedReportCount: number
    platformEscalated: boolean
  }>
}

type AppealsSummary = {
  status: 'available'
  openScopedAppeals: number
  openPlatformAppeals: number
}

function accountAgeDays(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
}

function profileLooksComplete(prof: {
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  homeZip: string | null
  birthDate: string | null
}): boolean {
  return Boolean(
    prof.displayName?.trim() &&
      prof.bio?.trim() &&
      prof.avatarUrl?.trim() &&
      prof.homeZip?.trim() &&
      prof.birthDate
  )
}

export async function buildModeratorTrustSummary(
  userId: string,
  opts: { viewerIsSiteAdmin: boolean }
): Promise<ModeratorTrustSummary | null> {
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      createdAt: schema.users.createdAt,
      ageAffirmedAt: schema.users.ageAffirmedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!user) return null

  const [prof] = await db
    .select({
      displayName: schema.profiles.displayName,
      bio: schema.profiles.bio,
      avatarUrl: schema.profiles.avatarUrl,
      homeZip: schema.profiles.homeZip,
      birthDate: schema.profiles.birthDate,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1)

  const nonRestrictedFilter = opts.viewerIsSiteAdmin ? [] : [ne(schema.moderationCases.queue, RESTRICTED_QUEUE)]

  const [
    refsRow,
    regRow,
    checkInRow,
    presenterRow,
    vendorRow,
    orgRoleRow,
    openCasesRow,
    closedNvRow,
    actionedRow,
    flagsRow,
    scopeTotalRow,
    scopeActiveRow,
    restrictedRow,
    blocksRow,
    mutesRow,
    photoCountRow,
  ] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.profileReferences)
      .where(
        and(eq(schema.profileReferences.subjectUserId, userId), eq(schema.profileReferences.status, 'ACCEPTED'))
      ),
    db
      .select({ c: count() })
      .from(schema.conventionRegistrants)
      .where(eq(schema.conventionRegistrants.userId, userId)),
    db
      .select({ c: count() })
      .from(schema.conventionCheckIns)
      .where(
        and(eq(schema.conventionCheckIns.userId, userId), isNotNull(schema.conventionCheckIns.checkedInByUserId))
      ),
    db
      .select({ c: count() })
      .from(schema.presenterTeachingCredits)
      .where(
        and(
          eq(schema.presenterTeachingCredits.presenterUserId, userId),
          eq(schema.presenterTeachingCredits.verified, true)
        )
      ),
    db
      .select({ c: count() })
      .from(schema.vendorEventCredits)
      .innerJoin(schema.vendorProfiles, eq(schema.vendorEventCredits.vendorProfileId, schema.vendorProfiles.id))
      .where(and(eq(schema.vendorProfiles.userId, userId), eq(schema.vendorEventCredits.verified, true))),
    db
      .select({ c: count() })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.userId, userId),
          inArray(schema.organizationMembers.role, ['OWNER', 'ADMIN'])
        )
      ),
    db
      .select({ c: count() })
      .from(schema.moderationCases)
      .where(
        and(
          eq(schema.moderationCases.targetUserId, userId),
          inArray(schema.moderationCases.status, [
            MODERATION_CASE_STATUSES.open,
            MODERATION_CASE_STATUSES.triaged,
            MODERATION_CASE_STATUSES.escalated,
          ]),
          ...nonRestrictedFilter
        )
      ),
    db
      .select({ c: count() })
      .from(schema.moderationCases)
      .where(
        and(
          eq(schema.moderationCases.targetUserId, userId),
          inArray(schema.moderationCases.status, [
            MODERATION_CASE_STATUSES.closedNoViolation,
            MODERATION_CASE_STATUSES.closedDuplicate,
          ]),
          ...nonRestrictedFilter
        )
      ),
    db
      .select({ c: count() })
      .from(schema.moderationCases)
      .where(
        and(
          eq(schema.moderationCases.targetUserId, userId),
          eq(schema.moderationCases.status, MODERATION_CASE_STATUSES.actioned),
          ...nonRestrictedFilter
        )
      ),
    db
      .select({ c: count() })
      .from(schema.profileReviewFlags)
      .where(and(eq(schema.profileReviewFlags.targetUserId, userId), eq(schema.profileReviewFlags.status, 'OPEN'))),
    db.select({ c: count() }).from(schema.scopeBans).where(eq(schema.scopeBans.userId, userId)),
    db
      .select({ c: count() })
      .from(schema.scopeBans)
      .where(
        and(
          eq(schema.scopeBans.userId, userId),
          eq(schema.scopeBans.active, true),
          or(isNull(schema.scopeBans.expiresAt), gt(schema.scopeBans.expiresAt, new Date()))
        )
      ),
    opts.viewerIsSiteAdmin
      ? db
          .select({ c: count() })
          .from(schema.moderationCases)
          .where(
            and(eq(schema.moderationCases.targetUserId, userId), eq(schema.moderationCases.queue, RESTRICTED_QUEUE))
          )
      : Promise.resolve([{ c: 0 }]),
    db.select({ c: count() }).from(schema.blocks).where(eq(schema.blocks.blockedId, userId)),
    db
      .select({ c: count() })
      .from(schema.mutes)
      .where(and(eq(schema.mutes.targetKind, 'USER'), eq(schema.mutes.targetId, userId))),
    db
      .select({ c: count() })
      .from(schema.profilePhotos)
      .innerJoin(schema.profiles, eq(schema.profilePhotos.profileId, schema.profiles.id))
      .where(eq(schema.profiles.userId, userId)),
  ])

  let identityBanActive: boolean | null = null
  if (opts.viewerIsSiteAdmin) {
    const [banRow] = await db
      .select({ c: count() })
      .from(schema.identityBans)
      .where(
        and(
          eq(schema.identityBans.userId, userId),
          or(isNull(schema.identityBans.expiresAt), gt(schema.identityBans.expiresAt, new Date()))
        )
      )
    identityBanActive = Number(banRow?.c ?? 0) > 0
  }

  const hasPhoto = Boolean(prof?.avatarUrl?.trim()) || Number(photoCountRow[0]?.c ?? 0) > 0

  const communityTrust = await buildCommunityTrust(userId, {
    viewerUserId: null,
    username: user.username,
  })

  let messagingHealth: ModeratorTrustSummary['messagingHealth'] = {
    status: 'unavailable',
    reason: 'rollups_not_implemented',
  }
  let incidentClustering: ModeratorTrustSummary['incidentClustering'] = {
    status: 'unavailable',
    reason: 'not_implemented',
  }
  let appeals: ModeratorTrustSummary['appeals'] = {
    status: 'unavailable',
    reason: 'not_implemented',
  }
  let trustSignals: ModeratorTrustSummary['trustSignals'] = {
    status: 'unavailable',
    reason: 'not_implemented',
  }
  let reputationIntegritySignals: ModeratorTrustSummary['reputationIntegritySignals'] = {
    status: 'unavailable',
    reason: 'not_implemented',
  }

  const refCounts = await countLevelBoostingReferences(userId)

  try {
    const mh = await getMessagingHealthForUser(userId)
    messagingHealth = {
      status: 'available',
      state: mh.state,
      outboundMessageCount: mh.outboundMessageCount,
      uniqueRecipientCount: mh.uniqueRecipientCount,
      newConversationCount: mh.newConversationCount,
      blockAfterContactCount: mh.blockAfterContactCount,
      muteAfterContactCount: mh.muteAfterContactCount,
      reportAfterContactCount: mh.reportAfterContactCount,
      activeRestriction: Boolean(mh.activeRestriction),
    }
  } catch {
    /* tables may not exist yet */
  }

  try {
    const inc = await getIncidentSummaryForUser(userId)
    incidentClustering = {
      status: 'available',
      openIncidents: inc.openIncidents,
      totalLinkedReports: inc.totalLinkedReports,
      recentIncidents: inc.recentIncidents,
    }
  } catch {
    /* tables may not exist yet */
  }

  try {
    const [scopedAppeals, platformAppeals] = await Promise.all([
      db
        .select({ c: count() })
        .from(schema.scopedModerationAppeals)
        .where(
          and(eq(schema.scopedModerationAppeals.userId, userId), eq(schema.scopedModerationAppeals.status, 'OPEN'))
        ),
      db
        .select({ c: count() })
        .from(schema.moderationAppeals)
        .innerJoin(schema.moderationCases, eq(schema.moderationCases.id, schema.moderationAppeals.caseId))
        .where(
          and(
            eq(schema.moderationAppeals.appellantUserId, userId),
            eq(schema.moderationAppeals.status, 'OPEN'),
            eq(schema.moderationCases.targetUserId, userId)
          )
        ),
    ])
    appeals = {
      status: 'available',
      openScopedAppeals: Number(scopedAppeals[0]?.c ?? 0),
      openPlatformAppeals: Number(platformAppeals[0]?.c ?? 0),
    }
  } catch {
    /* tables may not exist yet */
  }

  try {
    const [platformMod, scopedMod, siteAdminOnly] = await Promise.all([
      db
        .select({ c: count() })
        .from(schema.trustSignalEvents)
        .where(
          and(
            eq(schema.trustSignalEvents.userId, userId),
            eq(schema.trustSignalEvents.visibility, 'PLATFORM_MOD'),
            eq(schema.trustSignalEvents.status, 'ACTIVE')
          )
        ),
      db
        .select({ c: count() })
        .from(schema.trustSignalEvents)
        .where(
          and(
            eq(schema.trustSignalEvents.userId, userId),
            eq(schema.trustSignalEvents.visibility, 'SCOPED_MOD'),
            eq(schema.trustSignalEvents.status, 'ACTIVE')
          )
        ),
      opts.viewerIsSiteAdmin
        ? db
            .select({ c: count() })
            .from(schema.trustSignalEvents)
            .where(
              and(
                eq(schema.trustSignalEvents.userId, userId),
                eq(schema.trustSignalEvents.visibility, 'SITE_ADMIN_ONLY'),
                eq(schema.trustSignalEvents.status, 'ACTIVE')
              )
            )
        : Promise.resolve([{ c: 0 }]),
    ])
    trustSignals = {
      status: 'available',
      platformMod: Number(platformMod[0]?.c ?? 0),
      scopedMod: Number(scopedMod[0]?.c ?? 0),
      siteAdminOnly: opts.viewerIsSiteAdmin ? Number(siteAdminOnly[0]?.c ?? 0) : 0,
    }
    const items = await loadReputationIntegritySignals(userId, { viewerIsSiteAdmin: opts.viewerIsSiteAdmin })
    reputationIntegritySignals = { status: 'available', items }
  } catch {
    /* tables may not exist yet */
  }

  return {
    userId: user.id,
    username: user.username,
    account: {
      createdAt: user.createdAt.toISOString(),
      accountAgeDays: accountAgeDays(user.createdAt),
      ageAffirmed: Boolean(user.ageAffirmedAt),
      profileComplete: prof ? profileLooksComplete(prof) : null,
      hasProfilePhoto: hasPhoto,
    },
    positiveSignals: {
      acceptedReferences: refCounts.totalAccepted,
      countedReferencesForLevel: refCounts.countedForLevel,
      conventionRegistrations: Number(regRow[0]?.c ?? 0),
      staffConfirmedCheckIns: Number(checkInRow[0]?.c ?? 0),
      verifiedPresenterCredits: Number(presenterRow[0]?.c ?? 0),
      verifiedVendorCredits: Number(vendorRow[0]?.c ?? 0),
      organizerRoles: Number(orgRoleRow[0]?.c ?? 0),
    },
    moderationContext: {
      openCases: Number(openCasesRow[0]?.c ?? 0),
      closedNoViolationCases: Number(closedNvRow[0]?.c ?? 0),
      actionedCases: Number(actionedRow[0]?.c ?? 0),
      profileReviewFlags: Number(flagsRow[0]?.c ?? 0),
      scopeBansTotal: Number(scopeTotalRow[0]?.c ?? 0),
      activeScopeBans: Number(scopeActiveRow[0]?.c ?? 0),
      restrictedQueueCases: opts.viewerIsSiteAdmin ? Number(restrictedRow[0]?.c ?? 0) : null,
      blockedByUsersCount: Number(blocksRow[0]?.c ?? 0),
      mutedByUsersCount: Number(mutesRow[0]?.c ?? 0),
    },
    restrictions: {
      identityBanActive,
    },
    communityTrust: communityTrust
      ? {
          level: communityTrust.level,
          headline: communityTrust.headline,
          badgeCount: communityTrust.badges.length,
        }
      : null,
    messagingHealth,
    incidentClustering,
    appeals,
    trustSignals,
    reputationIntegritySignals,
    warnings: ['Legacy trust_score is deprecated and excluded from this summary.'],
  }
}
