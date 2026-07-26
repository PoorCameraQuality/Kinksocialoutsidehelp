import { eq } from 'drizzle-orm'
import {
  explicitCannotBePublicPreview,
  MEDIA_ATTESTATION_VERSION,
  MEDIA_CONTENT_RATINGS,
  MEDIA_STORAGE_STATES,
  MEDIA_UPLOAD_STATUSES,
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  mapUploaderAttestationToPublishLaneFields,
  resolvePublishLane,
  SCAN_STATUSES,
  type MediaAttestationFields,
  type MediaContentRating,
  type MediaPublishLane,
  type MediaUploadStatus,
  type MediaVisibility,
  type DepictedPeople,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import type { MediaAsset } from '../db/schema.js'
import {
  computeMediaUploadStatusAfterAttestation,
  resolveEffectivePublishLane,
} from './media-publish-lane.js'
import { finalizeMediaAfterAttestation, mediaContentProxyPath } from './media-pipeline.js'
import { buildContentSnapshot } from './moderation-ts-intake.js'
import { buildMediaScannerSummary } from './media-scan/orchestrator.js'
import {
  applyExplicitMediaPrivacyDefaults,
  assertMediaContentRatingAllowed,
} from './media-policy.js'
import { upsertScannerModerationCase } from './media-scanner-case.js'
import {
  assertProfilePhotoContentRatingAllowed,
  isProfileGallerySurface,
} from './profile-photo-policy.js'
import {
  deriveMediaModerationDecision,
  logMediaModerationDecision,
  type MediaModerationDecision,
} from './media-moderation-decision.js'

export class MediaAssetAccessError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'MediaAssetAccessError'
  }
}

export class MediaAssetNotFoundError extends Error {
  constructor() {
    super('Media asset not found')
    this.name = 'MediaAssetNotFoundError'
  }
}

export class MediaAttestationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaAttestationValidationError'
  }
}

export type ProfilePhotoMediaDto = {
  mediaAssetId: string | null
  uploadStatus: MediaUploadStatus | null
  contentRating: MediaContentRating | null
  visibility: MediaVisibility | null
  isBlurredByDefault: boolean
  pendingReview: boolean
  publishLane: MediaPublishLane | null
  moderationDecision?: Pick<
    MediaModerationDecision,
    'reasonCode' | 'reasonSummary' | 'blockedFromMemberSurfaces' | 'alphaAuthProxyServing'
  > | null
}

function mapDbAttestationToShared(row: MediaAsset): MediaAttestationFields {
  return mapUploaderAttestationToPublishLaneFields({
    uploaderConfirmed18: row.uploaderConfirmed18,
    uploaderConfirmedDepictedAdults18: row.uploaderConfirmedDepictedAdults18,
    uploaderConfirmedConsent: row.uploaderConfirmedConsent,
    uploaderConfirmedRightToUpload: row.uploaderConfirmedRightToUpload,
    uploaderConfirmedNoNcii: row.uploaderConfirmedNoNcii,
    uploaderConfirmedNoMinors: row.uploaderConfirmedNoMinors,
    uploaderConfirmedNoHiddenCamera: row.uploaderConfirmedNoHiddenCamera,
    uploaderConfirmedNoAiDeepfakeWithoutConsent: row.uploaderConfirmedNoAiDeepfakeWithoutConsent,
    contentRating: row.contentRating,
  })
}

