/**
 * Re-check media visibility when serving feed post attachments on read.
 * Uses existing media item/asset helpers — no second privacy system.
 */
import { feedAttachmentSchema, MEDIA_VISIBILITIES, type FeedAttachment } from '@c2k/shared'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { sanitizeEventActivityObjectForViewer } from './event-activity.js'
import { deliverFeedImageUrl } from './image-delivery.js'
import { sanitizeConventionActivityObjectForViewer } from './convention-activity.js'
import type { MediaAsset, MediaItem } from '../db/schema.js'
import { getMediaAssetForViewer } from './media-asset-viewer.js'
import { canViewerSeeMediaItem, shapeMediaItemPreview } from './media-social-service.js'

const MEDIA_PROXY_PATH_RE = /^\/api\/v1\/media\/assets\/([0-9a-f-]{36})\/content(?:\?|$)/i

export function parseMediaAssetIdFromProxyUrl(url: string): string | null {
  const match = url.match(MEDIA_PROXY_PATH_RE)
  return match?.[1] ?? null
}

/** Mirrors album list visibility in media-social-service.listUserAlbums. */
export function albumVisibleToViewer(
  albumVisibility: string,
  albumOwnerUserId: string,
  viewerUserId: string | null,
): boolean {
  if (viewerUserId === albumOwnerUserId) return true
  if (albumVisibility === MEDIA_VISIBILITIES.privateProfile) return false
  if (albumVisibility === MEDIA_VISIBILITIES.publicPreview) return true
  return Boolean(viewerUserId)
}

