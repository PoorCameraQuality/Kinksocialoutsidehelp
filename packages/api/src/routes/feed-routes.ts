import { normalizeFeedSettings, isFeedReactionId, type FeedReactionId } from '@c2k/shared'
import { and, desc, eq, ilike, inArray, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { emitActivity } from '../lib/feed-activities.js'
import { getFollowingFeed, getFollowingFeedCounts } from '../lib/feed-following.js'
import { getHomeFeed } from '../lib/feed-home.js'
import { enrichPostsWithLikeMeta, setPostReaction, clearPostReaction } from '../lib/post-like-meta.js'
import {
  createFeedPostComment,
  deleteFeedPostComment,
  emitFeedPostCommentActivity,
  listFeedPostComments,
  loadFeedPostCommentCount,
  type FeedPostCommentPreview,
} from '../lib/feed-post-comments.js'
import {
  extractTagIdsFromMentions,
  getMutedTagIds,
  hydrateRepostSourceTagIds,
  postMatchesMutedTags,
} from '../lib/muted-tags.js'
import { sanitizeFeedHtml } from '../lib/sanitize-feed-body.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { loadJournalArticlesForUser } from './education-articles-routes.js'
import {
  ensureUserSettingsRow,
  replyIfViewerUserNotFound,
  ViewerUserNotFoundError,
} from '../lib/user-settings-row.js'
import { withAlphaLabel, withAlphaLabels } from '../lib/alpha-seed-labels.js'
import { filterRowsForGlobalFeed, viewerCanAccessFeedPost, viewerCanAccessFeedPostById } from '../lib/feed-post-access.js'
import { filterPostsMediaAttachmentsForViewer, filterQuotedPostsMediaForViewer } from '../lib/feed-media-attachments.js'
import { listAuthorFeedPostsForProfile, resolveUserIdByUsername } from '../lib/profile-feed-posts.js'
import {
  mapFeedComposerMediaError,
  linkFeedPostToStagedMediaAttachments,
  prepareFeedComposerAudioAttachment,
  prepareFeedComposerImageAttachment,
} from '../lib/feed-composer-media.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function isMissingDbRelationError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return /relation ".*" does not exist/i.test(e.message)
}

function replySchemaDrift(reply: FastifyReply): void {
  reply.status(503).send({
    error: 'Database schema out of date. Run npm run db:migrate-incremental -w @c2k/api',
  })
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  return requireAuthenticatedDbUser(req, reply)
}

const attachmentSchema = z.union([
  z.object({ type: z.literal('image'), url: z.string().url() }),
  z.object({ type: z.literal('audio'), url: z.string().url() }),
  z.object({
    type: z.literal('video'),
    url: z.string(),
    posterUrl: z.string().nullable().optional(),
    durationSeconds: z.number().int().nullable().optional(),
  }),
  z.object({
    type: z.literal('media'),
    mediaKind: z.enum(['image', 'video', 'audio']),
    mediaItemId: z.string().uuid(),
    mediaAssetId: z.string().uuid(),
    previewUrl: z.string().nullable().optional(),
    blurredPreviewUrl: z.string().nullable().optional(),
    width: z.number().int().nullable().optional(),
    height: z.number().int().nullable().optional(),
    durationSeconds: z.number().int().nullable().optional(),
    isBlurredByDefault: z.boolean().optional(),
    contentRating: z.string().nullable().optional(),
    visibility: z.string().optional(),
  }),
])

const mentionSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  slug: z.string().optional(),
  label: z.string(),
})

const createPostBody = z.object({
  kind: z.enum(['status', 'article']).default('status'),
  title: z.string().max(512).optional(),
  body: z.string().max(200_000).default(''),
  bodyFormat: z.enum(['text', 'html']).default('text'),
  attachments: z.array(attachmentSchema).max(20).optional(),
  mentions: z.array(mentionSchema).max(50).optional(),
})

