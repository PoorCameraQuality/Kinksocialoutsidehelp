/**
 * Trust & safety report/case intake: validate target, open/dedupe case, snapshot,
 * optional P0 notify, legacy report mirror, incident attach.
 *
 * Large by design (intake orchestration). Prefer extracting notify/persistence helpers
 * over growing new product flows here. Humans decide outcomes — this module opens work.
 */
import {
  MODERATION_CASE_STATUSES,
  resolvePublishLane,
  type DepictedPeople,
  type MediaContentRating,
  type MediaPublishLane,
  type PolicyReason,
  queueForPolicyReason,
  severityForPolicyReason,
  isP0PolicyReason,
  LEGACY_REPORT_CATEGORIES,
  POLICY_REASONS,
} from '@c2k/shared'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getModerationQueue } from './moderation-queue.js'
import { notifyOrgModerationNeeded, notifyP0ModerationCaseCreated } from './moderation-notify.js'
import { resolveModerationReportContext } from './moderation-report-context.js'
import { resolveReportScope } from './moderation-report-scope.js'
import { buildMediaScannerSummary } from './media-scan/orchestrator.js'
import {
  type ModerationReportTargetType,
  toLegacyContextTargetType,
  validateModerationReportTarget,
} from './moderation-ts-target-validate.js'

export {
  MODERATION_REPORT_TARGET_TYPES,
  type ModerationReportTargetType,
  isModerationReportTargetType,
  normalizeModerationReportTargetType,
  toLegacyContextTargetType,
} from './moderation-ts-target-validate.js'

export type MediaAssetSnapshotMetadata = {
  mimeType: string
  sizeBytes: number
  originalFilename: string | null
  uploadStatus: string
  contentRating: string | null
  visibility: string | null
  depictedPeople: string | null
  scanStatus: string
  storageState: string
  sha256Hash: string | null
  imageWidth: number | null
  imageHeight: number | null
  publishLane: MediaPublishLane | null
  hasPublicUrl: boolean
  sourceSurface: string
  ownerType: string
  ownerId: string
  reportable: boolean
  isBlurredByDefault: boolean
  attestedAt: string | null
  attestationVersion: number | null
  attestation: {
    uploaderConfirmed18: boolean
    uploaderConfirmedDepictedAdults18: boolean
    uploaderConfirmedConsent: boolean
    uploaderConfirmedRightToUpload: boolean
    uploaderConfirmedNoNcii: boolean
    uploaderConfirmedNoMinors: boolean
    uploaderConfirmedNoHiddenCamera: boolean
    uploaderConfirmedNoAiDeepfakeWithoutConsent: boolean
  }
  linkedProfilePhotoId: string | null
  uploaderUsername: string | null
  scannerSummary?: {
    finalScanStatus: string
    quarantineReason: string | null
    scanners: Array<{
      name: string
      status: string
      summary: string
      labels: string[]
      simulated: boolean
    }>
  } | null
  /**
   * PR 3 (M4): pipeline decision context written by `submitMediaAttestation`
   * after finalize. Lives here (not at the snapshot root) because the web
   * moderation UI reads `mediaMetadata.pipeline`.
   */
  pipeline?: {
    storageState: string
    scanStatus: string
    publishLane: MediaPublishLane
    promoted: boolean
    scannerSummary?: unknown
    moderationDecision?: { reasonCode?: string; reasonSummary?: string } | null
  }
}

export type ContentSnapshotPayload = {
  targetType: ModerationReportTargetType
  targetId: string
  label: string | null
  excerpt: string | null
  href: string | null
  scopeType: string | null
  scopeName: string | null
  capturedAt: string
  mediaMetadata?: MediaAssetSnapshotMetadata
}

