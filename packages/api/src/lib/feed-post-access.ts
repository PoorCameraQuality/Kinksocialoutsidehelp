/**
 * Global/local feed post visibility for GET /api/v1/feed and GET /api/v1/feed/posts/:id.
 *
 * Access rules:
 * - Authors always see their own posts.
 * - Posts from users the viewer blocked, or users who blocked the viewer, are hidden.
 * - showPostsInFeeds `only_me` hides posts from everyone except the author.
 * - showPostsInFeeds `connections_only` hides posts from viewers who are not connected
 *   (accepted connection or follow — same graph as the Following feed).
 * - showPostsInFeeds `normal` may appear in the global/local feed.
 *
 * Member mutes (kind=USER) are not applied here; tag mutes continue to use muted-tags.ts.
 * Media attachment visibility on feed read is enforced in feed-media-attachments.ts.
 */
import type { FeedActivityPrivacy } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { actorFeedActivityAllowed, loadActorFeedPrivacy } from './feed-activity-privacy-filter.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'
import { followingIds } from './following-ids.js'

/** User ids whose posts the viewer must not see due to block relationships. */
export async function loadFeedBlockedAuthorIds(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set()
  const [blockedByViewer, whoBlockedViewer] = await Promise.all([
    loadBlockedUserIds(viewerId),
    loadUserIdsWhoBlockedUser(viewerId),
  ])
  return new Set([...blockedByViewer, ...whoBlockedViewer])
}

export function canViewerSeeAuthorPostInGlobalFeed(params: {
  viewerId: string | null
  authorId: string
  blockedAuthorIds: Set<string>
  viewerConnectionIds: Set<string>
  privacyByActor: Map<string, FeedActivityPrivacy>
}): boolean {
  const { viewerId, authorId, blockedAuthorIds, viewerConnectionIds, privacyByActor } = params
  if (viewerId && authorId === viewerId) return true
  if (blockedAuthorIds.has(authorId)) return false
  return actorFeedActivityAllowed({
    actorId: authorId,
    verb: 'post',
    source: 'post',
    viewerId: viewerId ?? '',
    viewerConnectionIds,
    privacyByActor,
  })
}

export async function filterRowsForGlobalFeed<T extends { authorId: string }>(
  viewerId: string | null,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows
  const authorIds = [...new Set(rows.map((r) => r.authorId))]
  const [blockedAuthorIds, privacyByActor, connectionIds] = await Promise.all([
    loadFeedBlockedAuthorIds(viewerId),
    loadActorFeedPrivacy(authorIds),
    viewerId ? followingIds(viewerId) : Promise.resolve([] as string[]),
  ])
  const viewerConnectionIds = new Set(connectionIds)
  return rows.filter((row) =>
    canViewerSeeAuthorPostInGlobalFeed({
      viewerId,
      authorId: row.authorId,
      blockedAuthorIds,
      viewerConnectionIds,
      privacyByActor,
    }),
  )
}

export async function viewerCanAccessFeedPost(
  viewerId: string | null,
  authorId: string,
): Promise<boolean> {
  if (viewerId && viewerId === authorId) return true
  const blockedAuthorIds = await loadFeedBlockedAuthorIds(viewerId)
  const [privacyByActor, connectionIds] = await Promise.all([
    loadActorFeedPrivacy([authorId]),
    viewerId ? followingIds(viewerId) : Promise.resolve([] as string[]),
  ])
  return canViewerSeeAuthorPostInGlobalFeed({
    viewerId,
    authorId,
    blockedAuthorIds,
    viewerConnectionIds: new Set(connectionIds),
    privacyByActor,
  })
}

export async function loadFeedPostAuthorId(postId: string): Promise<string | null> {
  const [row] = await db
    .select({ authorId: schema.feedPosts.authorId })
    .from(schema.feedPosts)
    .where(eq(schema.feedPosts.id, postId))
    .limit(1)
  return row?.authorId ?? null
}

/** True when the post exists and the viewer may read/interact with it. */
export async function viewerCanAccessFeedPostById(
  viewerId: string | null,
  postId: string,
): Promise<boolean> {
  const authorId = await loadFeedPostAuthorId(postId)
  if (!authorId) return false
  return viewerCanAccessFeedPost(viewerId, authorId)
}
