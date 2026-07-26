import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import {
  MEDIA_VISIBILITIES,
  MAX_MEDIA_ITEM_TAGS,
  MAX_MEDIA_PEOPLE_TAGS,
  depictedPeopleSchema,
  mediaCommentPolicySchema,
  mediaContentRatingSchema,
  mediaKindSchema,
  mediaVisibilitySchema,
  normalizePrivacySettings,
  type MediaCommentPolicy,
  type MediaKind,
  type MediaVisibility,
} from '@c2k/shared'
import { db, schema } from '../db/index.js'
import type { MediaAsset, MediaItem } from '../db/schema.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { ensureProfileForUserId } from './ensure-profile.js'
import {
  createMediaAssetForUpload,
  getMediaAssetById,
  mediaAssetToPhotoDto,
  submitMediaAttestation,
  assertMediaAssetUploader,
  MediaAssetAccessError,
  MediaAssetNotFoundError,
  type SubmitMediaAttestationInput,
} from './media-asset-service.js'
import { getMediaAssetForViewer, loadViewerAdultContentPref } from './media-asset-viewer.js'
import { deliverBlurPreviewUrl, deliverFeedImageUrl } from './image-delivery.js'
import { assertQuarantineStorageKeyOwnedByUser, mediaContentProxyPath, MediaUploadValidationError } from './media-pipeline.js'
import { autoPublishProfileGalleryPhoto } from './profile-photo-policy.js'
import { emitActivity } from './feed-activities.js'
import { passesMediaRatingAndStatusGate } from './media-visibility.js'
import { viewerCanAccessScopedMediaItem } from './media-scoped-visibility.js'
import { ensureUserSettingsRow } from './user-settings-row.js'
import {
  assertPersonalPhotoQuotaRoom,
  PersonalPhotoQuotaError,
} from './personal-photo-quota.js'

async function loadUserPrivacySettings(userId: string) {
  const row = await ensureUserSettingsRow(userId)
  return normalizePrivacySettings(row.privacySettings)
}

const DEFAULT_ALBUMS = [
  { kind: 'default_all' as const, title: 'All Pictures', slug: 'all-pictures', sortOrder: 0 },
  { kind: 'profile_pictures' as const, title: 'Profile Pictures', slug: 'profile-pictures', sortOrder: 1 },
  { kind: 'uploaded_pictures' as const, title: 'Uploaded Pictures', slug: 'uploaded-pictures', sortOrder: 2 },
  { kind: 'tagged_pictures' as const, title: 'Tagged Pictures', slug: 'tagged-pictures', sortOrder: 3 },
] as const

export class MediaSocialError extends Error {
  constructor(
    message: string,
    readonly code = 'media_social_error',
  ) {
    super(message)
    this.name = 'MediaSocialError'
  }
}

export async function ensureDefaultAlbumsForUser(userId: string): Promise<void> {
  const existing = await db
    .select({ slug: schema.mediaAlbums.slug })
    .from(schema.mediaAlbums)
    .where(and(eq(schema.mediaAlbums.ownerUserId, userId), isNull(schema.mediaAlbums.deletedAt)))

  const have = new Set(existing.map((r) => r.slug))
  const toInsert = DEFAULT_ALBUMS.filter((a) => !have.has(a.slug))
  if (!toInsert.length) return

  await db.insert(schema.mediaAlbums).values(
    toInsert.map((a) => ({
      ownerUserId: userId,
      title: a.title,
      slug: a.slug,
      albumKind: a.kind,
      sortOrder: a.sortOrder,
      visibility: MEDIA_VISIBILITIES.loggedIn,
    })),
  )
}

async function resolveOwnerProfileId(userId: string): Promise<string> {
  const profile = await ensureProfileForUserId(userId)
  return profile.id
}

async function viewerIsConnected(viewerId: string | null, ownerId: string): Promise<boolean> {
  if (!viewerId || viewerId === ownerId) return viewerId === ownerId
  const friends = await loadAcceptedFriendUserIds(viewerId)
  return friends.has(ownerId)
}

/**
 * Full media-item ACL: rating/status gate + owner/relationship/community scope.
 * Pair with asset-byte serving via `getMediaAssetForViewer` / `viewerPassesAssetScopeGate`.
 */
export async function canViewerSeeMediaItem(
  item: MediaItem,
  asset: MediaAsset,
  viewerUserId: string | null,
  opts?: { isStaff?: boolean },
): Promise<boolean> {
  if (item.deletedAt) {
    return viewerUserId === item.ownerUserId || opts?.isStaff === true
  }
  if (viewerUserId === item.ownerUserId) return true

  const dto = mediaAssetToPhotoDto(asset)
  if (!dto.contentRating || !dto.visibility || !dto.uploadStatus) return false

  const adultContentPref = viewerUserId
    ? await loadViewerAdultContentPref(viewerUserId)
    : 'BLUR'

  const visibilityOk = passesMediaRatingAndStatusGate(
    { authenticated: Boolean(viewerUserId), adultContentPref, isStaff: opts?.isStaff },
    {
      contentRating: dto.contentRating,
      visibility: item.visibility as MediaVisibility,
      uploadStatus: dto.uploadStatus,
      isBlurredByDefault: item.isBlurredByDefault || dto.isBlurredByDefault,
    },
  )
  if (!visibilityOk) return false

  if (item.visibility === MEDIA_VISIBILITIES.followers) {
    // Persisted enum is FOLLOWERS; gate is accepted connections (same as asset scope).
    return viewerIsConnected(viewerUserId, item.ownerUserId)
  }
  if (item.visibility === MEDIA_VISIBILITIES.privateProfile) {
    return false
  }
  if (item.visibility === MEDIA_VISIBILITIES.staffOnly) {
    return opts?.isStaff === true
  }
  return viewerCanAccessScopedMediaItem(item, asset, viewerUserId)
}

