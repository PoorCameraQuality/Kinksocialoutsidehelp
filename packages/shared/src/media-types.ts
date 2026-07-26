import { z } from 'zod'

/**
 * T&S-2 media lifecycle enums and publish-lane helpers.
 * Shared contract for API, workers, and web (browser-safe).
 */

/** Max image upload size (profile photos, quarantine pipeline). */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024

/** Max audio upload size (feed clips). */
export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024

/** Max video upload size (feed video / multipart cap). */
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024

/** Human-readable megabyte label for upload limit error copy (floor). */
export function uploadLimitMegabytes(maxBytes: number): number {
  return Math.floor(maxBytes / (1024 * 1024))
}

export const MEDIA_UPLOAD_STATUSES = {
  pendingUpload: 'PENDING_UPLOAD',
  pendingAttestation: 'PENDING_ATTESTATION',
  pendingScan: 'PENDING_SCAN',
  autoApproved: 'AUTO_APPROVED',
  approvedBlurred: 'APPROVED_BLURRED',
  quarantined: 'QUARANTINED',
  rejected: 'REJECTED',
  removed: 'REMOVED',
  escalated: 'ESCALATED',
  preserved: 'PRESERVED',
} as const

export type MediaUploadStatus = (typeof MEDIA_UPLOAD_STATUSES)[keyof typeof MEDIA_UPLOAD_STATUSES]

export const MEDIA_UPLOAD_STATUS_VALUES: readonly MediaUploadStatus[] = Object.values(MEDIA_UPLOAD_STATUSES)

export const MEDIA_CONTENT_RATINGS = {
  safePublic: 'SAFE_PUBLIC',
  adultNonExplicit: 'ADULT_NON_EXPLICIT',
  explicitAdult: 'EXPLICIT_ADULT',
  edgeReview: 'EDGE_REVIEW',
  blockedIllegal: 'BLOCKED_ILLEGAL',
} as const

export type MediaContentRating = (typeof MEDIA_CONTENT_RATINGS)[keyof typeof MEDIA_CONTENT_RATINGS]

export const MEDIA_CONTENT_RATING_VALUES: readonly MediaContentRating[] = Object.values(MEDIA_CONTENT_RATINGS)

/** User-facing labels for content rating (upload attestation + moderation). */
export const MEDIA_CONTENT_RATING_LABELS: Record<MediaContentRating, string> = {
  [MEDIA_CONTENT_RATINGS.safePublic]: 'Safe for general audiences (not adult/explicit)',
  [MEDIA_CONTENT_RATINGS.adultNonExplicit]: 'Adult-themed, not explicit',
  [MEDIA_CONTENT_RATINGS.explicitAdult]: 'Explicit adult content',
  [MEDIA_CONTENT_RATINGS.edgeReview]: 'Edge content (moderator review)',
  [MEDIA_CONTENT_RATINGS.blockedIllegal]: 'Blocked. Illegal content',
}

/** Ratings members may choose during upload attestation (not system-assigned). */
export const MEMBER_SELECTABLE_CONTENT_RATINGS: readonly MediaContentRating[] = [
  MEDIA_CONTENT_RATINGS.safePublic,
  MEDIA_CONTENT_RATINGS.adultNonExplicit,
  MEDIA_CONTENT_RATINGS.explicitAdult,
]

/**
 * Persisted media visibility values.
 *
 * FOLLOWERS is an old label. API gates still require an accepted mutual connection,
 * not a one-way follow. Do not change the stored string without a media migration
 * and a product decision.
 */
export const MEDIA_VISIBILITIES = {
  publicPreview: 'PUBLIC_PREVIEW',
  loggedIn: 'LOGGED_IN',
  followers: 'FOLLOWERS',
  privateProfile: 'PRIVATE_PROFILE',
  groupOnly: 'GROUP_ONLY',
  orgOnly: 'ORG_ONLY',
  eventAttendees: 'EVENT_ATTENDEES',
  conventionAttendees: 'CONVENTION_ATTENDEES',
  staffOnly: 'STAFF_ONLY',
} as const

