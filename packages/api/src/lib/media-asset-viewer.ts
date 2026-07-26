import {
  ADULT_CONTENT_PREFERENCES,
  MEDIA_VISIBILITIES,
  type MediaVisibility,
} from '@c2k/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { MediaAsset } from '../db/schema.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { getAdultContentPreference } from './adult-content-preference.js'
import { getMediaAssetById, mediaAssetToPhotoDto } from './media-asset-service.js'
import {
  canExposePublicUrl,
  mediaContentProxyPath,
  resolveMediaPublicUrl,
  resolveMediaServingKey,
} from './media-pipeline.js'
import { viewerCanAccessScopedMediaItem } from './media-scoped-visibility.js'
import {
  passesMediaRatingAndStatusGate,
  isMediaPublished,
  shouldBlurMediaForViewer,
} from './media-visibility.js'
import { assetHasMalwareBlock } from './media-mod-actions.js'
import { getObjectBuffer, getS3Client } from './s3-upload.js'

const COMMUNITY_SCOPED_VISIBILITIES = new Set<MediaVisibility>([
  MEDIA_VISIBILITIES.groupOnly,
  MEDIA_VISIBILITIES.orgOnly,
  MEDIA_VISIBILITIES.eventAttendees,
  MEDIA_VISIBILITIES.conventionAttendees,
])

/**
 * Owner/relationship/community scope gate for direct asset byte serving.
 *
 * Must be paired with `passesMediaRatingAndStatusGate` (rating/status/adult-pref).
 * That helper treats every non-public, non-staff visibility as “any authenticated
 * viewer”; this gate enforces WHO may access owner- and community-scoped values so
 * the asset path matches `canViewerSeeMediaItem`.
 *
 * Note: persisted visibility `FOLLOWERS` is gated by **accepted connections**
 * (`loadAcceptedFriendUserIds`), not the one-way follow graph — keep both paths aligned.
 * Fails closed when a scoped asset carries no resolvable scope.
 */
async function viewerPassesAssetScopeGate(
  asset: Pick<MediaAsset, 'id' | 'uploaderUserId' | 'ownerType' | 'ownerId'>,
  visibility: MediaVisibility,
  viewerUserId: string | null,
  isStaff?: boolean,
): Promise<boolean> {
  if (isStaff === true) return true
  if (viewerUserId && viewerUserId === asset.uploaderUserId) return true

  if (
    visibility === MEDIA_VISIBILITIES.publicPreview ||
    visibility === MEDIA_VISIBILITIES.loggedIn
  ) {
    // Authentication requirement already enforced by passesMediaRatingAndStatusGate.
    return true
  }
  if (visibility === MEDIA_VISIBILITIES.staffOnly) return false
  // PRIVATE_PROFILE is owner-only (matches canViewerSeeMediaItem).
  if (visibility === MEDIA_VISIBILITIES.privateProfile) return false

  if (visibility === MEDIA_VISIBILITIES.followers) {
    if (!viewerUserId || !asset.uploaderUserId) return false
    // Enum value says FOLLOWERS; runtime uses mutual accepted connections.
    const connectedUserIds = await loadAcceptedFriendUserIds(viewerUserId)
    return connectedUserIds.has(asset.uploaderUserId)
  }

  if (COMMUNITY_SCOPED_VISIBILITIES.has(visibility)) {
    if (!viewerUserId) return false
    const items = await db
      .select({
        sourceGroupId: schema.mediaItems.sourceGroupId,
        sourceEventId: schema.mediaItems.sourceEventId,
        sourceConventionId: schema.mediaItems.sourceConventionId,
      })
      .from(schema.mediaItems)
      .where(
        and(eq(schema.mediaItems.mediaAssetId, asset.id), isNull(schema.mediaItems.deletedAt)),
      )
    // No linked item: org scope can still resolve via an organization-owned
    // asset; group/event/convention scopes fail closed.
    const scopeCandidates = items.length
      ? items
      : [{ sourceGroupId: null, sourceEventId: null, sourceConventionId: null }]
    for (const candidate of scopeCandidates) {
      if (await viewerCanAccessScopedMediaItem({ ...candidate, visibility }, asset, viewerUserId)) {
        return true
      }
    }
    return false
  }

  // Unknown/future visibility values fail closed.
  return false
}

