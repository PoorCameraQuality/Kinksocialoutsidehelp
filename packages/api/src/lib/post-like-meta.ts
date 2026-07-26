import {
  emptyFeedReactionCounts,
  isFeedReactionId,
  totalFeedReactionCount,
  type FeedReactionId,
} from '@c2k/shared'
import { and, count, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { emitActivity } from './feed-activities.js'
import { loadFeedPostCommentCountsForViewer, loadFeedPostCommentPreviewsForViewer, type FeedPostCommentPreview } from './feed-post-comments.js'
import {
  loadConnectionLikerPreviewByPostIds,
  type ConnectionLikerPreviewItem,
} from './connection-liker-preview.js'

export type PostLikeMeta = {
  likeCount: number
  likedByViewer: boolean
  reactionCounts: Record<FeedReactionId, number>
  viewerReaction: FeedReactionId | null
  commentCount: number
  commentPreview: FeedPostCommentPreview | null
  connectionLikerPreview: ConnectionLikerPreviewItem[]
}

function emptyCountsRecord(): Record<FeedReactionId, number> {
  return emptyFeedReactionCounts()
}

export async function loadPostReactionCounts(postIds: string[]): Promise<Map<string, Record<FeedReactionId, number>>> {
  const result = new Map<string, Record<FeedReactionId, number>>()
  if (postIds.length === 0) return result
  const rows = await db
    .select({
      postId: schema.postLikes.postId,
      kind: schema.postLikes.kind,
      reactionCount: count(),
    })
    .from(schema.postLikes)
    .where(inArray(schema.postLikes.postId, postIds))
    .groupBy(schema.postLikes.postId, schema.postLikes.kind)
  for (const postId of postIds) {
    result.set(postId, emptyCountsRecord())
  }
  for (const row of rows) {
    const bucket = result.get(row.postId) ?? emptyCountsRecord()
    const kind = isFeedReactionId(row.kind) ? row.kind : 'love'
    bucket[kind] = Number(row.reactionCount)
    result.set(row.postId, bucket)
  }
  return result
}

/** @deprecated use loadPostReactionCounts - total reactions per post */
export async function loadPostLikeCounts(postIds: string[]): Promise<Map<string, number>> {
  const reactionCounts = await loadPostReactionCounts(postIds)
  const result = new Map<string, number>()
  for (const [postId, counts] of reactionCounts) {
    result.set(postId, totalFeedReactionCount(counts))
  }
  return result
}

export async function loadViewerReactions(
  viewerId: string,
  postIds: string[],
): Promise<Map<string, FeedReactionId>> {
  const result = new Map<string, FeedReactionId>()
  if (postIds.length === 0) return result
  const rows = await db
    .select({ postId: schema.postLikes.postId, kind: schema.postLikes.kind })
    .from(schema.postLikes)
    .where(and(eq(schema.postLikes.userId, viewerId), inArray(schema.postLikes.postId, postIds)))
  for (const row of rows) {
    result.set(row.postId, isFeedReactionId(row.kind) ? row.kind : 'love')
  }
  return result
}

/** @deprecated use loadViewerReactions */
export async function loadViewerLikedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  const reactions = await loadViewerReactions(viewerId, postIds)
  return new Set(reactions.keys())
}

export async function loadPostLikeCount(postId: string): Promise<number> {
  const counts = await loadPostReactionCounts([postId])
  return totalFeedReactionCount(counts.get(postId) ?? emptyCountsRecord())
}

export async function loadPostReactionState(
  postId: string,
  viewerId: string | null,
): Promise<Pick<PostLikeMeta, 'likeCount' | 'likedByViewer' | 'reactionCounts' | 'viewerReaction'>> {
  const [countsMap, viewerMap] = await Promise.all([
    loadPostReactionCounts([postId]),
    viewerId ? loadViewerReactions(viewerId, [postId]) : Promise.resolve(new Map()),
  ])
  const reactionCounts = countsMap.get(postId) ?? emptyCountsRecord()
  const viewerReaction = viewerMap.get(postId) ?? null
  return {
    reactionCounts,
    viewerReaction,
    likeCount: totalFeedReactionCount(reactionCounts),
    likedByViewer: viewerReaction !== null,
  }
}

function isMissingDbRelationError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return /relation ".*" does not exist/i.test(e.message)
}