function parseFeedAttachments(raw: unknown): FeedAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: FeedAttachment[] = []
  for (const entry of raw) {
    const parsed = feedAttachmentSchema.safeParse(entry)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

type MediaAccessContext = {
  itemsById: Map<string, MediaItem>
  assetsById: Map<string, MediaAsset>
  albumsByItemId: Map<string, Array<{ visibility: string; ownerUserId: string }>>
}

async function buildMediaAccessContext(mediaItemIds: string[]): Promise<MediaAccessContext> {
  const itemsById = new Map<string, MediaItem>()
  const assetsById = new Map<string, MediaAsset>()
  const albumsByItemId = new Map<string, Array<{ visibility: string; ownerUserId: string }>>()

  const uniqueIds = [...new Set(mediaItemIds)]
  if (uniqueIds.length === 0) {
    return { itemsById, assetsById, albumsByItemId }
  }

  const items = await db
    .select()
    .from(schema.mediaItems)
    .where(inArray(schema.mediaItems.id, uniqueIds))
  for (const item of items) itemsById.set(item.id, item)

  const assetIds = [...new Set(items.map((item) => item.mediaAssetId))]
  if (assetIds.length > 0) {
    const assets = await db
      .select()
      .from(schema.mediaAssets)
      .where(inArray(schema.mediaAssets.id, assetIds))
    for (const asset of assets) assetsById.set(asset.id, asset)
  }

  const albumRows = await db
    .select({
      mediaItemId: schema.mediaAlbumItems.mediaItemId,
      visibility: schema.mediaAlbums.visibility,
      ownerUserId: schema.mediaAlbums.ownerUserId,
    })
    .from(schema.mediaAlbumItems)
    .innerJoin(schema.mediaAlbums, eq(schema.mediaAlbumItems.albumId, schema.mediaAlbums.id))
    .where(and(inArray(schema.mediaAlbumItems.mediaItemId, uniqueIds), isNull(schema.mediaAlbums.deletedAt)))

  for (const row of albumRows) {
    const list = albumsByItemId.get(row.mediaItemId) ?? []
    list.push({ visibility: row.visibility, ownerUserId: row.ownerUserId })
    albumsByItemId.set(row.mediaItemId, list)
  }

  return { itemsById, assetsById, albumsByItemId }
}

function viewerPassesAlbumGates(
  mediaItemId: string,
  viewerUserId: string | null,
  context: MediaAccessContext,
): boolean {
  const albums = context.albumsByItemId.get(mediaItemId) ?? []
  for (const album of albums) {
    if (!albumVisibleToViewer(album.visibility, album.ownerUserId, viewerUserId)) {
      return false
    }
  }
  return true
}

async function proxyUrlAllowed(url: string, viewerUserId: string | null): Promise<boolean> {
  const assetId = parseMediaAssetIdFromProxyUrl(url)
  if (!assetId) return true
  const viewed = await getMediaAssetForViewer(assetId, { userId: viewerUserId })
  return viewed !== null
}

async function filterLegacyUrlAttachment(
  attachment: Extract<FeedAttachment, { type: 'image' | 'audio' | 'video' }>,
  viewerUserId: string | null,
): Promise<Extract<FeedAttachment, { type: 'image' | 'audio' | 'video' }> | null> {
  if (!(await proxyUrlAllowed(attachment.url, viewerUserId))) return null

  if (attachment.type === 'video' && attachment.posterUrl) {
    if (!(await proxyUrlAllowed(attachment.posterUrl, viewerUserId))) {
      return { ...attachment, posterUrl: null }
    }
  }

  if (attachment.type === 'image') {
    return {
      ...attachment,
      url: deliverFeedImageUrl(attachment.url) ?? attachment.url,
    }
  }

  return attachment
}

async function filterMediaFeedAttachment(
  attachment: Extract<FeedAttachment, { type: 'media' }>,
  viewerUserId: string | null,
  context: MediaAccessContext,
): Promise<Extract<FeedAttachment, { type: 'media' }> | null> {
  const item = context.itemsById.get(attachment.mediaItemId)
  if (!item) return null

  const asset = context.assetsById.get(item.mediaAssetId)
  if (!asset) return null

  if (!(await canViewerSeeMediaItem(item, asset, viewerUserId))) return null
  if (!viewerPassesAlbumGates(item.id, viewerUserId, context)) return null

  const preview = await shapeMediaItemPreview(item, asset, viewerUserId)
  if (!preview) return null

  return {
    type: 'media',
    mediaKind: attachment.mediaKind,
    mediaItemId: attachment.mediaItemId,
    mediaAssetId: item.mediaAssetId,
    previewUrl: preview.previewUrl,
    blurredPreviewUrl: preview.blurredPreviewUrl,
    width: preview.width ?? attachment.width,
    height: preview.height ?? attachment.height,
    durationSeconds: preview.durationSeconds ?? attachment.durationSeconds,
    isBlurredByDefault: preview.isBlurredByDefault ?? attachment.isBlurredByDefault,
    contentRating: preview.contentRating ?? attachment.contentRating,
    visibility: attachment.visibility ?? item.visibility,
  }
}

/** Filter feed post attachments for the current viewer; omits inaccessible media. */
export async function filterVisibleFeedAttachments(
  viewerUserId: string | null,
  rawAttachments: unknown,
): Promise<FeedAttachment[]> {
  const attachments = parseFeedAttachments(rawAttachments)
  if (attachments.length === 0) return []

  const mediaItemIds = attachments
    .filter((attachment): attachment is Extract<FeedAttachment, { type: 'media' }> => attachment.type === 'media')
    .map((attachment) => attachment.mediaItemId)

  const context = await buildMediaAccessContext(mediaItemIds)
  const out: FeedAttachment[] = []

  for (const attachment of attachments) {
    if (attachment.type === 'media') {
      const filtered = await filterMediaFeedAttachment(attachment, viewerUserId, context)
      if (filtered) out.push(filtered)
      continue
    }
    const filtered = await filterLegacyUrlAttachment(attachment, viewerUserId)
    if (filtered) out.push(filtered)
  }

  return out
}

export async function filterPostsMediaAttachmentsForViewer<T extends { attachments: unknown }>(
  viewerUserId: string | null,
  posts: T[],
): Promise<T[]> {
  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      attachments: await filterVisibleFeedAttachments(viewerUserId, post.attachments),
    })),
  )
}

export async function filterQuotedPostsMediaForViewer<
  T extends { attachments: unknown; quotedPost?: { attachments: unknown } | undefined },
>(viewerUserId: string | null, posts: T[]): Promise<T[]> {
  return Promise.all(
    posts.map(async (post) => {
      const attachments = await filterVisibleFeedAttachments(viewerUserId, post.attachments)
      const quotedPost =
        post.quotedPost ?
          {
            ...post.quotedPost,
            attachments: await filterVisibleFeedAttachments(viewerUserId, post.quotedPost.attachments),
          }
        : post.quotedPost
      return { ...post, attachments, quotedPost }
    }),
  )
}