export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[keyof typeof MEDIA_VISIBILITIES]

export const MEDIA_VISIBILITY_VALUES: readonly MediaVisibility[] = Object.values(MEDIA_VISIBILITIES)

export const MEDIA_VISIBILITY_LABELS: Record<MediaVisibility, string> = {
  [MEDIA_VISIBILITIES.publicPreview]: 'Public preview (logged-out visitors may see)',
  [MEDIA_VISIBILITIES.loggedIn]: 'Signed-in members',
  [MEDIA_VISIBILITIES.followers]: 'Followers only',
  [MEDIA_VISIBILITIES.privateProfile]: 'Private (only on your profile)',
  [MEDIA_VISIBILITIES.groupOnly]: 'Group members only',
  [MEDIA_VISIBILITIES.orgOnly]: 'Organization members only',
  [MEDIA_VISIBILITIES.eventAttendees]: 'Event attendees only',
  [MEDIA_VISIBILITIES.conventionAttendees]: 'Convention attendees only',
  [MEDIA_VISIBILITIES.staffOnly]: 'Staff only',
}

export const DEPICTED_PEOPLE = {
  onlyMe: 'ONLY_ME',
  meAndOtherAdults: 'ME_AND_OTHER_ADULTS',
  otherAdults: 'OTHER_ADULTS',
  noIdentifiablePerson: 'NO_IDENTIFIABLE_PERSON',
  unknown: 'UNKNOWN',
} as const

export type DepictedPeople = (typeof DEPICTED_PEOPLE)[keyof typeof DEPICTED_PEOPLE]

export const DEPICTED_PEOPLE_VALUES: readonly DepictedPeople[] = Object.values(DEPICTED_PEOPLE)

export const DEPICTED_PEOPLE_LABELS: Record<DepictedPeople, string> = {
  [DEPICTED_PEOPLE.onlyMe]: 'Only me',
  [DEPICTED_PEOPLE.meAndOtherAdults]: 'Me and other consenting adults',
  [DEPICTED_PEOPLE.otherAdults]: 'Other consenting adults (not me)',
  [DEPICTED_PEOPLE.noIdentifiablePerson]: 'No identifiable person',
  [DEPICTED_PEOPLE.unknown]: 'Not sure / unknown',
}

export const SCAN_STATUSES = {
  notRequired: 'NOT_REQUIRED',
  pending: 'PENDING',
  running: 'RUNNING',
  passed: 'PASSED',
  flagged: 'FLAGGED',
  failed: 'FAILED',
  error: 'ERROR',
} as const

export type ScanStatus = (typeof SCAN_STATUSES)[keyof typeof SCAN_STATUSES]

export const SCAN_STATUS_VALUES: readonly ScanStatus[] = Object.values(SCAN_STATUSES)

/** T&S-3 object storage lifecycle - quarantine before public promotion. */
export const MEDIA_STORAGE_STATES = {
  pendingUpload: 'PENDING_UPLOAD',
  quarantinedPrivate: 'QUARANTINED_PRIVATE',
  validatedPrivate: 'VALIDATED_PRIVATE',
  approvedPublic: 'APPROVED_PUBLIC',
  rejectedPrivate: 'REJECTED_PRIVATE',
  removedPrivate: 'REMOVED_PRIVATE',
  deleted: 'DELETED',
} as const

export type MediaStorageState = (typeof MEDIA_STORAGE_STATES)[keyof typeof MEDIA_STORAGE_STATES]

export const MEDIA_STORAGE_STATE_VALUES: readonly MediaStorageState[] = Object.values(MEDIA_STORAGE_STATES)