async function loadMediaAssetSnapshotMetadata(
  assetId: string
): Promise<MediaAssetSnapshotMetadata | null> {
  const [asset] = await db
    .select({
      mimeType: schema.mediaAssets.mimeType,
      sizeBytes: schema.mediaAssets.sizeBytes,
      originalFilename: schema.mediaAssets.originalFilename,
      uploadStatus: schema.mediaAssets.uploadStatus,
      contentRating: schema.mediaAssets.contentRating,
      visibility: schema.mediaAssets.visibility,
      depictedPeople: schema.mediaAssets.depictedPeople,
      scanStatus: schema.mediaAssets.scanStatus,
      storageState: schema.mediaAssets.storageState,
      sha256Hash: schema.mediaAssets.sha256Hash,
      imageWidth: schema.mediaAssets.imageWidth,
      imageHeight: schema.mediaAssets.imageHeight,
      publicStorageKey: schema.mediaAssets.publicStorageKey,
      promotedAt: schema.mediaAssets.promotedAt,
      sourceSurface: schema.mediaAssets.sourceSurface,
      ownerType: schema.mediaAssets.ownerType,
      ownerId: schema.mediaAssets.ownerId,
      reportable: schema.mediaAssets.reportable,
      isBlurredByDefault: schema.mediaAssets.isBlurredByDefault,
      attestedAt: schema.mediaAssets.attestedAt,
      attestationVersion: schema.mediaAssets.attestationVersion,
      uploaderConfirmed18: schema.mediaAssets.uploaderConfirmed18,
      uploaderConfirmedDepictedAdults18: schema.mediaAssets.uploaderConfirmedDepictedAdults18,
      uploaderConfirmedConsent: schema.mediaAssets.uploaderConfirmedConsent,
      uploaderConfirmedRightToUpload: schema.mediaAssets.uploaderConfirmedRightToUpload,
      uploaderConfirmedNoNcii: schema.mediaAssets.uploaderConfirmedNoNcii,
      uploaderConfirmedNoMinors: schema.mediaAssets.uploaderConfirmedNoMinors,
      uploaderConfirmedNoHiddenCamera: schema.mediaAssets.uploaderConfirmedNoHiddenCamera,
      uploaderConfirmedNoAiDeepfakeWithoutConsent:
        schema.mediaAssets.uploaderConfirmedNoAiDeepfakeWithoutConsent,
      uploaderUserId: schema.mediaAssets.uploaderUserId,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, assetId))
    .limit(1)

  if (!asset) return null

  const attestation = {
    uploaderConfirmed18: asset.uploaderConfirmed18,
    uploaderConfirmedDepictedAdults18: asset.uploaderConfirmedDepictedAdults18,
    uploaderConfirmedConsent: asset.uploaderConfirmedConsent,
    uploaderConfirmedRightToUpload: asset.uploaderConfirmedRightToUpload,
    uploaderConfirmedNoNcii: asset.uploaderConfirmedNoNcii,
    uploaderConfirmedNoMinors: asset.uploaderConfirmedNoMinors,
    uploaderConfirmedNoHiddenCamera: asset.uploaderConfirmedNoHiddenCamera,
    uploaderConfirmedNoAiDeepfakeWithoutConsent:
      asset.uploaderConfirmedNoAiDeepfakeWithoutConsent,
  }

  const publishLane =
    asset.contentRating && asset.depictedPeople
      ? resolvePublishLane({
          contentRating: asset.contentRating as MediaContentRating,
          depictedPeople: asset.depictedPeople as DepictedPeople,
          scanStatus: asset.scanStatus as Parameters<typeof resolvePublishLane>[0]['scanStatus'],
          attestation: {
            allDepictedAreAdults:
              attestation.uploaderConfirmedDepictedAdults18 && attestation.uploaderConfirmedNoMinors,
            iAmDepictedOrAuthorizedUploader:
              attestation.uploaderConfirmed18 &&
              attestation.uploaderConfirmedRightToUpload &&
              attestation.uploaderConfirmedConsent,
            noHiddenCameraOrNonConsensualCapture:
              attestation.uploaderConfirmedNoHiddenCamera && attestation.uploaderConfirmedNoNcii,
            contentRatingAccurate: Boolean(asset.contentRating),
          },
        })
      : null

  const [uploader] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, asset.uploaderUserId))
    .limit(1)

  const [linkedPhoto] = await db
    .select({ id: schema.profilePhotos.id })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.mediaAssetId, assetId))
    .limit(1)

  const scannerSummary = await buildMediaScannerSummary(assetId, asset.scanStatus)

  return {
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    originalFilename: asset.originalFilename,
    uploadStatus: asset.uploadStatus,
    contentRating: asset.contentRating,
    visibility: asset.visibility,
    depictedPeople: asset.depictedPeople,
    scanStatus: asset.scanStatus,
    storageState: asset.storageState,
    sha256Hash: asset.sha256Hash,
    imageWidth: asset.imageWidth,
    imageHeight: asset.imageHeight,
    publishLane,
    hasPublicUrl: Boolean(asset.publicStorageKey && asset.promotedAt),
    sourceSurface: asset.sourceSurface,
    ownerType: asset.ownerType,
    ownerId: asset.ownerId,
    reportable: asset.reportable,
    isBlurredByDefault: asset.isBlurredByDefault,
    attestedAt: asset.attestedAt?.toISOString() ?? null,
    attestationVersion: asset.attestationVersion,
    attestation,
    linkedProfilePhotoId: linkedPhoto?.id ?? null,
    uploaderUsername: uploader?.username ?? null,
    scannerSummary,
  }
}