export async function shapeMediaItemPreview(
  item: MediaItem,
  asset: MediaAsset,
  viewerUserId: string | null,
  opts?: { isStaff?: boolean },
) {
  const canSee = await canViewerSeeMediaItem(item, asset, viewerUserId, opts)
  if (!canSee) return null

  const viewed = await getMediaAssetForViewer(asset.id, {
    userId: viewerUserId,
    isStaff: opts?.isStaff,
  })
  const previewUrl =
    viewed && 'url' in viewed && viewed.url
      ? viewed.url
      : viewed?.blurred
        ? mediaContentProxyPath(asset.id)
        : null
  const tags = await db
    .select({ tag: schema.mediaItemTags.tag })
    .from(schema.mediaItemTags)
    .where(eq(schema.mediaItemTags.mediaItemId, item.id))

  const isAudio = item.mediaKind === 'audio'
  const clearPreview =
    viewed?.blurred ? null
    : isAudio ? previewUrl
    : deliverFeedImageUrl(previewUrl)
  const blurredPreview =
    viewed?.blurred && !isAudio ?
      deliverBlurPreviewUrl(previewUrl ?? mediaContentProxyPath(asset.id))
    : null

  return {
    id: item.id,
    mediaKind: item.mediaKind as MediaKind,
    caption: item.caption,
    visibility: item.visibility,
    commentPolicy: item.commentPolicy,
    pinnedToProfile: item.pinnedToProfile,
    previewUrl: clearPreview,
    blurredPreviewUrl: blurredPreview,
    isBlurredByDefault: viewed?.blurred ?? item.isBlurredByDefault,
    contentRating: item.contentRating ?? asset.contentRating,
    width: asset.imageWidth ?? asset.videoWidth,
    height: asset.imageHeight ?? asset.videoHeight,
    durationSeconds: asset.durationSeconds,
    createdAt: item.createdAt.toISOString(),
    tags: tags.map((t) => t.tag),
  }
}

export type CreateMediaUploadInput = {
  userId: string
  caption?: string
  items: Array<{
    mediaAssetId?: string
    quarantineKey?: string
    mediaKind: MediaKind
    originalFilename?: string
    mimeType: string
    sizeBytes: number
    imageWidth?: number
    imageHeight?: number
    videoWidth?: number
    videoHeight?: number
    durationSeconds?: number
    caption?: string
  }>
  peopleTags?: Array<{ userId: string; x?: number; y?: number; label?: string }>
  albumIds?: string[]
  tags?: string[]
  visibility: MediaVisibility
  commentPolicy: MediaCommentPolicy
  postToFeed: boolean
  useAsAvatar?: boolean
  pinnedToProfile?: boolean
  attestation: Omit<SubmitMediaAttestationInput, 'mediaAssetId' | 'userId' | 'depictedPeople'> & {
    depictedPeople: string
  }
  sourceSurface?: string
}

