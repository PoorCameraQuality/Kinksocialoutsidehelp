import { POLICY_REASONS, type PolicyReason } from './moderation-types.js'

/** Public community trust levels - positive/factual only. */
export const COMMUNITY_TRUST_LEVELS = {
  newMember: 'NEW_MEMBER',
  buildingTrust: 'BUILDING_TRUST',
  establishedMember: 'ESTABLISHED_MEMBER',
  communityKnown: 'COMMUNITY_KNOWN',
  verifiedContributor: 'VERIFIED_CONTRIBUTOR',
} as const

export type CommunityTrustLevel = (typeof COMMUNITY_TRUST_LEVELS)[keyof typeof COMMUNITY_TRUST_LEVELS]

export const COMMUNITY_TRUST_LEVEL_VALUES: readonly CommunityTrustLevel[] = Object.values(
  COMMUNITY_TRUST_LEVELS
)

export const SCOPED_STANDINGS = {
  goodStanding: 'GOOD_STANDING',
  needsAttention: 'NEEDS_ATTENTION',
  limited: 'LIMITED',
  timedOut: 'TIMED_OUT',
  banned: 'BANNED',
  escalatedToPlatform: 'ESCALATED_TO_PLATFORM',
} as const

export type ScopedStanding = (typeof SCOPED_STANDINGS)[keyof typeof SCOPED_STANDINGS]

export const TRUST_SCOPE_TYPES = {
  organization: 'organization',
  group: 'group',
  event: 'event',
  convention: 'convention',
} as const

export type TrustScopeType = (typeof TRUST_SCOPE_TYPES)[keyof typeof TRUST_SCOPE_TYPES]

export const MESSAGING_HEALTH_STATES = {
  healthy: 'HEALTHY',
  newLimitedHistory: 'NEW_LIMITED_HISTORY',
  highOutreachVolume: 'HIGH_OUTREACH_VOLUME',
  needsCooldown: 'NEEDS_COOLDOWN',
  modReviewRecommended: 'MOD_REVIEW_RECOMMENDED',
  restricted: 'RESTRICTED',
} as const

export type MessagingHealthState = (typeof MESSAGING_HEALTH_STATES)[keyof typeof MESSAGING_HEALTH_STATES]

/**
 * Reasons that always go to platform T&S. Do not dismiss these as local-only.
 * Broader than P0_POLICY_REASONS, which is the page-now subset.
 * Keep both lists until product merges them.
 */
export const PLATFORM_CRITICAL_POLICY_REASONS = [
  POLICY_REASONS.minorSafety,
  POLICY_REASONS.csamSuspected,
  POLICY_REASONS.ncii,
  POLICY_REASONS.aiDeepfakeNcii,
  POLICY_REASONS.hiddenCameraLeaked,
  POLICY_REASONS.consentSafety,
  POLICY_REASONS.doxxingOuting,
  POLICY_REASONS.harassmentThreats,
  POLICY_REASONS.traffickingCoercion,
  POLICY_REASONS.commercialSexSolicitation,
  POLICY_REASONS.illegalGoodsServices,
] as const satisfies readonly PolicyReason[]

export type PlatformCriticalPolicyReason = (typeof PLATFORM_CRITICAL_POLICY_REASONS)[number]

/**
 * True when this reason must escalate to platform critical handling.
 * Built from PLATFORM_CRITICAL_POLICY_REASONS. P0 is a smaller urgent subset.
 * See policy-reason-sets.test.ts.
 */
export function isPlatformCriticalPolicyReason(reason: string): boolean {
  return (PLATFORM_CRITICAL_POLICY_REASONS as readonly string[]).includes(reason)
}