export async function resolveMediaAssetSnapshotContext(assetId: string): Promise<{
  label: string
  href: string | null
  scopeType: string | null
  scopeName: string | null
  excerpt: string | null
}> {
  const [asset] = await db
    .select({
      sourceSurface: schema.mediaAssets.sourceSurface,
      ownerType: schema.mediaAssets.ownerType,
      ownerId: schema.mediaAssets.ownerId,
      originalFilename: schema.mediaAssets.originalFilename,
      contentRating: schema.mediaAssets.contentRating,
      uploadStatus: schema.mediaAssets.uploadStatus,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, assetId))
    .limit(1)

  if (!asset) {
    return {
      label: 'Media asset (not found)',
      href: null,
      scopeType: null,
      scopeName: null,
      excerpt: null,
    }
  }

  const surfaceLabel = asset.sourceSurface.replace(/_/g, ' ')
  const ratingLabel = asset.contentRating ? ` · ${asset.contentRating.replace(/_/g, ' ')}` : ''
  const excerpt = [
    asset.originalFilename,
    `${asset.uploadStatus.replace(/_/g, ' ')}${ratingLabel}`,
  ]
    .filter(Boolean)
    .join(' · ')

  if (asset.ownerType === 'profile') {
    const [profile] = await db
      .select({ username: schema.users.username })
      .from(schema.profiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.profiles.id, asset.ownerId))
      .limit(1)
    return {
      label: `Media asset (${surfaceLabel})`,
      href: profile ? `/profile/${profile.username}?tab=Photos` : null,
      scopeType: 'platform',
      scopeName: profile ? `@${profile.username}` : null,
      excerpt: excerpt || null,
    }
  }

  return {
    label: `Media asset (${surfaceLabel})`,
    href: null,
    scopeType: null,
    scopeName: null,
    excerpt: excerpt || null,
  }
}