export async function createMediaUpload(input: CreateMediaUploadInput) {
  if (!input.items.length) throw new MediaSocialError('At least one media item is required')
  if (input.useAsAvatar && (input.items.length !== 1 || input.items[0]!.mediaKind !== 'image')) {
    throw new MediaSocialError('Use as avatar requires exactly one image')
  }
  if ((input.tags?.length ?? 0) > MAX_MEDIA_ITEM_TAGS) {
    throw new MediaSocialError(`Maximum ${MAX_MEDIA_ITEM_TAGS} tags allowed`)
  }
  if ((input.peopleTags?.length ?? 0) > MAX_MEDIA_PEOPLE_TAGS) {
    throw new MediaSocialError(`Maximum ${MAX_MEDIA_PEOPLE_TAGS} people tags allowed`)
  }
  if (
    input.postToFeed &&
    (input.visibility === MEDIA_VISIBILITIES.privateProfile ||
      input.visibility === MEDIA_VISIBILITIES.staffOnly)
  ) {
    throw new MediaSocialError('Private media cannot be posted to feed')
  }

  const newImageCount = input.items.filter((item) => item.mediaKind === 'image' && !item.mediaAssetId).length
  if (newImageCount > 0) {
    await assertPersonalPhotoQuotaRoom(input.userId, newImageCount)
  }

  const profileId = await resolveOwnerProfileId(input.userId)
  await ensureDefaultAlbumsForUser(input.userId)

  const sourceSurface = input.sourceSurface ?? 'profile_media'
  const createdItemIds: string[] = []
  const feedAttachments: Array<Record<string, unknown>> = []

  for (const rawItem of input.items) {
    let mediaAssetId = rawItem.mediaAssetId
    if (!mediaAssetId) {
      if (!rawItem.quarantineKey) throw new MediaSocialError('mediaAssetId or quarantineKey required')
      try {
        assertQuarantineStorageKeyOwnedByUser(input.userId, rawItem.quarantineKey)
      } catch (err) {
        if (err instanceof MediaUploadValidationError) {
          throw new MediaSocialError(err.message, 'invalid_upload_reference')
        }
        throw err
      }
      mediaAssetId = await createMediaAssetForUpload({
        userId: input.userId,
        ownerType: 'profile',
        ownerId: profileId,
        sourceSurface,
        quarantineKey: rawItem.quarantineKey,
        mimeType: rawItem.mimeType,
        sizeBytes: rawItem.sizeBytes,
        originalFilename: rawItem.originalFilename,
        imageWidth: rawItem.imageWidth,
        imageHeight: rawItem.imageHeight,
        videoWidth: rawItem.videoWidth,
        videoHeight: rawItem.videoHeight,
        durationSeconds: rawItem.durationSeconds,
      })
    } else {
      try {
        await assertMediaAssetUploader(input.userId, mediaAssetId)
      } catch (err) {
        if (err instanceof MediaAssetNotFoundError) {
          throw new MediaSocialError('Media asset not found', 'media_asset_not_found')
        }
        if (err instanceof MediaAssetAccessError) {
          throw new MediaSocialError('Forbidden', 'media_asset_forbidden')
        }
        throw err
      }
    }

    await submitMediaAttestation({
      mediaAssetId,
      userId: input.userId,
      contentRating: input.attestation.contentRating,
      depictedPeople: depictedPeopleSchema.parse(input.attestation.depictedPeople),
      visibility: input.attestation.visibility,
      uploaderConfirmed18: input.attestation.uploaderConfirmed18,
      uploaderConfirmedDepictedAdults18: input.attestation.uploaderConfirmedDepictedAdults18,
      uploaderConfirmedConsent: input.attestation.uploaderConfirmedConsent,
      uploaderConfirmedRightToUpload: input.attestation.uploaderConfirmedRightToUpload,
      uploaderConfirmedNoNcii: input.attestation.uploaderConfirmedNoNcii,
      uploaderConfirmedNoMinors: input.attestation.uploaderConfirmedNoMinors,
      uploaderConfirmedNoHiddenCamera: input.attestation.uploaderConfirmedNoHiddenCamera,
      uploaderConfirmedNoAiDeepfakeWithoutConsent:
        input.attestation.uploaderConfirmedNoAiDeepfakeWithoutConsent,
    })

    if (
      sourceSurface === 'profile_photo' ||
      sourceSurface === 'profile_gallery' ||
      sourceSurface === 'feed_upload'
    ) {
      await autoPublishProfileGalleryPhoto({ mediaAssetId, userId: input.userId })
    }

    const asset = (await getMediaAssetById(mediaAssetId))!
    const now = new Date()
    const [itemRow] = await db
      .insert(schema.mediaItems)
      .values({
        ownerUserId: input.userId,
        mediaAssetId,
        mediaKind: rawItem.mediaKind,
        caption: rawItem.caption ?? input.caption ?? null,
        visibility: input.visibility,
        commentPolicy: input.commentPolicy,
        showInFeed: input.postToFeed,
        pinnedToProfile: input.pinnedToProfile ?? false,
        useAsAvatar: input.useAsAvatar ?? false,
        contentRating: input.attestation.contentRating,
        sourceSurface,
        updatedAt: now,
      })
      .returning()

    createdItemIds.push(itemRow!.id)

    const preview = await shapeMediaItemPreview(itemRow!, asset, input.userId)
    feedAttachments.push({
      type: 'media',
      mediaKind: rawItem.mediaKind,
      mediaItemId: itemRow!.id,
      mediaAssetId,
      previewUrl: preview?.previewUrl ?? mediaContentProxyPath(mediaAssetId),
      blurredPreviewUrl: preview?.blurredPreviewUrl ?? null,
      width: asset.imageWidth ?? asset.videoWidth,
      height: asset.imageHeight ?? asset.videoHeight,
      durationSeconds: asset.durationSeconds,
      isBlurredByDefault: preview?.isBlurredByDefault ?? false,
      contentRating: input.attestation.contentRating,
      visibility: input.visibility,
    })
  }

  const now = new Date()
  const [mediaPost] = await db
    .insert(schema.mediaPosts)
    .values({
      ownerUserId: input.userId,
      caption: input.caption ?? null,
      visibility: input.visibility,
      commentPolicy: input.commentPolicy,
      showInFeed: input.postToFeed,
      updatedAt: now,
    })
    .returning()

  await db.insert(schema.mediaPostItems).values(
    createdItemIds.map((mediaItemId, sortOrder) => ({
      mediaPostId: mediaPost!.id,
      mediaItemId,
      sortOrder,
    })),
  )

  if (input.tags?.length) {
    for (const mediaItemId of createdItemIds) {
      await db.insert(schema.mediaItemTags).values(
        input.tags.slice(0, MAX_MEDIA_ITEM_TAGS).map((tag) => ({
          mediaItemId,
          tag: tag.trim().slice(0, 64),
        })),
      )
    }
  }

  if (input.peopleTags?.length) {
    const privacy = await loadUserPrivacySettings(input.userId)
    for (const mediaItemId of createdItemIds) {
      for (const pt of input.peopleTags) {
        const autoApprove = privacy.mediaSettings.allowPeopleToTagMe === 'yes'
        const blocked = privacy.mediaSettings.allowPeopleToTagMe === 'no'
        if (blocked && pt.userId !== input.userId) continue
        await db.insert(schema.mediaPeopleTags).values({
          mediaItemId,
          taggedUserId: pt.userId,
          taggedByUserId: input.userId,
          status: autoApprove || pt.userId === input.userId ? 'approved' : 'pending',
          x: pt.x ?? null,
          y: pt.y ?? null,
          label: pt.label ?? null,
          updatedAt: now,
        })
      }
    }
  }

  const albumIds = input.albumIds ?? []
  const defaultAlbums = await db
    .select()
    .from(schema.mediaAlbums)
    .where(and(eq(schema.mediaAlbums.ownerUserId, input.userId), isNull(schema.mediaAlbums.deletedAt)))

  const uploadedAlbum = defaultAlbums.find((a) => a.albumKind === 'uploaded_pictures')
  const allAlbum = defaultAlbums.find((a) => a.albumKind === 'default_all')
  const targetAlbumIds = new Set(albumIds)
  if (uploadedAlbum) targetAlbumIds.add(uploadedAlbum.id)
  if (allAlbum) targetAlbumIds.add(allAlbum.id)

  for (const albumId of targetAlbumIds) {
    for (let i = 0; i < createdItemIds.length; i++) {
      await db
        .insert(schema.mediaAlbumItems)
        .values({ albumId, mediaItemId: createdItemIds[i]!, sortOrder: i })
        .onConflictDoNothing()
    }
  }

  let feedPostId: string | null = null
  if (input.postToFeed) {
    const [feedPost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: input.userId,
        kind: 'status',
        body: input.caption?.trim() ?? '',
        bodyFormat: 'text',
        attachments: feedAttachments,
        updatedAt: now,
      })
      .returning({ id: schema.feedPosts.id })
    feedPostId = feedPost!.id

    await db
      .update(schema.mediaPosts)
      .set({ feedPostId, updatedAt: now })
      .where(eq(schema.mediaPosts.id, mediaPost!.id))

    await db
      .update(schema.mediaItems)
      .set({ originalFeedPostId: feedPostId, updatedAt: now })
      .where(inArray(schema.mediaItems.id, createdItemIds))

    const privacy = await loadUserPrivacySettings(input.userId)
    if (privacy.mediaSettings.includeMediaUploadsInActivityFeed) {
      const verb =
        input.items.length === 1 && input.items[0]!.mediaKind === 'video'
          ? 'uploaded_video'
          : input.items.length === 1
            ? 'uploaded_picture'
            : 'uploaded_media'
      emitActivity({
        actorId: input.userId,
        verb,
        objectType: 'media_post',
        objectId: mediaPost!.id,
        metadata: { feedPostId, mediaItemIds: createdItemIds, mediaKind: input.items[0]?.mediaKind },
      })
    }
  }

  if (input.useAsAvatar && createdItemIds.length === 1) {
    await syncMediaItemAsAvatar(input.userId, profileId, createdItemIds[0]!)
  }

  return {
    mediaPostId: mediaPost!.id,
    feedPostId,
    mediaItemIds: createdItemIds,
    items: await Promise.all(
      createdItemIds.map(async (id) => {
        const [item] = await db.select().from(schema.mediaItems).where(eq(schema.mediaItems.id, id)).limit(1)
        const asset = await getMediaAssetById(item!.mediaAssetId)
        return shapeMediaItemPreview(item!, asset!, input.userId)
      }),
    ),
  }
}