export const mediaStorageStateSchema = z.enum([
  MEDIA_STORAGE_STATES.pendingUpload,
  MEDIA_STORAGE_STATES.quarantinedPrivate,
  MEDIA_STORAGE_STATES.validatedPrivate,
  MEDIA_STORAGE_STATES.approvedPublic,
  MEDIA_STORAGE_STATES.rejectedPrivate,
  MEDIA_STORAGE_STATES.removedPrivate,
  MEDIA_STORAGE_STATES.deleted,
])

/**
 * User preference for viewing adult-rated media (also used in privacy settings).
 */
export const ADULT_CONTENT_PREFERENCES = {
  show: 'SHOW',
  blur: 'BLUR',
  hide: 'HIDE',
} as const

export type AdultContentPreferenceValue =
  (typeof ADULT_CONTENT_PREFERENCES)[keyof typeof ADULT_CONTENT_PREFERENCES]

export const ADULT_CONTENT_PREFERENCE_VALUES: readonly AdultContentPreferenceValue[] = Object.values(
  ADULT_CONTENT_PREFERENCES
)

export const adultContentPreferenceSchema = z.enum([
  ADULT_CONTENT_PREFERENCES.show,
  ADULT_CONTENT_PREFERENCES.blur,
  ADULT_CONTENT_PREFERENCES.hide,
])

export type AdultContentPreference = z.infer<typeof adultContentPreferenceSchema>

export const MEDIA_ATTESTATION_VERSION = 1

/**
 * Compact attestation fields used by resolvePublishLane.
 * Different shape from UPLOADER_ATTESTATION_FIELDS, which are the UI checkboxes on assets.
 * Map UI to lane with mapUploaderAttestationToPublishLaneFields.
 */
export const REQUIRED_ATTESTATION_FIELDS = [
  'allDepictedAreAdults',
  'iAmDepictedOrAuthorizedUploader',
  'noHiddenCameraOrNonConsensualCapture',
  'contentRatingAccurate',
] as const

export type RequiredAttestationField = (typeof REQUIRED_ATTESTATION_FIELDS)[number]

export type MediaAttestationFields = Partial<Record<RequiredAttestationField, boolean>>

export type MediaAttestation = MediaAttestationFields & {
  attestationVersion?: number
  attestedAt?: string
}

/**
 * Uploader UI checkbox fields stored on media_assets.
 * Not the same shape as REQUIRED_ATTESTATION_FIELDS. Always map at the boundary.
 */
export const UPLOADER_ATTESTATION_FIELDS = [
  'uploaderConfirmed18',
  'uploaderConfirmedDepictedAdults18',
  'uploaderConfirmedConsent',
  'uploaderConfirmedRightToUpload',
  'uploaderConfirmedNoNcii',
  'uploaderConfirmedNoMinors',
  'uploaderConfirmedNoHiddenCamera',
  'uploaderConfirmedNoAiDeepfakeWithoutConsent',
] as const

export type UploaderAttestationField = (typeof UPLOADER_ATTESTATION_FIELDS)[number]

export const UPLOADER_ATTESTATION_LABELS: Record<UploaderAttestationField, string> = {
  uploaderConfirmed18: 'I am 18 years of age or older',
  uploaderConfirmedDepictedAdults18: 'Everyone depicted is 18 years of age or older',
  uploaderConfirmedConsent: 'Everyone depicted consented to this upload',
  uploaderConfirmedRightToUpload: 'I have the right to upload this content',
  uploaderConfirmedNoNcii:
    'This is not revenge porn, leaked intimate imagery, or other non-consensual (NCII) content',
  uploaderConfirmedNoMinors: 'This does not include minors, even in the background',
  uploaderConfirmedNoHiddenCamera:
    'This is not hidden-camera, secretly recorded, or otherwise non-consensual capture',
  uploaderConfirmedNoAiDeepfakeWithoutConsent:
    'This is not AI-generated sexual imagery of a real person without their consent',
}

export const MEDIA_CONTENT_SEVERITIES = {
  none: 'NONE',
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  blocked: 'BLOCKED',
} as const

