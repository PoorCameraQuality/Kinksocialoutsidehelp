import { and, desc, eq, inArray } from 'drizzle-orm'
import { applyEventLocationRedaction, physicalLocationDetailVisibleEventIds } from '../lib/physical-location-visibility.js'
import { virtualJoinLinkVisibleEventIds } from '../lib/virtual-event-join-visibility.js'
import { filterRowsForGlobalFeed, viewerCanAccessFeedPostById } from '../lib/feed-post-access.js'
import { filterVisibleFeedAttachments } from '../lib/feed-media-attachments.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'

const BOOKMARK_OBJECT_TYPES = ['feed_post', 'education_article', 'media_show', 'media_episode', 'event'] as const
const bookmarkObjectTypeSchema = z.enum(BOOKMARK_OBJECT_TYPES)

const bookmarkBodySchema = z.object({
  objectType: bookmarkObjectTypeSchema,
  objectId: z.string().uuid(),
})

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
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
}) {
  return {
    id: row.id,
    authorId: row.authorId,
    authorUsername: row.username,
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

async function viewerCanBookmarkEvent(eventId: string, userId: string): Promise<boolean> {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
  if (!event) return false
  if (event.visibility === 'public') return true
  if (event.hostId === userId) return true
  const [rsvp] = await db
    .select({ id: schema.eventRsvps.id })
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)))
    .limit(1)
  return Boolean(rsvp)
}

async function assertBookmarkTarget(
  objectType: (typeof BOOKMARK_OBJECT_TYPES)[number],
  objectId: string,
  userId: string,
) {
  if (objectType === 'feed_post') {
    return viewerCanAccessFeedPostById(userId, objectId)
  }
  if (objectType === 'education_article') {
    const [row] = await db
      .select({ id: schema.educationArticles.id, publicationStatus: schema.educationArticles.publicationStatus })
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.id, objectId))
      .limit(1)
    return !!row && row.publicationStatus === 'PUBLISHED'
  }
  if (objectType === 'media_show') {
    const [row] = await db
      .select({ id: schema.mediaShows.id, publicationStatus: schema.mediaShows.publicationStatus, listInMedia: schema.mediaShows.listInMedia })
      .from(schema.mediaShows)
      .where(eq(schema.mediaShows.id, objectId))
      .limit(1)
    return !!row && row.publicationStatus === 'PUBLISHED' && row.listInMedia
  }
  if (objectType === 'media_episode') {
    const [row] = await db
      .select({ id: schema.mediaShowEpisodes.id, showId: schema.mediaShowEpisodes.showId })
      .from(schema.mediaShowEpisodes)
      .where(eq(schema.mediaShowEpisodes.id, objectId))
      .limit(1)
    if (!row) return false
    const [show] = await db
      .select({ publicationStatus: schema.mediaShows.publicationStatus, listInMedia: schema.mediaShows.listInMedia })
      .from(schema.mediaShows)
      .where(eq(schema.mediaShows.id, row.showId))
      .limit(1)
    return !!show && show.publicationStatus === 'PUBLISHED' && show.listInMedia
  }
  if (objectType === 'event') {
    return viewerCanBookmarkEvent(objectId, userId)
  }
  return false
}