export async function buildContentSnapshot(
  targetType: ModerationReportTargetType,
  targetId: string
): Promise<ContentSnapshotPayload> {
  if (targetType === 'media_asset') {
    const ctx = await resolveMediaAssetSnapshotContext(targetId)
    const mediaMetadata = await loadMediaAssetSnapshotMetadata(targetId)
    return {
      targetType,
      targetId,
      label: ctx.label,
      excerpt: ctx.excerpt,
      href: ctx.href,
      scopeType: ctx.scopeType,
      scopeName: ctx.scopeName,
      capturedAt: new Date().toISOString(),
      ...(mediaMetadata ? { mediaMetadata } : {}),
    }
  }

  if (targetType === 'message') {
    const [row] = await db
      .select({ body: schema.messages.body })
      .from(schema.messages)
      .where(eq(schema.messages.id, targetId))
      .limit(1)
    const excerpt = row?.body ? row.body.slice(0, 2000) : null
    return {
      targetType,
      targetId,
      label: row ? 'Direct message' : 'Direct message (not found)',
      excerpt,
      href: null,
      scopeType: 'platform',
      scopeName: null,
      capturedAt: new Date().toISOString(),
    }
  }

  if (targetType === 'org_chat_message') {
    const [row] = await db
      .select({ body: schema.orgChannelMessages.body })
      .from(schema.orgChannelMessages)
      .where(eq(schema.orgChannelMessages.id, targetId))
      .limit(1)
    const legacyType = toLegacyContextTargetType(targetType)
    const ctx = await resolveModerationReportContext(legacyType, targetId)
    const excerpt = row?.body ? row.body.slice(0, 2000) : ctx.excerpt
    return {
      targetType,
      targetId,
      label: ctx.targetLabel,
      excerpt,
      href: ctx.href,
      scopeType: ctx.scopeType === 'unknown' ? null : ctx.scopeType,
      scopeName: ctx.scopeName,
      capturedAt: new Date().toISOString(),
    }
  }

  if (targetType === 'convention_chat_message') {
    const [row] = await db
      .select({ body: schema.conventionHubChannelMessages.body })
      .from(schema.conventionHubChannelMessages)
      .where(eq(schema.conventionHubChannelMessages.id, targetId))
      .limit(1)
    const legacyType = toLegacyContextTargetType(targetType)
    const ctx = await resolveModerationReportContext(legacyType, targetId)
    const excerpt = row?.body ? row.body.slice(0, 2000) : ctx.excerpt
    return {
      targetType,
      targetId,
      label: ctx.targetLabel,
      excerpt,
      href: ctx.href,
      scopeType: ctx.scopeType === 'unknown' ? null : ctx.scopeType,
      scopeName: ctx.scopeName,
      capturedAt: new Date().toISOString(),
    }
  }

  const legacyType = toLegacyContextTargetType(targetType)
  const ctx = await resolveModerationReportContext(legacyType, targetId)
  return {
    targetType,
    targetId,
    label: ctx.targetLabel,
    excerpt: ctx.excerpt,
    href: ctx.href,
    scopeType: ctx.scopeType === 'unknown' ? null : ctx.scopeType,
    scopeName: ctx.scopeName,
    capturedAt: new Date().toISOString(),
  }
}