export type MediaContentSeverity = (typeof MEDIA_CONTENT_SEVERITIES)[keyof typeof MEDIA_CONTENT_SEVERITIES]

export const MEDIA_CONTENT_SEVERITY_VALUES: readonly MediaContentSeverity[] = Object.values(
  MEDIA_CONTENT_SEVERITIES
)

export type MediaPublishLane = 'GREEN' | 'YELLOW' | 'RED'

/** Post-submit copy for publish lanes (GREEN auto-publish vs YELLOW review queue). */
export const MEDIA_PUBLISH_LANE_MESSAGES: Record<Exclude<MediaPublishLane, 'RED'>, string> = {
  GREEN:
    'Published. Your media is live for viewers allowed by your visibility choice. Adult content is welcome when attestations are complete.',
  YELLOW:
    'Pending review. Your upload was saved but needs a safety check before it appears in public views. This is a risk rule, not a ban on adult content.',
}

export type ResolvePublishLaneInput = {
  contentRating: MediaContentRating
  depictedPeople: DepictedPeople
  scanStatus: ScanStatus
  attestation?: MediaAttestationFields | null
}

const MEDIA_UPLOAD_STATUS_SET = new Set<string>(MEDIA_UPLOAD_STATUS_VALUES)
const MEDIA_CONTENT_RATING_SET = new Set<string>(MEDIA_CONTENT_RATING_VALUES)
const MEDIA_VISIBILITY_SET = new Set<string>(MEDIA_VISIBILITY_VALUES)
const DEPICTED_PEOPLE_SET = new Set<string>(DEPICTED_PEOPLE_VALUES)
const SCAN_STATUS_SET = new Set<string>(SCAN_STATUS_VALUES)
const MEDIA_STORAGE_STATE_SET = new Set<string>(MEDIA_STORAGE_STATE_VALUES)
const ADULT_CONTENT_PREFERENCE_SET = new Set<string>(ADULT_CONTENT_PREFERENCE_VALUES)
const MEDIA_CONTENT_SEVERITY_SET = new Set<string>(MEDIA_CONTENT_SEVERITY_VALUES)

const SEVERITY_BY_CONTENT_RATING: Record<MediaContentRating, MediaContentSeverity> = {
  [MEDIA_CONTENT_RATINGS.safePublic]: MEDIA_CONTENT_SEVERITIES.none,
  [MEDIA_CONTENT_RATINGS.adultNonExplicit]: MEDIA_CONTENT_SEVERITIES.low,
  [MEDIA_CONTENT_RATINGS.explicitAdult]: MEDIA_CONTENT_SEVERITIES.medium,
  [MEDIA_CONTENT_RATINGS.edgeReview]: MEDIA_CONTENT_SEVERITIES.high,
  [MEDIA_CONTENT_RATINGS.blockedIllegal]: MEDIA_CONTENT_SEVERITIES.blocked,
}

const SEVERITY_BY_SCAN_STATUS: Record<ScanStatus, MediaContentSeverity> = {
  [SCAN_STATUSES.notRequired]: MEDIA_CONTENT_SEVERITIES.none,
  [SCAN_STATUSES.pending]: MEDIA_CONTENT_SEVERITIES.low,
  [SCAN_STATUSES.running]: MEDIA_CONTENT_SEVERITIES.low,
  [SCAN_STATUSES.passed]: MEDIA_CONTENT_SEVERITIES.none,
  [SCAN_STATUSES.flagged]: MEDIA_CONTENT_SEVERITIES.high,
  [SCAN_STATUSES.failed]: MEDIA_CONTENT_SEVERITIES.high,
  [SCAN_STATUSES.error]: MEDIA_CONTENT_SEVERITIES.medium,
}