export async function getMediaAssetForViewer(
  mediaAssetId: string,
  viewer: { userId: string | null; adultContentPref?: 'SHOW' | 'BLUR' | 'HIDE'; isStaff?: boolean }
) {
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) return null

  const dto = mediaAssetToPhotoDto(asset)
  const isOwner = viewer.userId === asset.uploaderUserId
  if (!isOwner && asset.removedAt) return null

  const adultContentPref =
    viewer.adultContentPref ??
    (viewer.userId ? await loadViewerAdultContentPref(viewer.userId) : ADULT_CONTENT_PREFERENCES.blur)

  if (!dto.contentRating || !dto.visibility || !dto.uploadStatus) {
    if (!isOwner) return null
    return {
      id: asset.id,
      ...dto,
      blurred: true,
    }
  }

  const visibilityMedia = {
    contentRating: dto.contentRating,
    visibility: dto.visibility,
    uploadStatus: dto.uploadStatus,
    isBlurredByDefault: dto.isBlurredByDefault,
  }

  const visibilityViewer = {
    authenticated: Boolean(viewer.userId),
    adultContentPref,
    isStaff: viewer.isStaff,
  }

  if (!isOwner && !passesMediaRatingAndStatusGate(visibilityViewer, visibilityMedia)) {
    return null
  }

  // Launch-hardening PR 3 (M1): scoped/private visibilities additionally
  // require the owner/relationship/community gate, matching the item path.
  if (
    !isOwner &&
    !(await viewerPassesAssetScopeGate(asset, dto.visibility, viewer.userId, viewer.isStaff))
  ) {
    return null
  }

  let blur = shouldBlurMediaForViewer(visibilityViewer, visibilityMedia)
  if (isOwner && isMediaPublished(dto.uploadStatus)) {
    blur = false
  }

  const publicUrl = canExposePublicUrl(asset) ? resolveMediaPublicUrl(asset) : null
  let resolvedUrl: string | null = null
  if (!blur) {
    resolvedUrl = publicUrl ?? mediaContentProxyPath(asset.id)
  }

  return {
    id: asset.id,
    ...dto,
    url: resolvedUrl,
    canView: true,
    // storageKey intentionally omitted (PR 3 M6): raw S3 keys embed the
    // uploader's user UUID and internal layout; clients get the proxy url only.
    blurred: blur,
    storageState: asset.storageState,
    scanStatus: asset.scanStatus,
  }
}

export async function streamMediaAssetContent(
  mediaAssetId: string,
  viewerUserId: string | null,
  opts?: { isStaff?: boolean },
): Promise<{ body: Buffer; contentType: string } | null> {
  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) return null

  const isOwner = viewerUserId === asset.uploaderUserId
  const dto = mediaAssetToPhotoDto(asset)
  const adultPref = viewerUserId ? await loadViewerAdultContentPref(viewerUserId) : ADULT_CONTENT_PREFERENCES.blur

  const canView =
    isOwner ||
    opts?.isStaff === true ||
    Boolean(
      dto.contentRating &&
        dto.visibility &&
        dto.uploadStatus &&
        passesMediaRatingAndStatusGate(
          { authenticated: Boolean(viewerUserId), adultContentPref: adultPref, isStaff: opts?.isStaff },
          {
            contentRating: dto.contentRating,
            visibility: dto.visibility,
            uploadStatus: dto.uploadStatus,
            isBlurredByDefault: dto.isBlurredByDefault,
          },
        ) &&
        // Enforce owner/scoped access on the raw-bytes path too.
        (await viewerPassesAssetScopeGate(asset, dto.visibility, viewerUserId, opts?.isStaff)),
    )

  if (!canView) return null

  const key = resolveMediaServingKey(asset)
  if (!key || key.startsWith('http')) return null

  const client = getS3Client()
  if (!client) return null

  const obj = await getObjectBuffer(client, key, asset.storageBucket ?? undefined)
  if (!obj) return null
  return { body: obj.body, contentType: obj.contentType ?? asset.mimeType }
}

/** Platform moderator stream - bypasses member visibility; blocked when malware flagged. */
export async function streamMediaAssetForModerator(
  mediaAssetId: string
): Promise<{ body: Buffer; contentType: string } | null> {
  if (await assetHasMalwareBlock(mediaAssetId)) return null

  const asset = await getMediaAssetById(mediaAssetId)
  if (!asset) return null

  const key = resolveMediaServingKey(asset)
  if (!key || key.startsWith('http')) return null

  const client = getS3Client()
  if (!client) return null

  const obj = await getObjectBuffer(client, key, asset.storageBucket ?? undefined)
  if (!obj) return null
  return { body: obj.body, contentType: obj.contentType ?? asset.mimeType }
}

export async function loadViewerAdultContentPref(userId: string | null): Promise<'SHOW' | 'BLUR' | 'HIDE'> {
  if (!userId) return ADULT_CONTENT_PREFERENCES.blur
  return getAdultContentPreference(userId)
}