async function resolveTargetUserId(
  targetType: ModerationReportTargetType,
  targetId: string
): Promise<string | null> {
  switch (targetType) {
    case 'profile':
      return targetId
    case 'profile_photo': {
      const [row] = await db
        .select({ profileId: schema.profilePhotos.profileId })
        .from(schema.profilePhotos)
        .where(eq(schema.profilePhotos.id, targetId))
        .limit(1)
      return row?.profileId ?? null
    }
    case 'post': {
      const [row] = await db
        .select({ authorId: schema.feedPosts.authorId })
        .from(schema.feedPosts)
        .where(eq(schema.feedPosts.id, targetId))
        .limit(1)
      return row?.authorId ?? null
    }
    case 'comment': {
      const [feedComment] = await db
        .select({ authorId: schema.feedPostComments.authorId })
        .from(schema.feedPostComments)
        .where(eq(schema.feedPostComments.id, targetId))
        .limit(1)
      if (feedComment) return feedComment.authorId
      const [forumPost] = await db
        .select({ authorId: schema.forumPosts.authorId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, targetId))
        .limit(1)
      return forumPost?.authorId ?? null
    }
    case 'group_reply':
    case 'org_forum_reply': {
      const [row] = await db
        .select({ authorId: schema.forumPosts.authorId })
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, targetId))
        .limit(1)
      return row?.authorId ?? null
    }
    case 'message': {
      const [row] = await db
        .select({ senderId: schema.messages.senderId })
        .from(schema.messages)
        .where(eq(schema.messages.id, targetId))
        .limit(1)
      return row?.senderId ?? null
    }
    case 'org_chat_message': {
      const [row] = await db
        .select({ senderId: schema.orgChannelMessages.senderId })
        .from(schema.orgChannelMessages)
        .where(eq(schema.orgChannelMessages.id, targetId))
        .limit(1)
      return row?.senderId ?? null
    }
    case 'presenter':
      return targetId
    case 'vendor': {
      const [row] = await db
        .select({ userId: schema.vendorProfiles.userId })
        .from(schema.vendorProfiles)
        .where(eq(schema.vendorProfiles.id, targetId))
        .limit(1)
      return row?.userId ?? null
    }
    case 'media_asset': {
      const [row] = await db
        .select({ uploaderUserId: schema.mediaAssets.uploaderUserId })
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, targetId))
        .limit(1)
      return row?.uploaderUserId ?? null
    }
    default:
      return null
  }
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

function legacyCategoryForPolicyReason(reason: PolicyReason): string {
  switch (reason) {
    case POLICY_REASONS.harassmentThreats:
    case POLICY_REASONS.doxxingOuting:
      return LEGACY_REPORT_CATEGORIES.harassment
    case POLICY_REASONS.spamScam:
      return LEGACY_REPORT_CATEGORIES.spam
    case POLICY_REASONS.impersonation:
      return LEGACY_REPORT_CATEGORIES.impersonation
    case POLICY_REASONS.explicitVisibilityViolation:
      return LEGACY_REPORT_CATEGORIES.content
    case POLICY_REASONS.minorSafety:
    case POLICY_REASONS.consentSafety:
      return LEGACY_REPORT_CATEGORIES.safety
    case POLICY_REASONS.csamSuspected:
    case POLICY_REASONS.ncii:
    case POLICY_REASONS.aiDeepfakeNcii:
    case POLICY_REASONS.hiddenCameraLeaked:
    case POLICY_REASONS.traffickingCoercion:
    case POLICY_REASONS.commercialSexSolicitation:
    case POLICY_REASONS.illegalGoodsServices:
      return LEGACY_REPORT_CATEGORIES.illegal
    default:
      return LEGACY_REPORT_CATEGORIES.other
  }
}

async function listOrgModeratorUserIds(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: schema.organizationMembers.userId })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, orgId),
        inArray(schema.organizationMembers.role, ['MODERATOR', 'ADMIN', 'OWNER'])
      )
    )
  return rows.map((r) => r.userId)
}

async function enqueueP0ReportNotify(
  caseId: string,
  policyReason: PolicyReason,
  queue: string
): Promise<void> {
  try {
    await getModerationQueue().add('p0_report_notify', { caseId, policyReason, queue })
  } catch {
    // Queue unavailable (Redis down / worker not configured): still attempt inline notify.
    try {
      await notifyP0ModerationCaseCreated(caseId, policyReason, queue)
    } catch {
      // Intake must succeed even if notify fails — case row already exists for human triage.
    }
  }
}

