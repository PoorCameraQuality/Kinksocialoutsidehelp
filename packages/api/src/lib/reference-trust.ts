import { COMMUNITY_TRUST_LEVELS } from '@c2k/shared'
import { REFERRER_MIN_ACCOUNT_AGE_DAYS } from '@c2k/shared'
import { and, count, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { deriveCommunityTrustLevel, type PositiveCounts } from './community-trust.js'
import {
  accountAgeDays,
  filterReferencesByIpCluster,
  isReferenceFresh,
  isSameSignupCohort,
} from './reputation-anti-gaming.js'

export type ReferenceEligibilityInput = {
  referrerId: string
  subjectUserId: string
  referrerCreatedAt: Date
  subjectCreatedAt: Date
  referrerIpPrefix: string | null
  subjectExistingCountedIpPrefixes: Set<string>
}

export function evaluateReferenceCountsTowardLevel(input: ReferenceEligibilityInput): {
  countsTowardLevel: boolean
  sameSignupCohort: boolean
  referrerAccountAgeDays: number
} {
  const referrerAccountAgeDays = accountAgeDays(input.referrerCreatedAt)
  const sameSignupCohort = isSameSignupCohort(input.referrerCreatedAt, input.subjectCreatedAt)
  const ipKey = input.referrerIpPrefix?.trim() ?? ''

  let countsTowardLevel = true
  if (referrerAccountAgeDays < REFERRER_MIN_ACCOUNT_AGE_DAYS) countsTowardLevel = false
  if (sameSignupCohort) countsTowardLevel = false
  if (ipKey && input.subjectExistingCountedIpPrefixes.has(ipKey)) countsTowardLevel = false

  return { countsTowardLevel, sameSignupCohort, referrerAccountAgeDays }
}

export async function referrerMeetsEstablishedFloor(referrerId: string): Promise<boolean> {
  const [user] = await db
    .select({ createdAt: schema.users.createdAt, ageAffirmedAt: schema.users.ageAffirmedAt })
    .from(schema.users)
    .where(eq(schema.users.id, referrerId))
    .limit(1)
  if (!user) return false

  const [prof] = await db
    .select({
      displayName: schema.profiles.displayName,
      bio: schema.profiles.bio,
      avatarUrl: schema.profiles.avatarUrl,
      homeZip: schema.profiles.homeZip,
      birthDate: schema.profiles.birthDate,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, referrerId))
    .limit(1)

  const [refs, checkIns] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.profileReferences)
      .where(
        and(eq(schema.profileReferences.subjectUserId, referrerId), eq(schema.profileReferences.status, 'ACCEPTED'))
      ),
    db
      .select({ c: count() })
      .from(schema.conventionCheckIns)
      .where(
        and(eq(schema.conventionCheckIns.userId, referrerId), isNotNull(schema.conventionCheckIns.checkedInByUserId))
      ),
  ])

  const counts: PositiveCounts = {
    acceptedReferences: Number(refs[0]?.c ?? 0),
    countedReferences: Number(refs[0]?.c ?? 0),
    staffConfirmedCheckIns: Number(checkIns[0]?.c ?? 0),
    conventionRegistrations: 0,
    verifiedPresenterCredits: 0,
    verifiedVendorCredits: 0,
    organizerRoles: 0,
    qualifiesVerifiedContributor: false,
    accountAgeDays: accountAgeDays(user.createdAt),
    ageAffirmed: Boolean(user.ageAffirmedAt),
    profileComplete: Boolean(
      prof?.displayName?.trim() &&
        prof?.bio?.trim() &&
        prof?.avatarUrl?.trim() &&
        prof?.homeZip?.trim() &&
        prof?.birthDate
    ),
    hasProfilePhoto: Boolean(prof?.avatarUrl?.trim()),
    memberSinceYear: user.createdAt.getFullYear(),
  }

  const level = deriveCommunityTrustLevel(counts)
  const order = [
    COMMUNITY_TRUST_LEVELS.newMember,
    COMMUNITY_TRUST_LEVELS.buildingTrust,
    COMMUNITY_TRUST_LEVELS.establishedMember,
    COMMUNITY_TRUST_LEVELS.communityKnown,
    COMMUNITY_TRUST_LEVELS.verifiedContributor,
  ]
  return order.indexOf(level) >= order.indexOf(COMMUNITY_TRUST_LEVELS.establishedMember)
}

export async function countLevelBoostingReferences(subjectUserId: string): Promise<{
  totalAccepted: number
  countedForLevel: number
}> {
  const rows = await db
    .select({
      id: schema.profileReferences.id,
      countsTowardLevel: schema.profileReferences.countsTowardLevel,
      respondedAt: schema.profileReferences.respondedAt,
      referrerIpPrefix: schema.users.registrationIpPrefix,
    })
    .from(schema.profileReferences)
    .innerJoin(schema.users, eq(schema.profileReferences.referrerId, schema.users.id))
    .where(
      and(
        eq(schema.profileReferences.subjectUserId, subjectUserId),
        eq(schema.profileReferences.status, 'ACCEPTED')
      )
    )

  const fresh = rows.filter((r) => r.countsTowardLevel !== false && isReferenceFresh(r.respondedAt))
  const ipFiltered = filterReferencesByIpCluster(
    fresh.map((r) => ({
      id: r.id,
      referrerIpPrefix: r.referrerIpPrefix,
    }))
  )
  const countedForLevel = ipFiltered.length
  return { totalAccepted: rows.length, countedForLevel }
}