function normalizeAttachmentsForBody(
  attachments: Array<z.infer<typeof attachmentSchema>> | undefined,
  bodyFormat: 'text' | 'html',
) {
  if (!attachments?.length) return []
  const seen = new Set<string>()
  const out: Array<z.infer<typeof attachmentSchema>> = []
  for (const a of attachments) {
    if (bodyFormat === 'html' && a.type === 'image') continue
    const key =
      a.type === 'media'
        ? `media:${a.mediaItemId}`
        : `${a.type}:${'url' in a ? a.url : ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

type ShapedFeedPost = ReturnType<typeof shapePostRow>

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
}) {
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

async function loadAuthorProfile(userId: string): Promise<{ username: string; avatarUrl: string | null }> {
  const [row] = await db
    .select({
      username: schema.users.username,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1)
  return { username: row?.username ?? '', avatarUrl: row?.avatarUrl ?? null }
}

async function attachQuotedPosts(
  posts: ShapedFeedPost[],
  viewerId: string | null,
): Promise<Array<ShapedFeedPost & { quotedPost?: ShapedFeedPost }>> {
  const ids = [...new Set(posts.map((p) => p.repostOfId).filter(Boolean))] as string[]
  if (ids.length === 0) return posts.map((p) => ({ ...p }))
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
    p.repostOfId && byId.has(p.repostOfId) ? { ...p, quotedPost: byId.get(p.repostOfId)! } : { ...p }
  )
}

async function assertFeedPostAccessible(
  viewerId: string | null,
  postId: string,
  reply: FastifyReply,
): Promise<boolean> {
  if (await viewerCanAccessFeedPostById(viewerId, postId)) return true
  reply.status(404).send({ error: 'Not found' })
  return false
}

async function attachLikeMetaToPosts<T extends { id: string }>(
  viewerId: string | null,
  posts: T[],
  options?: { includeConnectionPreview?: boolean }
): Promise<
  Array<
    T & {
      likeCount: number
      likedByViewer: boolean
      reactionCounts: Record<FeedReactionId, number>
      viewerReaction: FeedReactionId | null
      commentCount: number
      commentPreview?: FeedPostCommentPreview | null
      connectionLikerPreview?: { username: string; avatarUrl: string | null }[]
    }
  >
> {
  if (posts.length === 0) return []
  const meta = await enrichPostsWithLikeMeta(
    viewerId,
    posts.map((p) => p.id),
    options
  )
  return posts.map((post) => {
    const row = meta.get(post.id)
    return {
      ...post,
      likeCount: row?.likeCount ?? 0,
      likedByViewer: row?.likedByViewer ?? false,
      reactionCounts: row?.reactionCounts ?? { love: 0, respect: 0, sympathize: 0, helpful: 0 },
      viewerReaction: row?.viewerReaction ?? null,
      commentCount: row?.commentCount ?? 0,
      commentPreview: row?.commentPreview ?? null,
      ...(options?.includeConnectionPreview ?
        { connectionLikerPreview: row?.connectionLikerPreview ?? [] }
      : {}),
    }
  })
}

export async function registerFeedRoutes(app: FastifyInstance) {
  app.get('/api/v1/feed', async (req, reply) => {
    if (!requireDb(reply)) return
    try {
    const limit = Math.min(80, Math.max(1, parseInt(String((req.query as { limit?: string }).limit ?? '40'), 10) || 40))
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    const hideKinds = new Set<string>()
    let mutedTagIds = new Set<string>()
    if (viewerId) {
      try {
        const row = await ensureUserSettingsRow(viewerId)
        const feed = normalizeFeedSettings(row.feedSettings)
        for (const k of feed.hideStoryTypes) hideKinds.add(k)
        if (!feed.showConnectionShares) hideKinds.add('repost')
        if (!feed.showConnectionLikes) hideKinds.add('connection_like')
        mutedTagIds = await getMutedTagIds(viewerId)
      } catch (e) {
        if (!(e instanceof ViewerUserNotFoundError)) throw e
        // Stale session after DB reset - serve the feed without viewer filters.
      }
    }
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
      .orderBy(desc(schema.feedPosts.createdAt))
      .limit(limit * 2)

    const tagIdsByPostId = new Map<string, string[]>()
    for (const row of rows) {
      tagIdsByPostId.set(row.id, extractTagIdsFromMentions(row.mentions))
    }
    await hydrateRepostSourceTagIds(
      tagIdsByPostId,
      rows.map((row) => row.repostOfId),
    )

    const visibleRows = await filterRowsForGlobalFeed(viewerId, rows)

    const shaped = visibleRows
      .map(shapePostRow)
      .filter((p) => {
        if (hideKinds.has(p.kind)) return false
        const inheritedTags = p.repostOfId ? tagIdsByPostId.get(p.repostOfId) : undefined
        return !postMatchesMutedTags(p.mentions, mutedTagIds, inheritedTags)
      })
      .slice(0, limit)
    const withQuotes = await attachQuotedPosts(shaped, viewerId)
    const withVisibleMedia = await filterQuotedPostsMediaForViewer(viewerId, withQuotes)
    const withLikes = await attachLikeMetaToPosts(viewerId, withVisibleMedia)
    const items = await withAlphaLabels('feed_post', withLikes)
    return reply.send({ items })
    } catch (e) {
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  app.get('/api/v1/me/feed-posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { limit?: string }
    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '50'), 10) || 50))
    const items = await listAuthorFeedPostsForProfile(user.userId, user.userId, limit)
    return reply.send({ items })
  })

  app.get('/api/v1/users/:username/feed-posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { username } = req.params as { username: string }
    const q = req.query as { limit?: string }
    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '10'), 10) || 10))
    const authorId = await resolveUserIdByUsername(username)
    if (!authorId) return reply.status(404).send({ error: 'Not found' })
    const items = await listAuthorFeedPostsForProfile(user.userId, authorId, limit)
    return reply.send({ items })
  })

  app.get('/api/v1/feed/posts/:postId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { postId } = req.params as { postId: string }
    const [row] = await db
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
      .where(eq(schema.feedPosts.id, postId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    if (!(await viewerCanAccessFeedPost(viewerId, row.authorId))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const shaped = shapePostRow(row)
    const [withQuote] = await attachQuotedPosts([shaped], viewerId)
    const [withVisibleMedia] = await filterQuotedPostsMediaForViewer(viewerId, [withQuote])
    const [withLikes] = await attachLikeMetaToPosts(viewerId, [withVisibleMedia])
    const post = withLikes ? await withAlphaLabel('feed_post', withLikes) : withLikes
    return reply.send({ post })
  })

  app.post('/api/v1/feed/posts', { ...rateLimitRoute('feedPosts') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = createPostBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.kind === 'article') {
      return reply.status(400).send({
        error: 'Long-form articles use POST /api/v1/me/education-articles',
      })
    }
    const bodyRaw = parsed.data.body
    const body =
      parsed.data.bodyFormat === 'html' ? sanitizeFeedHtml(bodyRaw) : bodyRaw.replace(/\0/g, '').slice(0, 200_000)
    const now = new Date()
    const attachments = normalizeAttachmentsForBody(parsed.data.attachments, parsed.data.bodyFormat)
    const [row] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: user.userId,
        kind: parsed.data.kind,
        title: parsed.data.title,
        body,
        bodyFormat: parsed.data.bodyFormat,
        attachments,
        mentions: parsed.data.mentions ?? [],
        updatedAt: now,
      })
      .returning()
    if (!row) return reply.status(500).send({ error: 'Insert failed' })
    try {
      await linkFeedPostToStagedMediaAttachments({
        userId: user.userId,
        feedPostId: row.id,
        attachments,
        now,
      })
    } catch (err) {
      await db.delete(schema.feedPosts).where(eq(schema.feedPosts.id, row.id))
      const mapped = mapFeedComposerMediaError(err)
      return reply.status(mapped.status).send(mapped.body)
    }
    emitActivity({
      actorId: user.userId,
      verb: 'post',
      objectType: 'feed_post',
      objectId: row.id,
    })
    const author = await loadAuthorProfile(user.userId)
    return reply.send({
      post: shapePostRow({
        ...row,
        username: author.username,
        avatarUrl: author.avatarUrl,
      }),
    })
  })

  app.get('/api/v1/feed/home', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { limit?: string; cursor?: string; filter?: string }
    const limit = Math.min(50, Math.max(1, parseInt(String(q.limit ?? '20'), 10) || 20))
    const filter = q.filter?.trim() || 'all'
    try {
      const result = await getHomeFeed({
        viewerId: user.userId,
        limit,
        cursor: q.cursor,
        filter,
      })
      return reply.send({
        cards: result.cards,
        nextCursor: result.nextCursor,
        connectionCount: result.connectionCount,
      })
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  app.get('/api/v1/feed/following', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { limit?: string; cursor?: string; filter?: string }
    const limit = Math.min(50, Math.max(1, parseInt(String(q.limit ?? '20'), 10) || 20))
    const filter = q.filter?.trim() || 'all'
    try {
      const result = await getFollowingFeed({
        viewerId: user.userId,
        limit,
        cursor: q.cursor,
        filter,
      })
      return reply.send({
        items: result.items,
        nextCursor: result.nextCursor,
        connectionCount: result.connectionCount,
      })
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  app.get('/api/v1/feed/following/counts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    try {
      const counts = await getFollowingFeedCounts(user.userId)
      return reply.send(counts)
    } catch (e) {
      if (replyIfViewerUserNotFound(e, reply)) return
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  app.post('/api/v1/feed/posts/:postId/repost', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const now = new Date()
    const [row] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: user.userId,
        kind: 'repost',
        title: null,
        body: '',
        bodyFormat: 'text',
        attachments: [],
        mentions: [],
        repostOfId: postId,
        updatedAt: now,
      })
      .returning()
    if (!row) return reply.status(500).send({ error: 'Insert failed' })
    const author = await loadAuthorProfile(user.userId)
    return reply.send({
      post: shapePostRow({
        ...row,
        username: author.username,
        avatarUrl: author.avatarUrl,
      }),
    })
  })

  app.post('/api/v1/feed/posts/:postId/like', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const meta = await setPostReaction(user.userId, postId, 'love')
    return reply.send({ liked: true, likeCount: meta.likeCount, reactionCounts: meta.reactionCounts, viewerReaction: meta.viewerReaction })
  })

  app.delete('/api/v1/feed/posts/:postId/like', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const meta = await clearPostReaction(user.userId, postId)
    return reply.send({ liked: false, likeCount: meta.likeCount, reactionCounts: meta.reactionCounts, viewerReaction: meta.viewerReaction })
  })

  const reactionBody = z.object({ kind: z.string() })

  app.put('/api/v1/feed/posts/:postId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    const parsed = reactionBody.safeParse(req.body)
    if (!parsed.success || !isFeedReactionId(parsed.data.kind)) {
      return reply.status(400).send({ error: 'Invalid reaction kind' })
    }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const meta = await setPostReaction(user.userId, postId, parsed.data.kind)
    return reply.send({
      viewerReaction: meta.viewerReaction,
      reactionCounts: meta.reactionCounts,
      likeCount: meta.likeCount,
      likedByViewer: meta.likedByViewer,
    })
  })

  app.delete('/api/v1/feed/posts/:postId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const meta = await clearPostReaction(user.userId, postId)
    return reply.send({
      viewerReaction: meta.viewerReaction,
      reactionCounts: meta.reactionCounts,
      likeCount: meta.likeCount,
      likedByViewer: meta.likedByViewer,
    })
  })

  app.get('/api/v1/feed/posts/:postId/comments', async (req, reply) => {
    if (!requireDb(reply)) return
    const { postId } = req.params as { postId: string }
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    if (!(await assertFeedPostAccessible(viewerId, postId, reply))) return
    try {
      const limit = Math.min(100, Math.max(1, parseInt(String((req.query as { limit?: string }).limit ?? '50'), 10) || 50))
      const items = await listFeedPostComments(postId, viewerId, limit)
      const commentCount = await loadFeedPostCommentCount(postId, viewerId)
      return reply.send({ items, commentCount })
    } catch (e) {
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  const commentBody = z.object({ body: z.string().min(1).max(4000) })

  app.post('/api/v1/feed/posts/:postId/comments', { ...rateLimitRoute('feedComments') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId } = req.params as { postId: string }
    const parsed = commentBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    try {
      const comment = await createFeedPostComment(postId, user.userId, parsed.data.body)
      if (!comment) return reply.status(400).send({ error: 'Invalid comment' })
      await emitFeedPostCommentActivity(user.userId, postId, parsed.data.body)
      const commentCount = await loadFeedPostCommentCount(postId, user.userId)
      return reply.send({ comment, commentCount })
    } catch (e) {
      if (isMissingDbRelationError(e)) {
        replySchemaDrift(reply)
        return
      }
      throw e
    }
  })

  app.delete('/api/v1/feed/posts/:postId/comments/:commentId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { postId, commentId } = req.params as { postId: string; commentId: string }
    if (!(await assertFeedPostAccessible(user.userId, postId, reply))) return
    const ok = await deleteFeedPostComment(commentId, user.userId)
    if (!ok) return reply.status(404).send({ error: 'Not found' })
    const commentCount = await loadFeedPostCommentCount(postId, user.userId)
    return reply.send({ ok: true, commentCount })
  })

  app.get('/api/v1/users/:username/journal', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const limit = Math.min(100, Math.max(1, parseInt(String((req.query as { limit?: string }).limit ?? '40'), 10) || 40))
    const [author] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1)
    if (!author) return reply.status(404).send({ error: 'Not found' })
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    const items = await loadJournalArticlesForUser(author.id, viewerId, limit)
    return reply.send({ items })
  })

  const feedComposerImageBody = z.object({
    quarantineKey: z.string().min(1).max(2048),
    sha256Hash: z.string().max(128).optional(),
    mimeType: z.string().max(128),
    sizeBytes: z.number().int().min(0),
    originalFilename: z.string().max(512).optional(),
    imageWidth: z.number().int().optional(),
    imageHeight: z.number().int().optional(),
  })

  app.post('/api/v1/feed/composer/image', { ...rateLimitRoute('upload') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = feedComposerImageBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const result = await prepareFeedComposerImageAttachment({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        originalFilename: parsed.data.originalFilename,
        imageWidth: parsed.data.imageWidth,
        imageHeight: parsed.data.imageHeight,
      })
      return reply.status(201).send(result)
    } catch (err) {
      const mapped = mapFeedComposerMediaError(err)
      return reply.status(mapped.status).send(mapped.body)
    }
  })

  const feedComposerAudioBody = z.object({
    quarantineKey: z.string().min(1).max(2048),
    sha256Hash: z.string().max(128).optional(),
    mimeType: z.string().max(128),
    sizeBytes: z.number().int().min(0),
    originalFilename: z.string().max(512).optional(),
    durationSeconds: z.number().int().min(0).optional(),
  })

  app.post('/api/v1/feed/composer/audio', { ...rateLimitRoute('upload') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = feedComposerAudioBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      const result = await prepareFeedComposerAudioAttachment({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        originalFilename: parsed.data.originalFilename,
        durationSeconds: parsed.data.durationSeconds,
      })
      return reply.status(201).send(result)
    } catch (err) {
      const mapped = mapFeedComposerMediaError(err)
      return reply.status(mapped.status).send(mapped.body)
    }
  })

  app.get('/api/v1/mentions/suggest', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rawQ = String((req.query as { q?: string }).q ?? '').trim().toLowerCase().slice(0, 64)
    if (rawQ.length < 1) return reply.send({ items: [] as { type: string; id: string; label: string }[] })
    const likePattern = `${rawQ}%`
    const rows = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(ilike(schema.users.username, likePattern))
      .limit(12)
    return reply.send({
      items: rows.map((r) => ({ type: 'user', id: r.id, label: r.username })),
    })
  })
}