export async function syncMediaItemAsAvatar(userId: string, profileId: string, mediaItemId: string) {
  const [item] = await db
    .select()
    .from(schema.mediaItems)
    .where(and(eq(schema.mediaItems.id, mediaItemId), eq(schema.mediaItems.ownerUserId, userId)))
    .limit(1)
  if (!item || item.mediaKind !== 'image') throw new MediaSocialError('Avatar requires an owned image')

  const asset = await getMediaAssetById(item.mediaAssetId)
  if (!asset) throw new MediaSocialError('Media asset not found')

  const viewed = await getMediaAssetForViewer(asset.id, { userId })
  const url =
    viewed && 'url' in viewed && viewed.url ? viewed.url : mediaContentProxyPath(asset.id)

  const albums = await db
    .select()
    .from(schema.mediaAlbums)
    .where(and(eq(schema.mediaAlbums.ownerUserId, userId), isNull(schema.mediaAlbums.deletedAt)))
  const profileAlbum = albums.find((a) => a.albumKind === 'profile_pictures')

  await db
    .update(schema.mediaItems)
    .set({ useAsAvatar: true, updatedAt: new Date() })
    .where(eq(schema.mediaItems.id, mediaItemId))

  await db
    .update(schema.profiles)
    .set({ avatarUrl: url, updatedAt: new Date() })
    .where(eq(schema.profiles.id, profileId))

  const [existingPhoto] = await db
    .select()
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.mediaAssetId, item.mediaAssetId))
    .limit(1)

  if (!existingPhoto) {
    await db.insert(schema.profilePhotos).values({
      profileId,
      mediaAssetId: item.mediaAssetId,
      url,
      caption: item.caption,
      sortOrder: 0,
    })
  } else {
    await db
      .update(schema.profilePhotos)
      .set({ url, sortOrder: 0 })
      .where(eq(schema.profilePhotos.id, existingPhoto.id))
  }

  if (profileAlbum) {
    await db
      .insert(schema.mediaAlbumItems)
      .values({ albumId: profileAlbum.id, mediaItemId, sortOrder: 0 })
      .onConflictDoNothing()
  }

  emitActivity({
    actorId: userId,
    verb: 'avatar_updated',
    objectType: 'media_item',
    objectId: mediaItemId,
  })
}

