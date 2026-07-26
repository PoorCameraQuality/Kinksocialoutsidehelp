import { and, count, desc, eq, inArray, notInArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedPairUserIds } from './blocks.js'
import { emitActivity } from './feed-activities.js'
import {
  pickLatestVisibleCommentPreviews,
  COMMENT_BODY_PREVIEW_MAX,
  truncateCommentBodyPreview,
} from './feed-post-comment-preview.js'

export type FeedPostCommentPreview = {
  id: string
  authorDisplayName: string
  authorUsername: string
  authorAvatarUrl: string | null
  bodyPreview: string
  createdAt: string
}

export { COMMENT_BODY_PREVIEW_MAX }

export type FeedPostCommentRow = {
  id: string
  postId: string
  authorId: string
  authorUsername: string
  authorAvatarUrl: string | null
  body: string
  createdAt: string
}

function isMissingDbRelationError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return /relation ".*" does not exist/i.test(e.message)
}

export async function loadFeedPostCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  return loadFeedPostCommentCountsForViewer(null, postIds)
}

export async function loadFeedPostCommentCountsForViewer(
  viewerId: string | null,
  postIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (postIds.length === 0) return result
  try {
    const hiddenAuthorIds =
      viewerId ? await loadBlockedPairUserIds(viewerId) : new Set<string>()
    const whereParts = [inArray(schema.feedPostComments.postId, postIds)]
    if (hiddenAuthorIds.size > 0) {
      whereParts.push(notInArray(schema.feedPostComments.authorId, [...hiddenAuthorIds]))
    }
    const rows = await db
      .select({
        postId: schema.feedPostComments.postId,
        commentCount: count(),
      })
      .from(schema.feedPostComments)
      .where(and(...whereParts))
      .groupBy(schema.feedPostComments.postId)
    for (const row of rows) {
      result.set(row.postId, Number(row.commentCount))
    }
  } catch (e) {
    if (!isMissingDbRelationError(e)) throw e
  }
  return result
}

export async function loadFeedPostCommentPreviewsForViewer(
  viewerId: string | null,
  postIds: string[],
): Promise<Map<string, FeedPostCommentPreview>> {
  const result = new Map<string, FeedPostCommentPreview>()
  if (postIds.length === 0) return result
  try {
    const hiddenAuthorIds =
      viewerId ? await loadBlockedPairUserIds(viewerId) : new Set<string>()
    const scanLimit = Math.min(500, Math.max(postIds.length * 5, postIds.length))
    const rows = await db
      .select({
        id: schema.feedPostComments.id,
        postId: schema.feedPostComments.postId,
        authorId: schema.feedPostComments.authorId,
        body: schema.feedPostComments.body,
        createdAt: schema.feedPostComments.createdAt,
        authorUsername: schema.users.username,
        authorAvatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.feedPostComments)
      .innerJoin(schema.users, eq(schema.feedPostComments.authorId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(inArray(schema.feedPostComments.postId, postIds))
      .orderBy(desc(schema.feedPostComments.createdAt))
      .limit(scanLimit)

    return pickLatestVisibleCommentPreviews(
      rows.map((row) => ({
        id: row.id,
        postId: row.postId,
        authorId: row.authorId,
        authorUsername: row.authorUsername,
        authorAvatarUrl: row.authorAvatarUrl ?? null,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
      hiddenAuthorIds,
    )
  } catch (e) {
    if (!isMissingDbRelationError(e)) throw e
  }
  return result
}

export async function loadFeedPostCommentCount(
  postId: string,
  viewerId: string | null = null,
): Promise<number> {
  return (await loadFeedPostCommentCountsForViewer(viewerId, [postId])).get(postId) ?? 0
}

export async function listFeedPostComments(
  postId: string,
  viewerId: string | null,
  limit = 50,
): Promise<FeedPostCommentRow[]> {
  const capped = Math.min(100, Math.max(1, limit))
  const hiddenAuthorIds =
    viewerId ? await loadBlockedPairUserIds(viewerId) : new Set<string>()
  const whereParts = [eq(schema.feedPostComments.postId, postId)]
  if (hiddenAuthorIds.size > 0) {
    whereParts.push(notInArray(schema.feedPostComments.authorId, [...hiddenAuthorIds]))
  }
  const rows = await db
    .select({
      id: schema.feedPostComments.id,
      postId: schema.feedPostComments.postId,
      authorId: schema.feedPostComments.authorId,
      body: schema.feedPostComments.body,
      createdAt: schema.feedPostComments.createdAt,
      authorUsername: schema.users.username,
      authorAvatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.feedPostComments)
    .innerJoin(schema.users, eq(schema.feedPostComments.authorId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(...whereParts))
    .orderBy(schema.feedPostComments.createdAt)
    .limit(capped)
  return rows.map((row) => ({
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function createFeedPostComment(
  postId: string,
  authorId: string,
  body: string,
): Promise<FeedPostCommentRow | null> {
  const trimmed = body.replace(/\0/g, '').trim()
  if (!trimmed || trimmed.length > 4000) return null
  const now = new Date()
  const [row] = await db
    .insert(schema.feedPostComments)
    .values({
      postId,
      authorId,
      body: trimmed.slice(0, 4000),
      updatedAt: now,
    })
    .returning()
  if (!row) return null
  const [author] = await db
    .select({
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, authorId))
    .limit(1)
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorUsername: author?.username ?? '',
    authorAvatarUrl: author?.avatarUrl ?? null,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

function previewUrlsFromAttachments(attachments: unknown): string[] {
  const previewUrls: string[] = []
  if (!Array.isArray(attachments)) return previewUrls
  for (const entry of attachments) {
    if (!entry || typeof entry !== 'object') continue
    const url = (entry as { url?: string }).url
    const type = (entry as { type?: string }).type
    if (typeof url === 'string' && url.trim() && (type === 'image' || type === 'video' || !type)) {
      previewUrls.push(url.trim())
    }
    if (previewUrls.length >= 4) break
  }
  return previewUrls
}

/** Surface comment activity to followers (compact Following row). */
export async function emitFeedPostCommentActivity(
  actorId: string,
  postId: string,
  commentBody: string,
): Promise<void> {
  const [post] = await db
    .select({
      title: schema.feedPosts.title,
      body: schema.feedPosts.body,
      attachments: schema.feedPosts.attachments,
      authorUsername: schema.users.username,
    })
    .from(schema.feedPosts)
    .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
    .where(eq(schema.feedPosts.id, postId))
    .limit(1)
  if (!post) return

  const title =
    typeof post.title === 'string' && post.title.trim() ?
      post.title.trim()
    : truncateCommentBodyPreview(post.body, 80) || null

  emitActivity({
    actorId,
    verb: 'post_comment',
    objectType: 'feed_post',
    objectId: postId,
    metadata: {
      excerpt: truncateCommentBodyPreview(commentBody),
      postAuthorUsername: post.authorUsername,
      title,
      previewUrls: previewUrlsFromAttachments(post.attachments),
      count: 1,
    },
  })
}

export async function deleteFeedPostComment(commentId: string, authorId: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.feedPostComments)
    .where(and(eq(schema.feedPostComments.id, commentId), eq(schema.feedPostComments.authorId, authorId)))
    .returning({ id: schema.feedPostComments.id })
  return deleted.length > 0
}