function emptyLikeMeta(): PostLikeMeta {
  return {
    likeCount: 0,
    likedByViewer: false,
    reactionCounts: emptyCountsRecord(),
    viewerReaction: null,
    commentCount: 0,
    commentPreview: null,
    connectionLikerPreview: [],
  }
}

export async function enrichPostsWithLikeMeta(
  viewerId: string | null,
  postIds: string[],
  options?: { includeConnectionPreview?: boolean },
): Promise<Map<string, PostLikeMeta>> {
  if (postIds.length === 0) return new Map()

  try {
    const [reactionCounts, viewerReactions, commentCounts, commentPreviews, connectionPreview] = await Promise.all([
      loadPostReactionCounts(postIds),
      viewerId ? loadViewerReactions(viewerId, postIds) : Promise.resolve(new Map<string, FeedReactionId>()),
      loadFeedPostCommentCountsForViewer(viewerId, postIds),
      loadFeedPostCommentPreviewsForViewer(viewerId, postIds),
      options?.includeConnectionPreview && viewerId ?
        loadConnectionLikerPreviewByPostIds(viewerId, postIds)
      : Promise.resolve(new Map<string, ConnectionLikerPreviewItem[]>()),
    ])

    const result = new Map<string, PostLikeMeta>()
    for (const postId of postIds) {
      const counts = reactionCounts.get(postId) ?? emptyCountsRecord()
      const viewerReaction = viewerReactions.get(postId) ?? null
      result.set(postId, {
        reactionCounts: counts,
        viewerReaction,
        likeCount: totalFeedReactionCount(counts),
        likedByViewer: viewerReaction !== null,
        commentCount: commentCounts.get(postId) ?? 0,
        commentPreview: commentPreviews.get(postId) ?? null,
        connectionLikerPreview: connectionPreview.get(postId) ?? [],
      })
    }
    return result
  } catch (e) {
    if (isMissingDbRelationError(e)) {
      return new Map(postIds.map((postId) => [postId, emptyLikeMeta()]))
    }
    throw e
  }
}

export async function setPostReaction(
  userId: string,
  postId: string,
  kind: FeedReactionId,
): Promise<PostLikeMeta> {
  const now = new Date()
  const [post] = await db
    .select({
      authorId: schema.feedPosts.authorId,
      attachments: schema.feedPosts.attachments,
      authorUsername: schema.users.username,
    })
    .from(schema.feedPosts)
    .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
    .where(eq(schema.feedPosts.id, postId))
    .limit(1)

  await db
    .insert(schema.postLikes)
    .values({ userId, postId, kind, createdAt: now })
    .onConflictDoUpdate({
      target: [schema.postLikes.userId, schema.postLikes.postId],
      set: { kind, createdAt: now },
    })

  if (post && post.authorId !== userId) {
    const previewUrls: string[] = []
    if (Array.isArray(post.attachments)) {
      for (const entry of post.attachments) {
        if (!entry || typeof entry !== 'object') continue
        const url = (entry as { url?: string }).url
        const type = (entry as { type?: string }).type
        if (typeof url === 'string' && url.trim() && (type === 'image' || type === 'video' || !type)) {
          previewUrls.push(url.trim())
        }
        if (previewUrls.length >= 4) break
      }
    }
    emitActivity({
      actorId: userId,
      verb: kind === 'love' ? 'loved' : 'reacted',
      objectType: 'feed_post',
      objectId: postId,
      metadata: {
        postAuthorUsername: post.authorUsername,
        reactionKind: kind,
        previewUrls,
        count: 1,
      },
    })
  }

  const commentCount = (await loadFeedPostCommentCountsForViewer(userId, [postId])).get(postId) ?? 0
  const state = await loadPostReactionState(postId, userId)
  return { ...state, commentCount, commentPreview: null, connectionLikerPreview: [] }
}

export async function clearPostReaction(userId: string, postId: string): Promise<PostLikeMeta> {
  await db
    .delete(schema.postLikes)
    .where(and(eq(schema.postLikes.userId, userId), eq(schema.postLikes.postId, postId)))
  const commentCount = (await loadFeedPostCommentCountsForViewer(userId, [postId])).get(postId) ?? 0
  const state = await loadPostReactionState(postId, userId)
  return { ...state, commentCount, commentPreview: null, connectionLikerPreview: [] }
}