export function mediaAssetToPhotoDto(media: MediaAsset | null | undefined): ProfilePhotoMediaDto {
  if (!media) {
    return {
      mediaAssetId: null,
      uploadStatus: null,
      contentRating: null,
      visibility: null,
      isBlurredByDefault: false,
      pendingReview: false,
      publishLane: null,
    }
  }

  const lane =
    media.contentRating && media.depictedPeople
      ? resolvePublishLane({
          contentRating: media.contentRating as MediaContentRating,
          depictedPeople: media.depictedPeople as DepictedPeople,
          scanStatus: media.scanStatus as Parameters<typeof resolvePublishLane>[0]['scanStatus'],
          attestation: mapDbAttestationToShared(media),
        })
      : null

  const status = media.uploadStatus as MediaUploadStatus
  const pendingReview =
    status === MEDIA_UPLOAD_STATUSES.pendingScan ||
    status === MEDIA_UPLOAD_STATUSES.quarantined ||
    status === MEDIA_UPLOAD_STATUSES.escalated ||
    (lane === 'YELLOW' &&
      status !== MEDIA_UPLOAD_STATUSES.pendingAttestation &&
      status !== MEDIA_UPLOAD_STATUSES.rejected)

  const moderationDecision = deriveMediaModerationDecision({
    asset: media,
    publishLane: lane,
  })

  return {
    mediaAssetId: media.id,
    uploadStatus: status,
    contentRating: (media.contentRating as MediaContentRating | null) ?? null,
    visibility: (media.visibility as MediaVisibility | null) ?? null,
    isBlurredByDefault: media.isBlurredByDefault,
    pendingReview,
    publishLane: lane,
    moderationDecision: {
      reasonCode: moderationDecision.reasonCode,
      reasonSummary: moderationDecision.reasonSummary,
      blockedFromMemberSurfaces: moderationDecision.blockedFromMemberSurfaces,
      alphaAuthProxyServing: moderationDecision.alphaAuthProxyServing,
    },
  }
}

export async function createMediaAssetForUpload(params: {
  userId: string
  ownerType: string
  ownerId: string
  sourceSurface: string
  quarantineKey?: string
  url?: string
  mimeType?: string
  sizeBytes?: number
  originalFilename?: string
  sha256Hash?: string
  imageWidth?: number
  imageHeight?: number
  videoWidth?: number
  videoHeight?: number
  durationSeconds?: number
  storageBucket?: string
}): Promise<string> {
  const quarantineKey = params.quarantineKey ?? null
  const legacyUrl = params.url ?? null
  const storageKey = quarantineKey ?? legacyUrl ?? ''
  if (!storageKey) {
    throw new Error('quarantineKey or url required')
  }

  const [row] = await db
    .insert(schema.mediaAssets)
    .values({
      uploaderUserId: params.userId,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      sourceSurface: params.sourceSurface,
      storageKey,
      originalStorageKey: quarantineKey ?? legacyUrl,
      quarantineStorageKey: quarantineKey,
      storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
      storageProvider: 's3',
      storageBucket: params.storageBucket ?? null,
      mimeType: params.mimeType ?? 'image/jpeg',
      sizeBytes: params.sizeBytes ?? 0,
      originalFilename: params.originalFilename ?? null,
      sha256Hash: params.sha256Hash ?? null,
      imageWidth: params.imageWidth ?? null,
      imageHeight: params.imageHeight ?? null,
      videoWidth: params.videoWidth ?? null,
      videoHeight: params.videoHeight ?? null,
      durationSeconds: params.durationSeconds ?? null,
      uploadStatus: MEDIA_UPLOAD_STATUSES.pendingAttestation,
      scanStatus: SCAN_STATUSES.notRequired,
    })
    .returning({ id: schema.mediaAssets.id })
  return row!.id
}

export async function createMediaAssetForProfilePhoto(params: {
  userId: string
  profileId: string
  /** Defaults to profile_gallery (portrait policy). Pass feed_upload for non-portrait profile media. */
  sourceSurface?: string
  url?: string
  quarantineKey?: string
  sha256Hash?: string
  mimeType?: string
  sizeBytes?: number
  originalFilename?: string
  imageWidth?: number
  imageHeight?: number
  storageBucket?: string
}): Promise<string> {
  return createMediaAssetForUpload({
    userId: params.userId,
    ownerType: 'profile',
    ownerId: params.profileId,
    sourceSurface: params.sourceSurface ?? 'profile_gallery',
    url: params.url,
    quarantineKey: params.quarantineKey,
    sha256Hash: params.sha256Hash,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    originalFilename: params.originalFilename,
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    storageBucket: params.storageBucket,
  })
}

export type SubmitMediaAttestationInput = {
  mediaAssetId: string
  userId: string
  contentRating: MediaContentRating
  depictedPeople: DepictedPeople
  visibility: MediaVisibility
  uploaderConfirmed18: boolean
  uploaderConfirmedDepictedAdults18: boolean
  uploaderConfirmedConsent: boolean
  uploaderConfirmedRightToUpload: boolean
  uploaderConfirmedNoNcii: boolean
  uploaderConfirmedNoMinors: boolean
  uploaderConfirmedNoHiddenCamera: boolean
  uploaderConfirmedNoAiDeepfakeWithoutConsent: boolean
}

