import { z } from 'zod'

/**
 * Canonical trust & safety policy violation reasons (T&S-1).
 * Stored on moderation cases and validated on report intake (slice 2+).
 */
export const POLICY_REASONS = {
  minorSafety: 'MINOR_SAFETY',
  csamSuspected: 'CSAM_SUSPECTED',
  ncii: 'NCII',
  aiDeepfakeNcii: 'AI_DEEPFAKE_NCII',
  doxxingOuting: 'DOXXING_OUTING',
  harassmentThreats: 'HARASSMENT_THREATS',
  impersonation: 'IMPERSONATION',
  hiddenCameraLeaked: 'HIDDEN_CAMERA_LEAKED',
  traffickingCoercion: 'TRAFFICKING_COERCION',
  commercialSexSolicitation: 'COMMERCIAL_SEX_SOLICITATION',
  illegalGoodsServices: 'ILLEGAL_GOODS_SERVICES',
  spamScam: 'SPAM_SCAM',
  consentSafety: 'CONSENT_SAFETY',
  explicitVisibilityViolation: 'EXPLICIT_VISIBILITY_VIOLATION',
  other: 'OTHER',
} as const

export type PolicyReason = (typeof POLICY_REASONS)[keyof typeof POLICY_REASONS]

export const POLICY_REASON_VALUES: readonly PolicyReason[] = Object.values(POLICY_REASONS)

export const POLICY_REASON_LABELS: Record<PolicyReason, string> = {
  [POLICY_REASONS.minorSafety]: 'User appears under 18 / minor safety',
  [POLICY_REASONS.csamSuspected]: 'Suspected CSAM',
  [POLICY_REASONS.ncii]: 'Non-consensual intimate imagery (NCII)',
  [POLICY_REASONS.aiDeepfakeNcii]: 'AI deepfake intimate imagery',
  [POLICY_REASONS.doxxingOuting]: 'Doxxing / outing / PII exposure',
  [POLICY_REASONS.harassmentThreats]: 'Harassment or threats of violence',
  [POLICY_REASONS.impersonation]: 'Impersonation',
  [POLICY_REASONS.hiddenCameraLeaked]: 'Hidden camera or leaked intimate media',
  [POLICY_REASONS.traffickingCoercion]: 'Trafficking or coercion',
  [POLICY_REASONS.commercialSexSolicitation]: 'Commercial sex solicitation',
  [POLICY_REASONS.illegalGoodsServices]: 'Illegal goods or services',
  [POLICY_REASONS.spamScam]: 'Spam or scam',
  [POLICY_REASONS.consentSafety]: 'Consent or safety dispute',
  [POLICY_REASONS.explicitVisibilityViolation]: 'Adult content without proper labeling or visibility',
  [POLICY_REASONS.other]: 'Other (note required)',
}

/** Default triage severity per policy reason. */
export const POLICY_SEVERITIES = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
} as const

export type PolicySeverity = (typeof POLICY_SEVERITIES)[keyof typeof POLICY_SEVERITIES]

export const POLICY_SEVERITY_VALUES: readonly PolicySeverity[] = Object.values(POLICY_SEVERITIES)

/** Moderation inbox queues for case routing (platform tier). */
export const MODERATION_QUEUES = {
  generalReview: 'GENERAL_REVIEW',
  mediaReview: 'MEDIA_REVIEW',
  nciiUrgent: 'NCII_URGENT',
  minorSafetyRestricted: 'MINOR_SAFETY_RESTRICTED',
  spamAbuse: 'SPAM_ABUSE',
  appeals: 'APPEALS',
} as const

export type ModerationQueue = (typeof MODERATION_QUEUES)[keyof typeof MODERATION_QUEUES]

export const MODERATION_QUEUE_VALUES: readonly ModerationQueue[] = Object.values(MODERATION_QUEUES)

/** Lifecycle status for a moderation case (distinct from legacy `reports.status`). */
export const MODERATION_CASE_STATUSES = {
  open: 'OPEN',
  triaged: 'TRIAGED',
  actioned: 'ACTIONED',
  escalated: 'ESCALATED',
  closedNoViolation: 'CLOSED_NO_VIOLATION',
  closedDuplicate: 'CLOSED_DUPLICATE',
} as const

