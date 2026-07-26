import {
  DEPICTED_PEOPLE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_UPLOAD_STATUSES,
  MEDIA_VISIBILITIES,
  REQUIRED_ATTESTATION_FIELDS,
  SCAN_STATUSES,
  isExplicitRating,
  isMultiPersonDepiction,
  resolvePublishLane,
  type DepictedPeople,
  type MediaAttestation,
  type MediaAttestationFields,
  type MediaContentRating,
  type MediaPublishLane,
  type MediaUploadStatus,
  type MediaVisibility,
  type RequiredAttestationField,
  type ScanStatus,
} from '@c2k/shared'

/** Substrings in caption/metadata that force YELLOW review (not a nudity signal). */
export const CAPTION_RISK_TERMS = [
  'teen',
  'barely legal',
  'leaked',
  'hidden cam',
  'hidden camera',
  'ex-girlfriend',
  'ex girlfriend',
  'asleep',
  'passed out',
  'revenge porn',
  'without consent',
] as const

/** Placeholder trust thresholds - tune when real account-risk scoring ships. */
export const NEW_ACCOUNT_AGE_THRESHOLD_DAYS = 7
export const ELEVATED_PRIOR_REPORTS_THRESHOLD = 2

export type AccountTrustSignals = {
  accountAgeDays?: number | null
  priorReports?: number | null
}

export type ComputeMediaUploadStatusInput = {
  contentRating: MediaContentRating
  depictedPeople: DepictedPeople
  scanStatus: ScanStatus
  attestation: MediaAttestation | MediaAttestationFields | null | undefined
  caption?: string | null
  metadata?: string | null
  accountTrustSignals?: AccountTrustSignals | null
  /** Destination visibility, when known (PR 3 M2 human-review lane). */
  visibility?: MediaVisibility | null
}

const LANE_RANK: Record<MediaPublishLane, number> = {
  GREEN: 0,
  YELLOW: 1,
  RED: 2,
}

function maxPublishLane(a: MediaPublishLane, b: MediaPublishLane): MediaPublishLane {
  return LANE_RANK[a] >= LANE_RANK[b] ? a : b
}

/** True when every required attestation boolean is explicitly true. */
export function allRequiredAttestationsPresent(
  attestation: MediaAttestation | MediaAttestationFields | null | undefined
): boolean {
  if (!attestation) return false
  return REQUIRED_ATTESTATION_FIELDS.every(
    (field: RequiredAttestationField) => attestation[field] === true
  )
}

/** Case-insensitive substring match against known risk terms. */
export function captionContainsRiskTerms(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const haystack = text.toLowerCase()
  return CAPTION_RISK_TERMS.some((term) => haystack.includes(term))
}

export function captionOrMetadataHasRiskTerms(input: {
  caption?: string | null
  metadata?: string | null
}): boolean {
  return captionContainsRiskTerms(input.caption) || captionContainsRiskTerms(input.metadata)
}

/**
 * Placeholder new-account / prior-report heuristics for explicit uploads.
 * Returns true when local trust signals should elevate GREEN → YELLOW.
 */
export function accountTrustSignalsElevateToYellow(
  signals: AccountTrustSignals | null | undefined,
  contentRating: MediaContentRating
): boolean {
  if (!signals || !isExplicitRating(contentRating)) return false

  const ageDays = signals.accountAgeDays
  if (typeof ageDays === 'number' && ageDays >= 0 && ageDays < NEW_ACCOUNT_AGE_THRESHOLD_DAYS) {
    return true
  }

  const priorReports = signals.priorReports
  if (
    typeof priorReports === 'number' &&
    priorReports >= ELEVATED_PRIOR_REPORTS_THRESHOLD
  ) {
    return true
  }

  return false
}

/** Visibilities that auto-publish to a broad audience (anonymous or all members). */
export const BROAD_AUTO_PUBLISH_VISIBILITIES: readonly MediaVisibility[] = [
  MEDIA_VISIBILITIES.publicPreview,
  MEDIA_VISIBILITIES.loggedIn,
]

/**
 * Post-moderation policy (supersedes PR 3 M2 pre-publish hold):
 * uploads publish after malware/hash scan; human review is report-driven.
 * Kept as a named helper so callers/tests can assert the policy is off.
 */
export function alphaHumanReviewRequiredForAutoPublish(_input: {
  contentRating: MediaContentRating
  visibility?: MediaVisibility | null
}): boolean {
  return false
}

export function isMultiPersonExplicitPendingReview(
  contentRating: MediaContentRating,
  depictedPeople: DepictedPeople
): boolean {
  return isExplicitRating(contentRating) && isMultiPersonDepiction(depictedPeople)
}

/** Shared lane plus API-local caption and account-trust elevates (never downgrades RED). */
export function resolveEffectivePublishLane(input: ComputeMediaUploadStatusInput): MediaPublishLane {
  let lane = resolvePublishLane({
    contentRating: input.contentRating,
    depictedPeople: input.depictedPeople,
    scanStatus: input.scanStatus,
    attestation: input.attestation,
  })

  if (captionOrMetadataHasRiskTerms(input)) {
    lane = maxPublishLane(lane, 'YELLOW')
  }

  if (accountTrustSignalsElevateToYellow(input.accountTrustSignals, input.contentRating)) {
    lane = maxPublishLane(lane, 'YELLOW')
  }

  return lane
}

function uploadStatusForYellowLane(input: ComputeMediaUploadStatusInput): MediaUploadStatus {
  if (isMultiPersonExplicitPendingReview(input.contentRating, input.depictedPeople)) {
    return MEDIA_UPLOAD_STATUSES.quarantined
  }
  return MEDIA_UPLOAD_STATUSES.pendingScan
}

/**
 * Risk-based publish-most status after attestation submission.
 * GREEN → AUTO_APPROVED; YELLOW → QUARANTINED (multi-person explicit) or PENDING_SCAN; RED → REJECTED.
 */
export function computeMediaUploadStatusAfterAttestation(
  input: ComputeMediaUploadStatusInput
): MediaUploadStatus {
  if (!allRequiredAttestationsPresent(input.attestation)) {
    return MEDIA_UPLOAD_STATUSES.pendingAttestation
  }

  const lane = resolveEffectivePublishLane(input)

  switch (lane) {
    case 'GREEN':
      return MEDIA_UPLOAD_STATUSES.autoApproved
    case 'YELLOW':
      return uploadStatusForYellowLane(input)
    case 'RED':
      return MEDIA_UPLOAD_STATUSES.rejected
    default: {
      const _exhaustive: never = lane
      return _exhaustive
    }
  }
}

/** Convenience for tests and route handlers that need the lane without status mapping. */
export function computePublishLaneAfterAttestation(
  input: ComputeMediaUploadStatusInput
): MediaPublishLane {
  if (!allRequiredAttestationsPresent(input.attestation)) {
    return 'YELLOW'
  }
  return resolveEffectivePublishLane(input)
}