export async function submitMediaAttestation(
  input: SubmitMediaAttestationInput
): Promise<{
  lane: MediaPublishLane
  uploadStatus: MediaUploadStatus
  moderationCaseId: string | null
  storageState?: string
  promoted?: boolean
  contentUrl?: string | null
  moderationDecision: MediaModerationDecision
}> {
  const [existing] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, input.mediaAssetId))
    .limit(1)

  if (!existing) {
    throw new MediaAssetNotFoundError()
  }
  if (existing.uploaderUserId !== input.userId) {
    throw new MediaAssetAccessError()
  }

  assertMediaContentRatingAllowed(input.contentRating)
  if (isProfileGallerySurface(existing.sourceSurface)) {
    assertProfilePhotoContentRatingAllowed(input.contentRating)
  }

  const visibility = applyExplicitMediaPrivacyDefaults({
    contentRating: input.contentRating,
    visibility: input.visibility,
  })

  if (explicitCannotBePublicPreview(visibility, input.contentRating)) {
    throw new MediaAttestationValidationError('Explicit content cannot use public preview visibility')
  }

  const attestation: MediaAttestationFields = mapUploaderAttestationToPublishLaneFields({
    uploaderConfirmed18: input.uploaderConfirmed18,
    uploaderConfirmedDepictedAdults18: input.uploaderConfirmedDepictedAdults18,
    uploaderConfirmedConsent: input.uploaderConfirmedConsent,
    uploaderConfirmedRightToUpload: input.uploaderConfirmedRightToUpload,
    uploaderConfirmedNoNcii: input.uploaderConfirmedNoNcii,
    uploaderConfirmedNoMinors: input.uploaderConfirmedNoMinors,
    uploaderConfirmedNoHiddenCamera: input.uploaderConfirmedNoHiddenCamera,
    uploaderConfirmedNoAiDeepfakeWithoutConsent: input.uploaderConfirmedNoAiDeepfakeWithoutConsent,
    contentRatingAccurate: true,
  })

  const laneInput = {
    contentRating: input.contentRating,
    depictedPeople: input.depictedPeople,
    scanStatus: existing.scanStatus as Parameters<typeof resolvePublishLane>[0]['scanStatus'],
    attestation,
    // PR 3 (M2): destination visibility decides whether attestation may
    // auto-publish or must go through the human-review lane.
    visibility,
  }

  const lane = resolveEffectivePublishLane(laneInput)
  let uploadStatus = computeMediaUploadStatusAfterAttestation(laneInput)

  let moderationCaseId = existing.moderationCaseId

  if (lane === 'YELLOW' && !moderationCaseId) {
    const severity =
      input.contentRating === MEDIA_CONTENT_RATINGS.explicitAdult
        ? POLICY_SEVERITIES.medium
        : POLICY_SEVERITIES.low
    const [caseRow] = await db
      .insert(schema.moderationCases)
      .values({
        targetContentType: 'media_asset',
        targetContentId: input.mediaAssetId,
        targetUserId: input.userId,
        policyReason: POLICY_REASONS.consentSafety,
        severity,
        queue: MODERATION_QUEUES.mediaReview,
        status: MODERATION_CASE_STATUSES.open,
      })
      .returning({ id: schema.moderationCases.id })
    moderationCaseId = caseRow!.id

    await db.insert(schema.moderationQueueItems).values({
      caseId: moderationCaseId,
      queue: MODERATION_QUEUES.mediaReview,
      severity,
      status: 'OPEN',
    })
  }

  const now = new Date()
  await db
    .update(schema.mediaAssets)
    .set({
      contentRating: input.contentRating,
      depictedPeople: input.depictedPeople,
      visibility,
      uploadStatus,
      moderationCaseId,
      uploaderConfirmed18: input.uploaderConfirmed18,
      uploaderConfirmedDepictedAdults18: input.uploaderConfirmedDepictedAdults18,
      uploaderConfirmedConsent: input.uploaderConfirmedConsent,
      uploaderConfirmedRightToUpload: input.uploaderConfirmedRightToUpload,
      uploaderConfirmedNoNcii: input.uploaderConfirmedNoNcii,
      uploaderConfirmedNoMinors: input.uploaderConfirmedNoMinors,
      uploaderConfirmedNoHiddenCamera: input.uploaderConfirmedNoHiddenCamera,
      uploaderConfirmedNoAiDeepfakeWithoutConsent: input.uploaderConfirmedNoAiDeepfakeWithoutConsent,
      isBlurredByDefault: false,
      attestedAt: now,
      attestationVersion: MEDIA_ATTESTATION_VERSION,
      updatedAt: now,
    })
    .where(eq(schema.mediaAssets.id, input.mediaAssetId))

  await db.insert(schema.moderationEvents).values({
    caseId: moderationCaseId,
    actorUserId: input.userId,
    eventType: 'media.attestation_submitted',
    payload: {
      mediaAssetId: input.mediaAssetId,
      lane,
      uploadStatus,
      contentRating: input.contentRating,
      moderationCaseId,
    },
  })

  const pipeline = await finalizeMediaAfterAttestation({
    mediaAssetId: input.mediaAssetId,
    userId: input.userId,
    lane,
    uploadStatus,
  })

  uploadStatus = pipeline.uploadStatus

  if (
    pipeline.scannerResults.length > 0 &&
    (pipeline.scanStatus === SCAN_STATUSES.flagged ||
      pipeline.scanStatus === SCAN_STATUSES.failed ||
      pipeline.scanStatus === SCAN_STATUSES.error)
  ) {
    const scannerCaseId = await upsertScannerModerationCase({
      mediaAssetId: input.mediaAssetId,
      uploaderUserId: input.userId,
      scannerResults: pipeline.scannerResults,
      actorUserId: input.userId,
    })
    if (scannerCaseId) {
      moderationCaseId = moderationCaseId ?? scannerCaseId
      await db
        .update(schema.mediaAssets)
        .set({ moderationCaseId, updatedAt: new Date() })
        .where(eq(schema.mediaAssets.id, input.mediaAssetId))
    }
  }

  const scannerSummary = await buildMediaScannerSummary(input.mediaAssetId, pipeline.scanStatus)

  const [finalRow] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, input.mediaAssetId))
    .limit(1)

  const moderationDecision = deriveMediaModerationDecision({
    asset: finalRow ?? existing,
    publishLane: lane,
    scannerResults: pipeline.scannerResults,
  })

  if ((lane === 'YELLOW' || moderationCaseId) && moderationCaseId) {
    const snapshot = await buildContentSnapshot('media_asset', input.mediaAssetId)
    if (snapshot) {
      // PR 3 (M4): pipeline decision context lives inside `mediaMetadata`, which
      // is where the web moderation UI (useApiModerationTs) reads it from.
      const pipelineContext = {
        storageState: pipeline.storageState,
        scanStatus: pipeline.scanStatus,
        publishLane: lane,
        promoted: pipeline.promoted,
        scannerSummary,
        moderationDecision,
      }
      await db.insert(schema.contentSnapshots).values({
        caseId: moderationCaseId,
        targetContentType: 'media_asset',
        targetContentId: input.mediaAssetId,
        snapshot: {
          ...snapshot,
          mediaMetadata: {
            ...(snapshot.mediaMetadata ?? {}),
            pipeline: pipelineContext,
          },
        },
      })
    }
  }

  logMediaModerationDecision('media.attestation_decision', {
    mediaAssetId: input.mediaAssetId,
    userId: input.userId,
    mimeType: existing.mimeType,
    sizeBytes: existing.sizeBytes,
    sourceSurface: existing.sourceSurface,
    decision: moderationDecision,
  })

  return {
    lane,
    uploadStatus: (finalRow?.uploadStatus ?? uploadStatus) as MediaUploadStatus,
    moderationCaseId,
    storageState: pipeline.storageState,
    promoted: pipeline.promoted,
    contentUrl: pipeline.promoted
      ? null
      : mediaContentProxyPath(input.mediaAssetId),
    moderationDecision,
  }
}

export async function getMediaAssetById(mediaAssetId: string) {
  const [row] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, mediaAssetId))
    .limit(1)
  return row ?? null
}

/** Ensure the authenticated user staged or uploaded the asset. */
export async function assertMediaAssetUploader(userId: string, mediaAssetId: string): Promise<void> {
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) {
    throw new MediaAssetNotFoundError()
  }
  if (asset.uploaderUserId !== userId) {
    throw new MediaAssetAccessError()
  }
}