export type ModerationCaseStatus = (typeof MODERATION_CASE_STATUSES)[keyof typeof MODERATION_CASE_STATUSES]

export const MODERATION_CASE_STATUS_VALUES: readonly ModerationCaseStatus[] = Object.values(
  MODERATION_CASE_STATUSES
)

const POLICY_REASON_SET = new Set<string>(POLICY_REASON_VALUES)
const POLICY_SEVERITY_SET = new Set<string>(POLICY_SEVERITY_VALUES)
const MODERATION_QUEUE_SET = new Set<string>(MODERATION_QUEUE_VALUES)
const MODERATION_CASE_STATUS_SET = new Set<string>(MODERATION_CASE_STATUS_VALUES)

export function isKnownPolicyReason(value: string): value is PolicyReason {
  return POLICY_REASON_SET.has(value)
}

export function isKnownPolicySeverity(value: string): value is PolicySeverity {
  return POLICY_SEVERITY_SET.has(value)
}

export function isKnownModerationQueue(value: string): value is ModerationQueue {
  return MODERATION_QUEUE_SET.has(value)
}

export function isKnownModerationCaseStatus(value: string): value is ModerationCaseStatus {
  return MODERATION_CASE_STATUS_SET.has(value)
}

const SEVERITY_BY_POLICY_REASON: Record<PolicyReason, PolicySeverity> = {
  [POLICY_REASONS.minorSafety]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.csamSuspected]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.ncii]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.aiDeepfakeNcii]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.hiddenCameraLeaked]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.traffickingCoercion]: POLICY_SEVERITIES.critical,
  [POLICY_REASONS.doxxingOuting]: POLICY_SEVERITIES.high,
  [POLICY_REASONS.harassmentThreats]: POLICY_SEVERITIES.high,
  [POLICY_REASONS.commercialSexSolicitation]: POLICY_SEVERITIES.high,
  [POLICY_REASONS.illegalGoodsServices]: POLICY_SEVERITIES.high,
  [POLICY_REASONS.impersonation]: POLICY_SEVERITIES.medium,
  [POLICY_REASONS.consentSafety]: POLICY_SEVERITIES.medium,
  [POLICY_REASONS.explicitVisibilityViolation]: POLICY_SEVERITIES.low,
  [POLICY_REASONS.spamScam]: POLICY_SEVERITIES.low,
  [POLICY_REASONS.other]: POLICY_SEVERITIES.low,
}

const QUEUE_BY_POLICY_REASON: Record<PolicyReason, ModerationQueue> = {
  [POLICY_REASONS.minorSafety]: MODERATION_QUEUES.minorSafetyRestricted,
  [POLICY_REASONS.csamSuspected]: MODERATION_QUEUES.minorSafetyRestricted,
  [POLICY_REASONS.ncii]: MODERATION_QUEUES.nciiUrgent,
  [POLICY_REASONS.aiDeepfakeNcii]: MODERATION_QUEUES.nciiUrgent,
  [POLICY_REASONS.hiddenCameraLeaked]: MODERATION_QUEUES.nciiUrgent,
  [POLICY_REASONS.explicitVisibilityViolation]: MODERATION_QUEUES.mediaReview,
  [POLICY_REASONS.spamScam]: MODERATION_QUEUES.spamAbuse,
  [POLICY_REASONS.doxxingOuting]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.harassmentThreats]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.impersonation]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.traffickingCoercion]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.commercialSexSolicitation]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.illegalGoodsServices]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.consentSafety]: MODERATION_QUEUES.generalReview,
  [POLICY_REASONS.other]: MODERATION_QUEUES.generalReview,
}

/** Resolve default severity for a canonical policy reason. */
export function severityForPolicyReason(reason: PolicyReason): PolicySeverity {
  return SEVERITY_BY_POLICY_REASON[reason]
}