export async function registerBookmarkRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/bookmarks', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const rows = await db
      .select({
        objectType: schema.userBookmarks.objectType,
        objectId: schema.userBookmarks.objectId,
        createdAt: schema.userBookmarks.createdAt,
      })
      .from(schema.userBookmarks)
      .where(eq(schema.userBookmarks.userId, user.userId))
      .orderBy(desc(schema.userBookmarks.createdAt))

    const postIds = rows.filter((r) => r.objectType === 'feed_post').map((r) => r.objectId)
    const articleIds = rows.filter((r) => r.objectType === 'education_article').map((r) => r.objectId)
    const mediaShowIds = rows.filter((r) => r.objectType === 'media_show').map((r) => r.objectId)
    const mediaEpisodeIds = rows.filter((r) => r.objectType === 'media_episode').map((r) => r.objectId)
    const eventIds = rows.filter((r) => r.objectType === 'event').map((r) => r.objectId)
    const postsById = new Map<string, ReturnType<typeof shapePostRow>>()
    const articlesById = new Map<
      string,
      {
        id: string
        slug: string
        title: string
        excerpt: string | null
        heroImageUrl: string | null
        authorUsername: string
      }
    >()
    if (postIds.length > 0) {
      const postRows = await db
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
        })
        .from(schema.feedPosts)
        .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
        .where(inArray(schema.feedPosts.id, postIds))
      const visibleRows = await filterRowsForGlobalFeed(user.userId, postRows)
      for (const row of visibleRows) {
        const shaped = shapePostRow(row)
        shaped.attachments = await filterVisibleFeedAttachments(user.userId, shaped.attachments)
        postsById.set(row.id, shaped)
      }
    }

    if (articleIds.length > 0) {
      const articleRows = await db
        .select({
          id: schema.educationArticles.id,
          slug: schema.educationArticles.slug,
          title: schema.educationArticles.title,
          excerpt: schema.educationArticles.excerpt,
          heroImageUrl: schema.educationArticles.heroImageUrl,
          username: schema.users.username,
        })
        .from(schema.educationArticles)
        .innerJoin(schema.users, eq(schema.educationArticles.authorUserId, schema.users.id))
        .where(inArray(schema.educationArticles.id, articleIds))
      for (const row of articleRows) {
        articlesById.set(row.id, {
          id: row.id,
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          heroImageUrl: row.heroImageUrl,
          authorUsername: row.username,
        })
      }
    }

    const mediaShowsById = new Map<
      string,
      { id: string; slug: string; title: string; coverImageUrl: string | null; mediaFormat: string }
    >()
    const mediaEpisodesById = new Map<
      string,
      {
        id: string
        slug: string
        title: string
        showSlug: string
        showTitle: string
      }
    >()
    if (mediaShowIds.length > 0) {
      const showRows = await db
        .select({
          id: schema.mediaShows.id,
          slug: schema.mediaShows.slug,
          title: schema.mediaShows.title,
          coverImageUrl: schema.mediaShows.coverImageUrl,
          mediaFormat: schema.mediaShows.mediaFormat,
        })
        .from(schema.mediaShows)
        .where(inArray(schema.mediaShows.id, mediaShowIds))
      for (const row of showRows) {
        mediaShowsById.set(row.id, row)
      }
    }
    if (mediaEpisodeIds.length > 0) {
      const epRows = await db
        .select({
          id: schema.mediaShowEpisodes.id,
          slug: schema.mediaShowEpisodes.slug,
          title: schema.mediaShowEpisodes.title,
          showSlug: schema.mediaShows.slug,
          showTitle: schema.mediaShows.title,
        })
        .from(schema.mediaShowEpisodes)
        .innerJoin(schema.mediaShows, eq(schema.mediaShows.id, schema.mediaShowEpisodes.showId))
        .where(inArray(schema.mediaShowEpisodes.id, mediaEpisodeIds))
      for (const row of epRows) {
        mediaEpisodesById.set(row.id, row)
      }
    }

    const eventsById = new Map<
      string,
      {
        id: string
        title: string
        startsAt: string
        endsAt: string | null
        imageUrl: string | null
        eventFormat: string | null
        location: string | null
        publicLocationSummary: string | null
        locationRedacted: boolean
        joinLinkRedacted: boolean
        rsvpCount: number
      }
    >()
    if (eventIds.length > 0) {
      const eventRows = await db
        .select({
          id: schema.events.id,
          hostId: schema.events.hostId,
          organizationId: schema.events.organizationId,
          title: schema.events.title,
          startsAt: schema.events.startsAt,
          endsAt: schema.events.endsAt,
          imageUrl: schema.events.imageUrl,
          eventFormat: schema.events.eventFormat,
          location: schema.events.location,
          locationVisibility: schema.events.locationVisibility,
          publicLocationSummary: schema.events.publicLocationSummary,
          rsvpCount: schema.events.rsvpCount,
        })
        .from(schema.events)
        .where(inArray(schema.events.id, eventIds))
      const joinVisible = await virtualJoinLinkVisibleEventIds(
        user.userId,
        eventRows.map((r) => ({
          id: r.id,
          hostId: r.hostId,
          organizationId: r.organizationId,
          eventFormat: r.eventFormat,
        })),
      )
      const physicalVisible = await physicalLocationDetailVisibleEventIds(
        user.userId,
        eventRows.map((r) => ({
          id: r.id,
          hostId: r.hostId,
          organizationId: r.organizationId,
          eventFormat: r.eventFormat,
          locationVisibility: r.locationVisibility ?? 'public',
        })),
      )
      for (const row of eventRows) {
        const shaped = applyEventLocationRedaction(row, joinVisible, physicalVisible)
        eventsById.set(row.id, {
          id: row.id,
          title: row.title,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt?.toISOString() ?? null,
          imageUrl: row.imageUrl,
          eventFormat: row.eventFormat,
          location: shaped.location,
          publicLocationSummary: row.publicLocationSummary,
          locationRedacted: shaped.locationRedacted,
          joinLinkRedacted: shaped.joinLinkRedacted,
          rsvpCount: row.rsvpCount ?? 0,
        })
      }
    }

    const items = rows.map((row) => ({
      objectType: row.objectType,
      objectId: row.objectId,
      createdAt: row.createdAt.toISOString(),
      post: row.objectType === 'feed_post' ? (postsById.get(row.objectId) ?? null) : null,
      article: row.objectType === 'education_article' ? (articlesById.get(row.objectId) ?? null) : null,
      mediaShow: row.objectType === 'media_show' ? (mediaShowsById.get(row.objectId) ?? null) : null,
      mediaEpisode: row.objectType === 'media_episode' ? (mediaEpisodesById.get(row.objectId) ?? null) : null,
      event: row.objectType === 'event' ? (eventsById.get(row.objectId) ?? null) : null,
    }))

    return reply.send({ items })
  })

  app.post('/api/v1/me/bookmarks', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = bookmarkBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const { objectType, objectId } = parsed.data
    const exists = await assertBookmarkTarget(objectType, objectId, user.userId)
    if (!exists) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const now = new Date()
    await db
      .insert(schema.userBookmarks)
      .values({
        userId: user.userId,
        objectType,
        objectId,
        createdAt: now,
      })
      .onConflictDoNothing()
    return reply.send({ objectType, objectId, saved: true })
  })

  app.delete('/api/v1/me/bookmarks', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = bookmarkBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const { objectType, objectId } = parsed.data
    await db
      .delete(schema.userBookmarks)
      .where(
        and(
          eq(schema.userBookmarks.userId, user.userId),
          eq(schema.userBookmarks.objectType, objectType),
          eq(schema.userBookmarks.objectId, objectId),
        ),
      )
    return reply.send({ objectType, objectId, saved: false })
  })
}