export async function listUserMediaItems(params: {
  ownerUserId: string
  viewerUserId: string | null
  kind?: 'image' | 'video' | 'all'
  albumSlug?: string
  tagged?: boolean
  limit?: number
  cursor?: string
}) {
  const limit = Math.min(params.limit ?? 24, 48)
  const conditions = [
    eq(schema.mediaItems.ownerUserId, params.ownerUserId),
    isNull(schema.mediaItems.deletedAt),
  ]
  if (params.kind && params.kind !== 'all') {
    conditions.push(eq(schema.mediaItems.mediaKind, params.kind))
  }
  if (params.cursor) {
    conditions.push(sql`${schema.mediaItems.createdAt} < ${params.cursor}`)
  }

  let itemIds: string[] | null = null
  if (params.albumSlug) {
    const [album] = await db
      .select()
      .from(schema.mediaAlbums)
      .where(
        and(
          eq(schema.mediaAlbums.ownerUserId, params.ownerUserId),
          eq(schema.mediaAlbums.slug, params.albumSlug),
          isNull(schema.mediaAlbums.deletedAt),
        ),
      )
      .limit(1)
    if (!album) return { items: [], nextCursor: null }
    const rows = await db
      .select({ mediaItemId: schema.mediaAlbumItems.mediaItemId })
      .from(schema.mediaAlbumItems)
      .where(eq(schema.mediaAlbumItems.albumId, album.id))
      .orderBy(asc(schema.mediaAlbumItems.sortOrder))
    itemIds = rows.map((r) => r.mediaItemId)
  }

  if (params.tagged) {
    const tagRows = await db
      .select({ mediaItemId: schema.mediaPeopleTags.mediaItemId })
      .from(schema.mediaPeopleTags)
      .where(
        and(
          eq(schema.mediaPeopleTags.taggedUserId, params.ownerUserId),
          eq(schema.mediaPeopleTags.status, 'approved'),
        ),
      )
    itemIds = tagRows.map((r) => r.mediaItemId)
  }

  let rows: MediaItem[]
  if (itemIds) {
    if (!itemIds.length) return { items: [], nextCursor: null }
    rows = await db
      .select()
      .from(schema.mediaItems)
      .where(and(...conditions, inArray(schema.mediaItems.id, itemIds)))
      .orderBy(desc(schema.mediaItems.createdAt))
      .limit(limit + 1)
  } else {
    rows = await db
      .select()
      .from(schema.mediaItems)
      .where(and(...conditions))
      .orderBy(desc(schema.mediaItems.pinnedToProfile), desc(schema.mediaItems.createdAt))
      .limit(limit + 1)
  }
  const page = rows.slice(0, limit)
  const assets = await Promise.all(page.map((r) => getMediaAssetById(r.mediaAssetId)))
  const shaped = (
    await Promise.all(
      page.map((item, i) => shapeMediaItemPreview(item, assets[i]!, params.viewerUserId)),
    )
  ).filter(Boolean)

  return {
    items: shaped,
    nextCursor: rows.length > limit ? page[page.length - 1]!.createdAt.toISOString() : null,
  }
}