/** Resolve primary inbox queue for a new case/report with this policy reason. */
export function queueForPolicyReason(reason: PolicyReason): ModerationQueue {
  return QUEUE_BY_POLICY_REASON[reason]
}

/**
 * P0 policy reasons. Platform mods should be notified quickly, about within 60s.
 *
 * Subset of PLATFORM_CRITICAL_POLICY_REASONS in community-trust-types.ts.
 * P0 means page now. Platform-critical means do not dismiss as local-only.
 * Keep both lists until product merges them.
 */
export const P0_POLICY_REASONS: readonly PolicyReason[] = [
  POLICY_REASONS.csamSuspected,
  POLICY_REASONS.minorSafety,
  POLICY_REASONS.ncii,
  POLICY_REASONS.aiDeepfakeNcii,
  POLICY_REASONS.hiddenCameraLeaked,
  POLICY_REASONS.traffickingCoercion,
] as const

/** True when a reason is in the immediate-escalation (P0) set. */
export function isP0PolicyReason(reason: PolicyReason): boolean {
  return (P0_POLICY_REASONS as readonly string[]).includes(reason)
}

/**
 * Legacy `reports.category` strings from web intake (pre–T&S-1 UI).
 * Do not store these on new cases - map to `PolicyReason` at intake.
 */
export const LEGACY_REPORT_CATEGORIES = {
  harassment: 'harassment',
  spam: 'spam',
  impersonation: 'impersonation',
  safety: 'safety',
  content: 'content',
  illegal: 'illegal',
  other: 'other',
} as const

export type LegacyReportCategory = (typeof LEGACY_REPORT_CATEGORIES)[keyof typeof LEGACY_REPORT_CATEGORIES]

export const LEGACY_REPORT_CATEGORY_VALUES: readonly LegacyReportCategory[] = Object.values(
  LEGACY_REPORT_CATEGORIES
)

export type LegacyPolicyMapping = {
  reason: PolicyReason
  /** True when mods must re-triage because the legacy label is ambiguous. */
  requiresRetriage: boolean
  note?: string
}

/**
 * Best-effort map from legacy report category to canonical policy reason.
 * `illegal` and `safety` are ambiguous - callers should prompt for a specific reason in slice 2.
 */
export function mapLegacyReportCategoryToPolicyReason(
  category: string
): LegacyPolicyMapping | null {
  switch (category) {
    case LEGACY_REPORT_CATEGORIES.harassment:
      return { reason: POLICY_REASONS.harassmentThreats, requiresRetriage: false }
    case LEGACY_REPORT_CATEGORIES.spam:
      return { reason: POLICY_REASONS.spamScam, requiresRetriage: false }
    case LEGACY_REPORT_CATEGORIES.impersonation:
      return { reason: POLICY_REASONS.impersonation, requiresRetriage: false }
    case LEGACY_REPORT_CATEGORIES.content:
      return { reason: POLICY_REASONS.explicitVisibilityViolation, requiresRetriage: false }
    case LEGACY_REPORT_CATEGORIES.other:
      return { reason: POLICY_REASONS.other, requiresRetriage: false }
    case LEGACY_REPORT_CATEGORIES.safety:
      return {
        reason: POLICY_REASONS.consentSafety,
        requiresRetriage: true,
        note: 'Legacy "safety" may mean minor safety, consent, or threats. Re-triage required.',
      }
    case LEGACY_REPORT_CATEGORIES.illegal:
      return {
        reason: POLICY_REASONS.other,
        requiresRetriage: true,
        note:
          'Legacy "illegal" bundles CSAM, NCII, trafficking, and goods. Split into specific policy reasons in UI.',
      }
    default:
      return null
  }
}