async function mirrorReportToLegacyInbox(input: {
  reporterId: string
  targetType: ModerationReportTargetType
  targetId: string
  policyReason: PolicyReason
  note?: string | null
  caseId: string
  reportId: string
  queue: string
}): Promise<void> {
  const legacyType = toLegacyContextTargetType(input.targetType)
  const scope = await resolveReportScope(legacyType, input.targetId)
  const scopedInboxTypes = new Set(['organization', 'group', 'event', 'convention'])

  if (!scope.scopeType || scope.scopeType === 'platform' || !scopedInboxTypes.has(scope.scopeType)) {
    if (isP0PolicyReason(input.policyReason)) {
      await enqueueP0ReportNotify(input.caseId, input.policyReason, input.queue)
    }
    return
  }

  const [legacyReport] = await db
    .insert(schema.reports)
    .values({
      reporterId: input.reporterId,
      targetType: legacyType,
      targetId: input.targetId,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      category: legacyCategoryForPolicyReason(input.policyReason),
      body: input.note ?? null,
      meta: { caseId: input.caseId, reportId: input.reportId },
    })
    .returning()

  if (scope.scopeType === 'organization' && !isP0PolicyReason(input.policyReason) && scope.scopeId) {
    const [org] = await db
      .select({ slug: schema.organizations.slug })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, scope.scopeId))
      .limit(1)
    if (org) {
      const modIds = await listOrgModeratorUserIds(scope.scopeId)
      if (modIds.length > 0) {
        await notifyOrgModerationNeeded(scope.scopeId, org.slug, modIds, legacyReport.id)
      }
    }
  }

  if (isP0PolicyReason(input.policyReason)) {
    await enqueueP0ReportNotify(input.caseId, input.policyReason, input.queue)
  }
}

export type CreateReportInput = {
  reporterId: string
  targetType: string
  targetId: string
  policyReason: PolicyReason
  note?: string | null
}

export type CreateReportResult = {
  caseId: string
  reportId: string
  queue: string
  severity: string
  status: string
  duplicate: boolean
}

async function findDuplicateReport(
  reporterId: string,
  targetType: ModerationReportTargetType,
  targetId: string,
  policyReason: PolicyReason
): Promise<{ caseId: string; reportId: string } | null> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS)
  const rows = await db
    .select({
      reportId: schema.moderationReports.id,
      caseId: schema.moderationReports.caseId,
    })
    .from(schema.moderationReports)
    .innerJoin(schema.moderationCases, eq(schema.moderationReports.caseId, schema.moderationCases.id))
    .where(
      and(
        eq(schema.moderationReports.reporterId, reporterId),
        eq(schema.moderationCases.targetContentType, targetType),
        eq(schema.moderationCases.targetContentId, targetId),
        eq(schema.moderationCases.policyReason, policyReason),
        gte(schema.moderationReports.createdAt, since)
      )
    )
    .orderBy(desc(schema.moderationReports.createdAt))
    .limit(1)

  const hit = rows[0]
  if (!hit) return null
  return { caseId: hit.caseId, reportId: hit.reportId }
}