export async function listUserAlbums(ownerUserId: string, viewerUserId: string | null) {
  await ensureDefaultAlbumsForUser(ownerUserId)
  const rows = await db
    .select()
    .from(schema.mediaAlbums)
    .where(and(eq(schema.mediaAlbums.ownerUserId, ownerUserId), isNull(schema.mediaAlbums.deletedAt)))
    .orderBy(asc(schema.mediaAlbums.sortOrder))

  const isOwner = viewerUserId === ownerUserId
  const visible = rows.filter((a) => {
    if (isOwner) return true
    if (a.visibility === MEDIA_VISIBILITIES.privateProfile) return false
    if (a.visibility === MEDIA_VISIBILITIES.publicPreview) return true
    return Boolean(viewerUserId)
  })

  const out = await Promise.all(
    visible.map(async (album) => {
      const [countRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.mediaAlbumItems)
        .innerJoin(schema.mediaItems, eq(schema.mediaAlbumItems.mediaItemId, schema.mediaItems.id))
        .where(and(eq(schema.mediaAlbumItems.albumId, album.id), isNull(schema.mediaItems.deletedAt)))

      let coverPreviewUrl: string | null = null
      if (album.coverMediaItemId) {
        const [coverItem] = await db
          .select()
          .from(schema.mediaItems)
          .where(eq(schema.mediaItems.id, album.coverMediaItemId))
          .limit(1)
        if (coverItem) {
          const asset = await getMediaAssetById(coverItem.mediaAssetId)
          if (asset) {
            const preview = await shapeMediaItemPreview(coverItem, asset, viewerUserId)
            coverPreviewUrl = preview?.previewUrl ?? preview?.blurredPreviewUrl ?? null
          }
        }
      }

      return {
        id: album.id,
        title: album.title,
        slug: album.slug,
        description: album.description,
        visibility: album.visibility,
        albumKind: album.albumKind,
        coverPreviewUrl,
        itemCount: countRow?.n ?? 0,
        sortOrder: album.sortOrder,
      }
    }),
  )
  return out
}

export async function softDeleteMediaItem(userId: string, mediaItemId: string) {
  const now = new Date()
  await db
    .update(schema.mediaItems)
    .set({ deletedAt: now, updatedAt: now, showInFeed: false })
    .where(and(eq(schema.mediaItems.id, mediaItemId), eq(schema.mediaItems.ownerUserId, userId)))
}

export async function patchMediaItem(
  userId: string,
  mediaItemId: string,
  patch: {
    caption?: string
    visibility?: MediaVisibility
    commentPolicy?: MediaCommentPolicy
    pinnedToProfile?: boolean
    showInFeed?: boolean
    useAsAvatar?: boolean
    tags?: string[]
    albumIds?: string[]
  },
) {
  const [item] = await db
    .select()
    .from(schema.mediaItems)
    .where(and(eq(schema.mediaItems.id, mediaItemId), eq(schema.mediaItems.ownerUserId, userId)))
    .limit(1)
  if (!item || item.deletedAt) throw new MediaSocialError('Media not found')

  const now = new Date()
  const updates: Partial<typeof schema.mediaItems.$inferInsert> = { updatedAt: now }
  if (patch.caption !== undefined) updates.caption = patch.caption
  if (patch.visibility !== undefined) updates.visibility = patch.visibility
  if (patch.commentPolicy !== undefined) updates.commentPolicy = patch.commentPolicy
  if (patch.pinnedToProfile !== undefined) updates.pinnedToProfile = patch.pinnedToProfile
  if (patch.showInFeed !== undefined) updates.showInFeed = patch.showInFeed
  if (patch.useAsAvatar !== undefined) updates.useAsAvatar = patch.useAsAvatar

  if (Object.keys(updates).length > 1) {
    await db.update(schema.mediaItems).set(updates).where(eq(schema.mediaItems.id, mediaItemId))
  }

  if (patch.tags !== undefined) {
    if (patch.tags.length > MAX_MEDIA_ITEM_TAGS) {
      throw new MediaSocialError(`Maximum ${MAX_MEDIA_ITEM_TAGS} tags allowed`)
    }
    await db.delete(schema.mediaItemTags).where(eq(schema.mediaItemTags.mediaItemId, mediaItemId))
    if (patch.tags.length) {
      await db.insert(schema.mediaItemTags).values(
        patch.tags.map((tag) => ({ mediaItemId, tag: tag.trim().slice(0, 64) })),
      )
    }
  }

  if (patch.albumIds !== undefined) {
    const customAlbums = await db
      .select({ id: schema.mediaAlbums.id })
      .from(schema.mediaAlbums)
      .where(
        and(
          eq(schema.mediaAlbums.ownerUserId, userId),
          inArray(schema.mediaAlbums.id, patch.albumIds),
          eq(schema.mediaAlbums.albumKind, 'custom'),
          isNull(schema.mediaAlbums.deletedAt),
        ),
      )
    for (const album of customAlbums) {
      await db
        .insert(schema.mediaAlbumItems)
        .values({ albumId: album.id, mediaItemId, sortOrder: 0 })
        .onConflictDoNothing()
    }
  }

  if (patch.useAsAvatar === true) {
    const profile = await ensureProfileForUserId(userId)
    await syncMediaItemAsAvatar(userId, profile.id, mediaItemId)
  }

  const [updated] = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.id, mediaItemId))
    .limit(1)
  const asset = await getMediaAssetById(updated!.mediaAssetId)
  return shapeMediaItemPreview(updated!, asset!, userId)
}