export const policyReasonSchema = z.enum([
  POLICY_REASONS.minorSafety,
  POLICY_REASONS.csamSuspected,
  POLICY_REASONS.ncii,
  POLICY_REASONS.aiDeepfakeNcii,
  POLICY_REASONS.doxxingOuting,
  POLICY_REASONS.harassmentThreats,
  POLICY_REASONS.impersonation,
  POLICY_REASONS.hiddenCameraLeaked,
  POLICY_REASONS.traffickingCoercion,
  POLICY_REASONS.commercialSexSolicitation,
  POLICY_REASONS.illegalGoodsServices,
  POLICY_REASONS.spamScam,
  POLICY_REASONS.consentSafety,
  POLICY_REASONS.explicitVisibilityViolation,
  POLICY_REASONS.other,
])

export const policySeveritySchema = z.enum([
  POLICY_SEVERITIES.low,
  POLICY_SEVERITIES.medium,
  POLICY_SEVERITIES.high,
  POLICY_SEVERITIES.critical,
])

export const moderationQueueSchema = z.enum([
  MODERATION_QUEUES.generalReview,
  MODERATION_QUEUES.mediaReview,
  MODERATION_QUEUES.nciiUrgent,
  MODERATION_QUEUES.minorSafetyRestricted,
  MODERATION_QUEUES.spamAbuse,
  MODERATION_QUEUES.appeals,
])

export const moderationCaseStatusSchema = z.enum([
  MODERATION_CASE_STATUSES.open,
  MODERATION_CASE_STATUSES.triaged,
  MODERATION_CASE_STATUSES.actioned,
  MODERATION_CASE_STATUSES.escalated,
  MODERATION_CASE_STATUSES.closedNoViolation,
  MODERATION_CASE_STATUSES.closedDuplicate,
])

/** Platform moderation action types (Tier 1 proposals). */
export const MODERATION_ACTION_TYPES = {
  hideContent: 'HIDE_CONTENT',
  deleteContent: 'DELETE_CONTENT',
  lockThread: 'LOCK_THREAD',
  scopeBan: 'SCOPE_BAN',
  resolveReport: 'RESOLVE_REPORT',
  identityBan: 'IDENTITY_BAN',
  suspendUser: 'SUSPEND_USER',
  freezeOrg: 'FREEZE_ORG',
  escalateOnly: 'ESCALATE_ONLY',
} as const

export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[keyof typeof MODERATION_ACTION_TYPES]

export const MODERATION_ACTION_STATUSES = {
  pendingApproval: 'PENDING_APPROVAL',
  approved: 'APPROVED',
  executed: 'EXECUTED',
  rejected: 'REJECTED',
  overridden: 'OVERRIDDEN',
} as const

export type ModerationActionStatus = (typeof MODERATION_ACTION_STATUSES)[keyof typeof MODERATION_ACTION_STATUSES]

export const REPORT_SCOPE_TYPES = {
  platform: 'platform',
  organization: 'organization',
  group: 'group',
  event: 'event',
} as const

export type ReportScopeType = (typeof REPORT_SCOPE_TYPES)[keyof typeof REPORT_SCOPE_TYPES]

export const MODERATION_AUDIT_VERBS = {
  reportCreated: 'report.created',
  reportTriaged: 'report.triaged',
  contentHidden: 'content.hidden',
  contentDeleted: 'content.deleted',
  evidencePreserved: 'evidence.preserved',
  threadLocked: 'thread.locked',
  threadPinned: 'thread.pinned',
  scopeBanCreated: 'scope_ban.created',
  scopeBanRemoved: 'scope_ban.removed',
  actionProposed: 'action.proposed',
  actionApproved: 'action.approved',
  actionRejected: 'action.rejected',
  actionExecuted: 'action.executed',
  ruleOfTwoOverridden: 'action.rule_of_two_overridden',
  identityBan: 'identity.ban',
  orgFrozen: 'org.frozen',
  userSuspended: 'user.suspended',
} as const

export type ModerationAuditVerb = (typeof MODERATION_AUDIT_VERBS)[keyof typeof MODERATION_AUDIT_VERBS]

export const PLATFORM_STAFF_ROLES = {
  siteAdmin: 'SITE_ADMIN',
  moderator: 'MODERATOR',
} as const

export type PlatformStaffRole = (typeof PLATFORM_STAFF_ROLES)[keyof typeof PLATFORM_STAFF_ROLES]