const REACTION_PREVIEW_VERBS = new Set(['loved', 'reacted', 'post_love'])
const UPLOAD_PREVIEW_VERBS = new Set(['uploaded_media', 'uploaded_picture', 'uploaded_video'])
const STATIC_PUBLIC_URL_PREFIXES = ['/landing/', '/seed/']

/** Public marketing/seed assets — not user-upload media. */
export function isLikelyPublicStaticAssetUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  return STATIC_PUBLIC_URL_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}

async function isActivityPreviewUrlVisibleToViewer(
  url: string,
  viewerUserId: string | null,
  options: { strictUnknown: boolean },
): Promise<boolean> {
  const trimmed = url.trim()
  if (!trimmed) return false
  const assetId = parseMediaAssetIdFromProxyUrl(trimmed)
  if (assetId) {
    const viewed = await getMediaAssetForViewer(assetId, { userId: viewerUserId })
    return viewed !== null
  }
  if (isLikelyPublicStaticAssetUrl(trimmed)) return true
  return !options.strictUnknown
}

export function previewUrlsFromFeedAttachments(attachments: FeedAttachment[]): string[] {
  const urls: string[] = []
  for (const attachment of attachments) {
    if (attachment.type === 'media') {
      const url = attachment.previewUrl ?? attachment.blurredPreviewUrl
      if (url) urls.push(url)
    } else if (attachment.type === 'image' && attachment.url) {
      urls.push(attachment.url)
    } else if (attachment.type === 'video') {
      const url = attachment.posterUrl ?? attachment.url
      if (url) urls.push(url)
    }
    if (urls.length >= 4) break
  }
  return urls
}

async function loadVisiblePostPreviewUrlMap(
  viewerUserId: string | null,
  postIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  const uniqueIds = [...new Set(postIds.filter(Boolean))]
  if (uniqueIds.length === 0) return result

  const rows = await db
    .select({ id: schema.feedPosts.id, attachments: schema.feedPosts.attachments })
    .from(schema.feedPosts)
    .where(inArray(schema.feedPosts.id, uniqueIds))

  for (const row of rows) {
    const attachments = await filterVisibleFeedAttachments(viewerUserId, row.attachments)
    const urls = previewUrlsFromFeedAttachments(attachments)
    if (urls.length > 0) result.set(row.id, urls)
  }
  return result
}

async function hydrateMediaItemIdsToPreviewUrls(
  viewerUserId: string | null,
  mediaItemIds: string[],
): Promise<{ previewUrls: string[]; visibleMediaItemIds: string[] }> {
  const previewUrls: string[] = []
  const visibleMediaItemIds: string[] = []
  const uniqueIds = [...new Set(mediaItemIds.filter(Boolean))]
  if (uniqueIds.length === 0) return { previewUrls, visibleMediaItemIds }

  const context = await buildMediaAccessContext(uniqueIds)
  for (const mediaItemId of uniqueIds) {
    const item = context.itemsById.get(mediaItemId)
    if (!item) continue
    const asset = context.assetsById.get(item.mediaAssetId)
    if (!asset) continue
    if (!(await canViewerSeeMediaItem(item, asset, viewerUserId))) continue
    if (!viewerPassesAlbumGates(mediaItemId, viewerUserId, context)) continue
    const preview = await shapeMediaItemPreview(item, asset, viewerUserId)
    if (!preview) continue
    visibleMediaItemIds.push(mediaItemId)
    const url = preview.previewUrl ?? preview.blurredPreviewUrl
    if (url) previewUrls.push(url)
    if (previewUrls.length >= 4) break
  }
  return { previewUrls, visibleMediaItemIds }
}

export type SanitizeActivityMetadataContext = {
  verb?: string
  objectType?: string
  objectId?: string
}