export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  const validated = await validateModerationReportTarget(input.targetType, input.targetId)
  if (!validated.ok) {
    throw new ReportTargetValidationError(validated.error)
  }

  const { targetType, targetId } = validated
  const severity = severityForPolicyReason(input.policyReason)
  const queue = queueForPolicyReason(input.policyReason)

  const duplicate = await findDuplicateReport(
    input.reporterId,
    targetType,
    targetId,
    input.policyReason
  )
  if (duplicate) {
    const [existingCase] = await db
      .select({
        queue: schema.moderationCases.queue,
        severity: schema.moderationCases.severity,
        status: schema.moderationCases.status,
      })
      .from(schema.moderationCases)
      .where(eq(schema.moderationCases.id, duplicate.caseId))
      .limit(1)
    return {
      caseId: duplicate.caseId,
      reportId: duplicate.reportId,
      queue: existingCase?.queue ?? queue,
      severity: existingCase?.severity ?? severity,
      status: existingCase?.status ?? MODERATION_CASE_STATUSES.open,
      duplicate: true,
    }
  }

  const targetUserId = await resolveTargetUserId(targetType, targetId)
  const snapshot = await buildContentSnapshot(targetType, targetId)

  const [caseRow] = await db
    .insert(schema.moderationCases)
    .values({
      targetContentType: targetType,
      targetContentId: targetId,
      targetUserId,
      policyReason: input.policyReason,
      severity,
      queue,
      status: MODERATION_CASE_STATUSES.open,
    })
    .returning()

  const [reportRow] = await db
    .insert(schema.moderationReports)
    .values({
      caseId: caseRow.id,
      reporterId: input.reporterId,
      policyReason: input.policyReason,
      body: input.note ?? null,
    })
    .returning()

  await db.insert(schema.moderationQueueItems).values({
    caseId: caseRow.id,
    queue,
    severity,
    status: 'OPEN',
  })

  await db.insert(schema.contentSnapshots).values({
    caseId: caseRow.id,
    targetContentType: targetType,
    targetContentId: targetId,
    snapshot,
  })

  // Post-moderation: reported media is hidden immediately (QUARANTINED) and
  // linked to the case for human review. Duplicates already returned above.
  if (targetType === 'media_asset' || targetType === 'profile_photo') {
    const { hideMediaAssetOnReport, resolveMediaAssetIdFromCase } = await import(
      './media-mod-actions.js'
    )
    const mediaAssetId =
      targetType === 'media_asset' ? targetId : await resolveMediaAssetIdFromCase(targetType, targetId)
    if (mediaAssetId) {
      await db
        .update(schema.mediaAssets)
        .set({ moderationCaseId: caseRow.id, updatedAt: new Date() })
        .where(eq(schema.mediaAssets.id, mediaAssetId))
      await hideMediaAssetOnReport(mediaAssetId)
    }
  }

  await db.insert(schema.moderationEvents).values({
    caseId: caseRow.id,
    actorUserId: input.reporterId,
    eventType: 'report.created',
    payload: {
      reportId: reportRow.id,
      targetType,
      targetId,
      policyReason: input.policyReason,
      queue,
      severity,
    },
  })

  await mirrorReportToLegacyInbox({
    reporterId: input.reporterId,
    targetType,
    targetId,
    policyReason: input.policyReason,
    note: input.note,
    caseId: caseRow.id,
    reportId: reportRow.id,
    queue,
  })

  try {
    const { attachReportToIncident } = await import('./incident-clustering.js')
    await attachReportToIncident({
      caseId: caseRow.id,
      moderationReportId: reportRow.id,
      reporterId: input.reporterId,
      targetUserId,
      policyReason: input.policyReason,
      targetType,
      targetId,
      note: input.note,
    })
  } catch {
    // Incident clustering tables may be missing mid-migration. Case + report already
    // committed; do not fail intake. Remove this swallow once incidents are required.
  }

  return {
    caseId: caseRow.id,
    reportId: reportRow.id,
    queue,
    severity,
    status: caseRow.status,
    duplicate: false,
  }
}

export class ReportTargetValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportTargetValidationError'
  }
}

export type ReporterReportListItem = {
  reportId: string
  caseId: string
  targetType: string
  targetId: string
  policyReason: string
  status: string
  queue: string
  createdAt: Date
}

export async function listReporterModerationReports(
  reporterId: string,
  limit = 50
): Promise<ReporterReportListItem[]> {
  const capped = Math.min(Math.max(limit, 1), 100)

  return db
    .select({
      reportId: schema.moderationReports.id,
      caseId: schema.moderationReports.caseId,
      targetType: schema.moderationCases.targetContentType,
      targetId: schema.moderationCases.targetContentId,
      policyReason: schema.moderationReports.policyReason,
      status: schema.moderationCases.status,
      queue: schema.moderationCases.queue,
      createdAt: schema.moderationReports.createdAt,
    })
    .from(schema.moderationReports)
    .innerJoin(schema.moderationCases, eq(schema.moderationReports.caseId, schema.moderationCases.id))
    .where(eq(schema.moderationReports.reporterId, reporterId))
    .orderBy(desc(schema.moderationReports.createdAt))
    .limit(capped)
}