export async function patchMediaAlbum(
  userId: string,
  albumId: string,
  patch: {
    title?: string
    description?: string | null
    visibility?: MediaVisibility
    coverMediaItemId?: string | null
    sortOrder?: number
  },
) {
  const [album] = await db
    .select()
    .from(schema.mediaAlbums)
    .where(
      and(
        eq(schema.mediaAlbums.id, albumId),
        eq(schema.mediaAlbums.ownerUserId, userId),
        isNull(schema.mediaAlbums.deletedAt),
      ),
    )
    .limit(1)
  if (!album) throw new MediaSocialError('Album not found')
  if (album.albumKind !== 'custom' && (patch.title || patch.description !== undefined)) {
    throw new MediaSocialError('System albums cannot be renamed')
  }

  const now = new Date()
  await db
    .update(schema.mediaAlbums)
    .set({
      title: patch.title ?? album.title,
      description: patch.description !== undefined ? patch.description : album.description,
      visibility: patch.visibility ?? album.visibility,
      coverMediaItemId:
        patch.coverMediaItemId !== undefined ? patch.coverMediaItemId : album.coverMediaItemId,
      sortOrder: patch.sortOrder ?? album.sortOrder,
      updatedAt: now,
    })
    .where(eq(schema.mediaAlbums.id, albumId))

  const [row] = await db.select().from(schema.mediaAlbums).where(eq(schema.mediaAlbums.id, albumId)).limit(1)
  return row
}

export async function softDeleteMediaAlbum(userId: string, albumId: string) {
  const [album] = await db
    .select()
    .from(schema.mediaAlbums)
    .where(
      and(
        eq(schema.mediaAlbums.id, albumId),
        eq(schema.mediaAlbums.ownerUserId, userId),
        isNull(schema.mediaAlbums.deletedAt),
      ),
    )
    .limit(1)
  if (!album) throw new MediaSocialError('Album not found')
  if (album.albumKind !== 'custom') throw new MediaSocialError('System albums cannot be deleted')

  const now = new Date()
  await db
    .update(schema.mediaAlbums)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.mediaAlbums.id, albumId))
}

export async function addMediaItemToAlbum(userId: string, albumId: string, mediaItemId: string) {
  const [album] = await db
    .select()
    .from(schema.mediaAlbums)
    .where(
      and(
        eq(schema.mediaAlbums.id, albumId),
        eq(schema.mediaAlbums.ownerUserId, userId),
        isNull(schema.mediaAlbums.deletedAt),
      ),
    )
    .limit(1)
  if (!album) throw new MediaSocialError('Album not found')

  const [item] = await db
    .select()
    .from(schema.mediaItems)
    .where(
      and(
        eq(schema.mediaItems.id, mediaItemId),
        eq(schema.mediaItems.ownerUserId, userId),
        isNull(schema.mediaItems.deletedAt),
      ),
    )
    .limit(1)
  if (!item) throw new MediaSocialError('Media not found')

  await db
    .insert(schema.mediaAlbumItems)
    .values({ albumId, mediaItemId, sortOrder: 0 })
    .onConflictDoNothing()
}

export async function removeMediaItemFromAlbum(userId: string, albumId: string, mediaItemId: string) {
  const [album] = await db
    .select({ id: schema.mediaAlbums.id })
    .from(schema.mediaAlbums)
    .where(and(eq(schema.mediaAlbums.id, albumId), eq(schema.mediaAlbums.ownerUserId, userId)))
    .limit(1)
  if (!album) throw new MediaSocialError('Album not found')

  await db
    .delete(schema.mediaAlbumItems)
    .where(
      and(
        eq(schema.mediaAlbumItems.albumId, albumId),
        eq(schema.mediaAlbumItems.mediaItemId, mediaItemId),
      ),
    )
}

export async function softDeleteMediaComment(params: {
  commentId: string
  actorUserId: string
  isModerator?: boolean
}) {
  const [comment] = await db
    .select({
      comment: schema.mediaComments,
      itemOwnerId: schema.mediaItems.ownerUserId,
    })
    .from(schema.mediaComments)
    .innerJoin(schema.mediaItems, eq(schema.mediaComments.mediaItemId, schema.mediaItems.id))
    .where(eq(schema.mediaComments.id, params.commentId))
    .limit(1)
  if (!comment || comment.comment.deletedAt) throw new MediaSocialError('Comment not found')

  const canDelete =
    params.isModerator ||
    comment.comment.authorId === params.actorUserId ||
    comment.itemOwnerId === params.actorUserId
  if (!canDelete) throw new MediaSocialError('Forbidden', 'forbidden')

  await db
    .update(schema.mediaComments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.mediaComments.id, params.commentId))
}

export async function updatePeopleTagStatus(params: {
  tagId: string
  actorUserId: string
  status: 'approved' | 'declined' | 'removed'
}) {
  const [tag] = await db
    .select()
    .from(schema.mediaPeopleTags)
    .where(eq(schema.mediaPeopleTags.id, params.tagId))
    .limit(1)
  if (!tag) throw new MediaSocialError('Tag not found')

  const isTaggedPerson = tag.taggedUserId === params.actorUserId
  const [item] = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.id, tag.mediaItemId))
    .limit(1)
  const isOwner = item?.ownerUserId === params.actorUserId

  if (params.status === 'removed' && !isTaggedPerson && !isOwner) {
    throw new MediaSocialError('Forbidden', 'forbidden')
  }
  if ((params.status === 'approved' || params.status === 'declined') && !isTaggedPerson) {
    throw new MediaSocialError('Only the tagged person can approve or decline', 'forbidden')
  }

  await db
    .update(schema.mediaPeopleTags)
    .set({ status: params.status, updatedAt: new Date() })
    .where(eq(schema.mediaPeopleTags.id, params.tagId))
}