/** Strip or re-hydrate activity metadata media fields for the current viewer. */
export async function sanitizeFeedActivityMetadataForViewer(
  viewerUserId: string | null,
  metadata: Record<string, unknown>,
  context: SanitizeActivityMetadataContext,
  postPreviewUrls?: string[] | null,
): Promise<Record<string, unknown>> {
  const verb = context.verb ?? ''
  const out = { ...metadata }
  const strictUnknown = REACTION_PREVIEW_VERBS.has(verb) || UPLOAD_PREVIEW_VERBS.has(verb)

  const rawMediaItemIds = Array.isArray(out.mediaItemIds) ?
    out.mediaItemIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  : []
  if (rawMediaItemIds.length > 0) {
    const hydrated = await hydrateMediaItemIdsToPreviewUrls(viewerUserId, rawMediaItemIds)
    if (hydrated.visibleMediaItemIds.length > 0) {
      out.mediaItemIds = hydrated.visibleMediaItemIds
    } else {
      delete out.mediaItemIds
    }
    if (UPLOAD_PREVIEW_VERBS.has(verb) && hydrated.previewUrls.length > 0) {
      out.previewUrls = hydrated.previewUrls
    }
  }

  if (REACTION_PREVIEW_VERBS.has(verb) && context.objectType === 'feed_post' && postPreviewUrls !== undefined) {
    if (postPreviewUrls && postPreviewUrls.length > 0) {
      out.previewUrls = postPreviewUrls
    } else {
      delete out.previewUrls
      delete out.thumbnailUrl
    }
    return out
  }

  const urlsToFilter = new Set<string>()
  if (Array.isArray(out.previewUrls)) {
    for (const url of out.previewUrls) {
      if (typeof url === 'string' && url.trim()) urlsToFilter.add(url.trim())
    }
  }
  if (typeof out.thumbnailUrl === 'string' && out.thumbnailUrl.trim()) {
    urlsToFilter.add(out.thumbnailUrl.trim())
  }

  if (urlsToFilter.size > 0) {
    const allowed: string[] = []
    for (const url of urlsToFilter) {
      if (await isActivityPreviewUrlVisibleToViewer(url, viewerUserId, { strictUnknown })) {
        allowed.push(url)
      }
    }
    if (allowed.length > 0) {
      out.previewUrls = allowed.slice(0, 4)
    } else {
      delete out.previewUrls
    }
    delete out.thumbnailUrl
  }

  if (typeof out.imageUrl === 'string' && out.imageUrl.trim()) {
    const visible = await isActivityPreviewUrlVisibleToViewer(out.imageUrl, viewerUserId, {
      strictUnknown: false,
    })
    if (!visible) delete out.imageUrl
  }

  return out
}

export async function sanitizeFollowingFeedActivityItemsForViewer<
  T extends { kind: 'post' | 'activity'; verb?: string; object?: Record<string, unknown> },
>(viewerUserId: string | null, items: T[]): Promise<T[]> {
  const reactionPostIds = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'activity') continue
    const verb = item.verb ?? ''
    if (!REACTION_PREVIEW_VERBS.has(verb)) continue
    if (item.object?.type !== 'feed_post') continue
    const postId = typeof item.object.id === 'string' ? item.object.id : ''
    if (postId) reactionPostIds.add(postId)
  }

  const postPreviewMap = await loadVisiblePostPreviewUrlMap(viewerUserId, [...reactionPostIds])

  return Promise.all(
    items.map(async (item) => {
      if (item.kind !== 'activity' || !item.object) return item
      const objectType = typeof item.object.type === 'string' ? item.object.type : ''
      const objectId = typeof item.object.id === 'string' ? item.object.id : ''
      const postPreviewUrls =
        REACTION_PREVIEW_VERBS.has(item.verb ?? '') && objectType === 'feed_post' ?
          (postPreviewMap.get(objectId) ?? [])
        : undefined
      const sanitizedMeta = await sanitizeFeedActivityMetadataForViewer(
        viewerUserId,
        item.object,
        { verb: item.verb, objectType, objectId },
        postPreviewUrls,
      )
      const verb = item.verb ?? ''
      let object = sanitizedMeta
      if ((verb === 'event_created' || verb === 'event_rsvp') && objectType === 'event') {
        object = sanitizeEventActivityObjectForViewer(sanitizedMeta)
      } else if (
        (verb === 'convention_pin' || verb === 'presenter_assigned') &&
        (objectType === 'convention' || objectType === 'schedule_slot')
      ) {
        object = sanitizeConventionActivityObjectForViewer(sanitizedMeta)
      }
      return { ...item, object }
    }),
  )
}
