/**
 * Profile-scoped feed post lists — reuses global feed access + media helpers.
 */
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { withAlphaLabels } from './alpha-seed-labels.js'
import { filterRowsForGlobalFeed } from './feed-post-access.js'
import { filterQuotedPostsMediaForViewer } from './feed-media-attachments.js'
import { enrichPostsWithLikeMeta } from './post-like-meta.js'
import type { FeedPostCommentPreview } from './feed-post-comments.js'

export type ProfileFeedPostRow = {
  id: string
  authorId: string
  authorUsername: string
  authorAvatarUrl: string | null
  kind: string
  title: string | null
  body: string
  bodyFormat: string
  attachments: unknown
  mentions: unknown
  repostOfId: string | null
  createdAt: string
  quotedPost?: ProfileFeedPostRow
  likeCount?: number
  likedByViewer?: boolean
  reactionCounts?: Record<string, number>
  viewerReaction?: string | null
  commentCount?: number
  commentPreview?: FeedPostCommentPreview | null
}

function shapePostRow(row: {
  id: string
  authorId: string
  kind: string
  title: string | null
  body: string
  bodyFormat: string
  attachments: unknown
  mentions: unknown
  repostOfId: string | null
  createdAt: Date
  username: string
  avatarUrl?: string | null
}): ProfileFeedPostRow {
  return {
    id: row.id,
    authorId: row.authorId,
    authorUsername: row.username,
    authorAvatarUrl: row.avatarUrl ?? null,
    kind: row.kind,
    title: row.title,
    body: row.body,
    bodyFormat: row.bodyFormat,
    attachments: row.attachments,
    mentions: row.mentions,
    repostOfId: row.repostOfId,
    createdAt: row.createdAt.toISOString(),
  }
}

async function attachQuotedPosts(
  posts: ProfileFeedPostRow[],
  viewerId: string | null,
): Promise<ProfileFeedPostRow[]> {
  const ids = [...new Set(posts.map((p) => p.repostOfId).filter(Boolean))] as string[]
  if (ids.length === 0) return posts

  const rows = await db
    .select({
      id: schema.feedPosts.id,
      authorId: schema.feedPosts.authorId,
      kind: schema.feedPosts.kind,
      title: schema.feedPosts.title,
      body: schema.feedPosts.body,
      bodyFormat: schema.feedPosts.bodyFormat,
      attachments: schema.feedPosts.attachments,
      mentions: schema.feedPosts.mentions,
      repostOfId: schema.feedPosts.repostOfId,
      createdAt: schema.feedPosts.createdAt,
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.feedPosts)
    .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.feedPosts.id, ids))

  const visibleRows = await filterRowsForGlobalFeed(viewerId, rows)
  const byId = new Map(visibleRows.map((r) => [r.id, shapePostRow(r)]))
  return posts.map((p) =>
    p.repostOfId && byId.has(p.repostOfId) ? { ...p, quotedPost: byId.get(p.repostOfId)! } : p,
  )
}

async function attachLikeMeta(posts: ProfileFeedPostRow[], viewerId: string | null): Promise<ProfileFeedPostRow[]> {
  const postIds = posts.map((p) => p.id)
  const meta = await enrichPostsWithLikeMeta(viewerId, postIds)
  return posts.map((p) => {
    const m = meta.get(p.id)
    if (!m) return p
    return {
      ...p,
      likeCount: m.likeCount,
      likedByViewer: m.likedByViewer,
      reactionCounts: m.reactionCounts,
      viewerReaction: m.viewerReaction,
      commentCount: m.commentCount,
      commentPreview: m.commentPreview,
    }
  })
}

export async function listAuthorFeedPostsForProfile(
  viewerId: string | null,
  authorId: string,
  limit: number,
): Promise<ProfileFeedPostRow[]> {
  const fetchLimit = Math.min(100, Math.max(limit, limit * 3))
  const rows = await db
    .select({
      id: schema.feedPosts.id,
      authorId: schema.feedPosts.authorId,
      kind: schema.feedPosts.kind,
      title: schema.feedPosts.title,
      body: schema.feedPosts.body,
      bodyFormat: schema.feedPosts.bodyFormat,
      attachments: schema.feedPosts.attachments,
      mentions: schema.feedPosts.mentions,
      repostOfId: schema.feedPosts.repostOfId,
      createdAt: schema.feedPosts.createdAt,
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.feedPosts)
    .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(eq(schema.feedPosts.authorId, authorId), ne(schema.feedPosts.kind, 'repost')))
    .orderBy(desc(schema.feedPosts.createdAt))
    .limit(fetchLimit)

  const visibleRows = (await filterRowsForGlobalFeed(viewerId, rows)).slice(0, limit)
  const shaped = visibleRows.map(shapePostRow)
  const withQuotes = await attachQuotedPosts(shaped, viewerId)
  const withVisibleMedia = await filterQuotedPostsMediaForViewer(viewerId, withQuotes)
  const withLikes = await attachLikeMeta(withVisibleMedia, viewerId)
  return withAlphaLabels('feed_post', withLikes)
}

export async function resolveUserIdByUsername(username: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  return row?.id ?? null
}