export type PendingPeopleTagRow = {
  id: string
  mediaItemId: string
  status: string
  label: string | null
  createdAt: string
  taggedBy: { id: string; username: string; displayName: string | null }
  mediaPreviewUrl: string | null
  mediaKind: MediaKind
}

/** Pending tags where the viewer is the tagged person. */
export async function listPendingPeopleTagsForUser(userId: string): Promise<PendingPeopleTagRow[]> {
  const rows = await db
    .select({
      id: schema.mediaPeopleTags.id,
      mediaItemId: schema.mediaPeopleTags.mediaItemId,
      status: schema.mediaPeopleTags.status,
      label: schema.mediaPeopleTags.label,
      createdAt: schema.mediaPeopleTags.createdAt,
      taggedById: schema.mediaPeopleTags.taggedByUserId,
      taggedByUsername: schema.users.username,
      taggedByDisplayName: schema.profiles.displayName,
      mediaKind: schema.mediaItems.mediaKind,
      mediaAssetId: schema.mediaItems.mediaAssetId,
    })
    .from(schema.mediaPeopleTags)
    .innerJoin(schema.users, eq(schema.users.id, schema.mediaPeopleTags.taggedByUserId))
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.mediaPeopleTags.mediaItemId))
    .where(
      and(
        eq(schema.mediaPeopleTags.taggedUserId, userId),
        eq(schema.mediaPeopleTags.status, 'pending'),
        isNull(schema.mediaItems.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaPeopleTags.createdAt))
    .limit(50)

  const out: PendingPeopleTagRow[] = []
  for (const row of rows) {
    const asset = await getMediaAssetById(row.mediaAssetId)
    let mediaPreviewUrl: string | null = null
    if (asset) {
      const viewed = await getMediaAssetForViewer(asset.id, { userId })
      mediaPreviewUrl =
        viewed && 'url' in viewed && viewed.url ?
          viewed.url
        : viewed?.blurred ?
          mediaContentProxyPath(asset.id)
        : null
    }
    out.push({
      id: row.id,
      mediaItemId: row.mediaItemId,
      status: row.status,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      taggedBy: {
        id: row.taggedById,
        username: row.taggedByUsername,
        displayName: row.taggedByDisplayName,
      },
      mediaPreviewUrl,
      mediaKind: row.mediaKind as MediaKind,
    })
  }
  return out
}

export async function createPeopleTagOnMediaItem(params: {
  mediaItemId: string
  taggedUserId: string
  taggedByUserId: string
  x?: number
  y?: number
  label?: string
}) {
  const [item] = await db
    .select()
    .from(schema.mediaItems)
    .where(and(eq(schema.mediaItems.id, params.mediaItemId), isNull(schema.mediaItems.deletedAt)))
    .limit(1)
  if (!item) throw new MediaSocialError('Media not found')
  if (item.ownerUserId !== params.taggedByUserId) {
    throw new MediaSocialError('Forbidden', 'forbidden')
  }

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.mediaPeopleTags)
    .where(
      and(
        eq(schema.mediaPeopleTags.mediaItemId, params.mediaItemId),
        ne(schema.mediaPeopleTags.status, 'removed'),
      ),
    )
  if ((countRow?.n ?? 0) >= MAX_MEDIA_PEOPLE_TAGS) {
    throw new MediaSocialError(`Maximum ${MAX_MEDIA_PEOPLE_TAGS} people tags allowed`)
  }

  const [duplicate] = await db
    .select({ id: schema.mediaPeopleTags.id })
    .from(schema.mediaPeopleTags)
    .where(
      and(
        eq(schema.mediaPeopleTags.mediaItemId, params.mediaItemId),
        eq(schema.mediaPeopleTags.taggedUserId, params.taggedUserId),
        ne(schema.mediaPeopleTags.status, 'removed'),
      ),
    )
    .limit(1)
  if (duplicate) throw new MediaSocialError('This person is already tagged')

  const taggedSettings = await loadUserPrivacySettings(params.taggedUserId)
  if (taggedSettings.mediaSettings.allowPeopleToTagMe === 'no') {
    throw new MediaSocialError('This member does not allow tags')
  }

  const autoApprove =
    taggedSettings.mediaSettings.allowPeopleToTagMe === 'yes' ||
    params.taggedUserId === params.taggedByUserId
  const now = new Date()
  const [row] = await db
    .insert(schema.mediaPeopleTags)
    .values({
      mediaItemId: params.mediaItemId,
      taggedUserId: params.taggedUserId,
      taggedByUserId: params.taggedByUserId,
      status: autoApprove ? 'approved' : 'pending',
      x: params.x ?? null,
      y: params.y ?? null,
      label: params.label ?? null,
      updatedAt: now,
    })
    .returning()
  return row
}