const SEVERITY_BY_UPLOAD_STATUS: Record<MediaUploadStatus, MediaContentSeverity> = {
  [MEDIA_UPLOAD_STATUSES.pendingUpload]: MEDIA_CONTENT_SEVERITIES.low,
  [MEDIA_UPLOAD_STATUSES.pendingAttestation]: MEDIA_CONTENT_SEVERITIES.low,
  [MEDIA_UPLOAD_STATUSES.pendingScan]: MEDIA_CONTENT_SEVERITIES.medium,
  [MEDIA_UPLOAD_STATUSES.autoApproved]: MEDIA_CONTENT_SEVERITIES.none,
  [MEDIA_UPLOAD_STATUSES.approvedBlurred]: MEDIA_CONTENT_SEVERITIES.low,
  [MEDIA_UPLOAD_STATUSES.quarantined]: MEDIA_CONTENT_SEVERITIES.high,
  [MEDIA_UPLOAD_STATUSES.rejected]: MEDIA_CONTENT_SEVERITIES.high,
  [MEDIA_UPLOAD_STATUSES.removed]: MEDIA_CONTENT_SEVERITIES.medium,
  [MEDIA_UPLOAD_STATUSES.escalated]: MEDIA_CONTENT_SEVERITIES.high,
  [MEDIA_UPLOAD_STATUSES.preserved]: MEDIA_CONTENT_SEVERITIES.medium,
}

export function isKnownMediaUploadStatus(value: string): value is MediaUploadStatus {
  return MEDIA_UPLOAD_STATUS_SET.has(value)
}

export function isKnownMediaContentRating(value: string): value is MediaContentRating {
  return MEDIA_CONTENT_RATING_SET.has(value)
}

export function isKnownMediaVisibility(value: string): value is MediaVisibility {
  return MEDIA_VISIBILITY_SET.has(value)
}

export function isKnownDepictedPeople(value: string): value is DepictedPeople {
  return DEPICTED_PEOPLE_SET.has(value)
}

export function isKnownScanStatus(value: string): value is ScanStatus {
  return SCAN_STATUS_SET.has(value)
}

export function isKnownMediaStorageState(value: string): value is MediaStorageState {
  return MEDIA_STORAGE_STATE_SET.has(value)
}

export function isPublicStorageState(state: MediaStorageState | null | undefined): boolean {
  return state === MEDIA_STORAGE_STATES.approvedPublic
}

export function isKnownAdultContentPreference(value: string): value is AdultContentPreference {
  return ADULT_CONTENT_PREFERENCE_SET.has(value)
}

export function isKnownMediaContentSeverity(value: string): value is MediaContentSeverity {
  return MEDIA_CONTENT_SEVERITY_SET.has(value)
}

export function isExplicitRating(rating: MediaContentRating): boolean {
  return rating === MEDIA_CONTENT_RATINGS.explicitAdult
}

export function isPublishBlocked(rating: MediaContentRating): boolean {
  return rating === MEDIA_CONTENT_RATINGS.blockedIllegal
}

export function explicitCannotBePublicPreview(
  visibility: MediaVisibility,
  rating: MediaContentRating
): boolean {
  return visibility === MEDIA_VISIBILITIES.publicPreview && isExplicitRating(rating)
}

/** Whether media at this visibility may use unauthenticated direct object URLs (MinIO/Caddy). */
export function visibilityAllowsAnonymousDirectUrl(
  visibility: MediaVisibility | null | undefined,
): boolean {
  return visibility === MEDIA_VISIBILITIES.publicPreview
}

export function isMultiPersonDepiction(depictedPeople: DepictedPeople): boolean {
  return (
    depictedPeople === DEPICTED_PEOPLE.meAndOtherAdults ||
    depictedPeople === DEPICTED_PEOPLE.otherAdults
  )
}

export function hasRequiredAttestations(
  attestation: MediaAttestationFields | null | undefined
): boolean {
  if (!attestation) return false
  return REQUIRED_ATTESTATION_FIELDS.every((field) => attestation[field] === true)
}

/** Uploader checkbox values as persisted / submitted on media assets. */
export type UploaderAttestationInput = {
  uploaderConfirmed18: boolean
  uploaderConfirmedDepictedAdults18: boolean
  uploaderConfirmedConsent: boolean
  uploaderConfirmedRightToUpload: boolean
  uploaderConfirmedNoNcii: boolean
  uploaderConfirmedNoMinors: boolean
  uploaderConfirmedNoHiddenCamera: boolean
  uploaderConfirmedNoAiDeepfakeWithoutConsent: boolean
  /** When set, drives `contentRatingAccurate` (presence of a rating). */
  contentRating?: string | null
  /**
   * When true, treat content rating as accurate without inspecting `contentRating`
   * (used at submit time after validation already accepted the rating).
   */
  contentRatingAccurate?: boolean
}

/**
 * Map uploader UI attestations to publish-lane fields.
 * GREEN solo-explicit needs every mapped lane field true.
 */
export function mapUploaderAttestationToPublishLaneFields(
  input: UploaderAttestationInput,
): MediaAttestationFields {
  return {
    allDepictedAreAdults:
      input.uploaderConfirmedDepictedAdults18 && input.uploaderConfirmedNoMinors,
    iAmDepictedOrAuthorizedUploader:
      input.uploaderConfirmed18 &&
      input.uploaderConfirmedRightToUpload &&
      input.uploaderConfirmedConsent,
    noHiddenCameraOrNonConsensualCapture:
      input.uploaderConfirmedNoHiddenCamera && input.uploaderConfirmedNoNcii,
    contentRatingAccurate:
      input.contentRatingAccurate === true || Boolean(input.contentRating),
  }
}

export function isScanBlockingPublish(scanStatus: ScanStatus): boolean {
  return (
    scanStatus === SCAN_STATUSES.pending ||
    scanStatus === SCAN_STATUSES.running ||
    scanStatus === SCAN_STATUSES.flagged ||
    scanStatus === SCAN_STATUSES.failed ||
    scanStatus === SCAN_STATUSES.error
  )
}

export function isMediaPublishedStatus(status: MediaUploadStatus): boolean {
  return (
    status === MEDIA_UPLOAD_STATUSES.autoApproved || status === MEDIA_UPLOAD_STATUSES.approvedBlurred
  )
}

/** Default triage severity for a content rating. */
export function severityForContentRating(rating: MediaContentRating): MediaContentSeverity {
  return SEVERITY_BY_CONTENT_RATING[rating]
}

/** Default triage severity for vendor scan outcome. */
export function severityForScanStatus(scanStatus: ScanStatus): MediaContentSeverity {
  return SEVERITY_BY_SCAN_STATUS[scanStatus]
}

/** Default triage severity for upload lifecycle status. */
export function severityForUploadStatus(status: MediaUploadStatus): MediaContentSeverity {
  return SEVERITY_BY_UPLOAD_STATUS[status]
}

/**
 * Risk-based publish lane (publish-most model).
 * GREEN - auto-publish solo explicit with all attestations and scan clear.
 * YELLOW - multi-person explicit, EDGE_REVIEW, missing scan, or incomplete attestation.
 * RED - BLOCKED_ILLEGAL (never publish).
 */
export function resolvePublishLane(input: ResolvePublishLaneInput): MediaPublishLane {
  const { contentRating, depictedPeople, scanStatus, attestation } = input

  if (isPublishBlocked(contentRating)) {
    return 'RED'
  }

  if (contentRating === MEDIA_CONTENT_RATINGS.edgeReview) {
    return 'YELLOW'
  }

  if (isScanBlockingPublish(scanStatus)) {
    return 'YELLOW'
  }

  if (contentRating === MEDIA_CONTENT_RATINGS.explicitAdult) {
    if (
      isMultiPersonDepiction(depictedPeople) ||
      depictedPeople === DEPICTED_PEOPLE.unknown ||
      !hasRequiredAttestations(attestation)
    ) {
      return 'YELLOW'
    }
    return 'GREEN'
  }

  return 'GREEN'
}

export const mediaUploadStatusSchema = z.enum([
  MEDIA_UPLOAD_STATUSES.pendingUpload,
  MEDIA_UPLOAD_STATUSES.pendingAttestation,
  MEDIA_UPLOAD_STATUSES.pendingScan,
  MEDIA_UPLOAD_STATUSES.autoApproved,
  MEDIA_UPLOAD_STATUSES.approvedBlurred,
  MEDIA_UPLOAD_STATUSES.quarantined,
  MEDIA_UPLOAD_STATUSES.rejected,
  MEDIA_UPLOAD_STATUSES.removed,
  MEDIA_UPLOAD_STATUSES.escalated,
  MEDIA_UPLOAD_STATUSES.preserved,
])

export const mediaContentRatingSchema = z.enum([
  MEDIA_CONTENT_RATINGS.safePublic,
  MEDIA_CONTENT_RATINGS.adultNonExplicit,
  MEDIA_CONTENT_RATINGS.explicitAdult,
  MEDIA_CONTENT_RATINGS.edgeReview,
  MEDIA_CONTENT_RATINGS.blockedIllegal,
])

export const mediaVisibilitySchema = z.enum([
  MEDIA_VISIBILITIES.publicPreview,
  MEDIA_VISIBILITIES.loggedIn,
  MEDIA_VISIBILITIES.followers,
  MEDIA_VISIBILITIES.privateProfile,
  MEDIA_VISIBILITIES.groupOnly,
  MEDIA_VISIBILITIES.orgOnly,
  MEDIA_VISIBILITIES.eventAttendees,
  MEDIA_VISIBILITIES.conventionAttendees,
  MEDIA_VISIBILITIES.staffOnly,
])

export const depictedPeopleSchema = z.enum([
  DEPICTED_PEOPLE.onlyMe,
  DEPICTED_PEOPLE.meAndOtherAdults,
  DEPICTED_PEOPLE.otherAdults,
  DEPICTED_PEOPLE.noIdentifiablePerson,
  DEPICTED_PEOPLE.unknown,
])

export const scanStatusSchema = z.enum([
  SCAN_STATUSES.notRequired,
  SCAN_STATUSES.pending,
  SCAN_STATUSES.running,
  SCAN_STATUSES.passed,
  SCAN_STATUSES.flagged,
  SCAN_STATUSES.failed,
  SCAN_STATUSES.error,
])

export const mediaContentSeveritySchema = z.enum([
  MEDIA_CONTENT_SEVERITIES.none,
  MEDIA_CONTENT_SEVERITIES.low,
  MEDIA_CONTENT_SEVERITIES.medium,
  MEDIA_CONTENT_SEVERITIES.high,
  MEDIA_CONTENT_SEVERITIES.blocked,
])

export const mediaPublishLaneSchema = z.enum(['GREEN', 'YELLOW', 'RED'])

const attestationFieldSchema = z.boolean()

export const mediaAttestationFieldsSchema = z.object({
  allDepictedAreAdults: attestationFieldSchema.optional(),
  iAmDepictedOrAuthorizedUploader: attestationFieldSchema.optional(),
  noHiddenCameraOrNonConsensualCapture: attestationFieldSchema.optional(),
  contentRatingAccurate: attestationFieldSchema.optional(),
})

export const mediaAttestationSchema = mediaAttestationFieldsSchema.extend({
  attestationVersion: z.number().int().positive().optional(),
  attestedAt: z.string().datetime().optional(),
})

export const resolvePublishLaneInputSchema = z.object({
  contentRating: mediaContentRatingSchema,
  depictedPeople: depictedPeopleSchema,
  scanStatus: scanStatusSchema,
  attestation: mediaAttestationFieldsSchema.nullish(),
})
