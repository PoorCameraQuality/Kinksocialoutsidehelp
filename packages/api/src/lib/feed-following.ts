import { normalizeFeedSettings } from '@c2k/shared'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { aggregateFollowingFeedItems } from './feed-activity-aggregate.js'
import { actorFeedActivityAllowed, loadActorFeedPrivacy } from './feed-activity-privacy-filter.js'
import {
  bucketForActivity,
  bucketForPost,
  FOLLOWING_COUNT_WINDOW_MS,
  matchesFollowingFilter,
} from './feed-following-filters.js'
import { followingFeedAudienceIds } from './following-ids.js'
import { enrichPostsWithLikeMeta } from './post-like-meta.js'
import { filterVisibleFeedAttachments, sanitizeFollowingFeedActivityItemsForViewer } from './feed-media-attachments.js'
import { filterRowsForGroupForumActivity, buildGroupForumThreadDeepLink } from './group-forum-activity.js'
import { filterRowsForEventActivity } from './event-activity.js'
import { filterRowsForConventionActivity } from './convention-activity.js'
import { extractTagIdsFromMentions, getMutedTagIds, hydrateRepostSourceTagIds, postMatchesMutedTags } from './muted-tags.js'
import { ensureUserSettingsRow } from './user-settings-row.js'
import { deliverAvatarUrl } from './image-delivery.js'

export type FollowingFeedCursor = {
  createdAt: string
  source: 'post' | 'activity'
  id: string
}

export type FollowingFeedActor = {
  id: string
  username: string
}

export type FollowingFeedItem = {
  kind: 'post' | 'activity'
  verb?: string
  cursor: string
  createdAt: string
  deepLink: string
  actor: FollowingFeedActor
  object?: Record<string, unknown>
  post?: Record<string, unknown>
}

function encodeCursor(c: FollowingFeedCursor): string {
  return Buffer.from(`${c.createdAt}|${c.source}|${c.id}`, 'utf8').toString('base64url')
}

export function decodeFollowingCursor(raw: string | undefined): FollowingFeedCursor | null {
  if (!raw?.trim()) return null
  try {
    const parts = Buffer.from(raw, 'base64url').toString('utf8').split('|')
    if (parts.length !== 3) return null
    const [createdAt, source, id] = parts
    if (!createdAt || !id || (source !== 'post' && source !== 'activity')) return null
    return { createdAt, source, id }
  } catch {
    return null
  }
}

function deepLinkForActivity(verb: string, objectType: string, objectId: string, metadata: Record<string, unknown>): string {
  if (verb === 'post' && objectType === 'feed_post') return `/feed/posts/${objectId}`
  if ((verb === 'event_created' || verb === 'event_rsvp') && objectType === 'event') return `/events/${objectId}`
  if (verb === 'connection_accepted') return '/connections'
  if (verb === 'convention_pin' && objectType === 'convention') {
    const slug = metadata.conventionSlug ?? metadata.conventionKey
    if (typeof slug === 'string') return `/conventions/${slug}`
  }
  if (verb === 'org_announcement' || verb === 'org_join') {
    const orgSlug = metadata.orgSlug
    if (typeof orgSlug === 'string') return `/orgs/${orgSlug}`
  }
  if (verb === 'group_join' && objectType === 'group') return `/groups/${objectId}`
  if (verb === 'group_thread_created' && objectType === 'forum_thread') {
    return buildGroupForumThreadDeepLink(metadata, objectId) ?? '/home'
  }
  if (
    (verb === 'loved' || verb === 'reacted' || verb === 'post_love') &&
    objectType === 'feed_post'
  ) {
    return `/feed/posts/${objectId}`
  }
  if ((verb === 'commented' || verb === 'post_comment') && objectType === 'feed_post') {
    return `/feed/posts/${objectId}`
  }
  if (verb === 'followed' && objectType === 'user') {
    const username = metadata.targetUsername
    if (typeof username === 'string' && username.trim()) {
      return `/profile/${encodeURIComponent(username.trim())}`
    }
  }
  if (verb === 'presenter_assigned' && objectType === 'schedule_slot') {
    const conventionKey = metadata.conventionKey ?? metadata.conventionSlug
    if (typeof conventionKey === 'string') return `/conventions/${conventionKey}`
  }
  if (verb === 'vendor_shop_live' && objectType === 'vendor') {
    const slug = metadata.slug
    if (typeof slug === 'string') return `/vendors/${slug}`
  }
  return '/home'
}

type MergedRow = {
  source: 'post' | 'activity'
  id: string
  createdAt: Date
  actorId: string
  username: string
  avatarUrl?: string | null
  verb?: string
  objectType?: string
  objectId?: string
  metadata?: Record<string, unknown>
  postRow?: {
    kind: string
    title: string | null
    body: string
    bodyFormat: string
    attachments: unknown
    mentions: unknown
    repostOfId: string | null
  }
}

function shapePostItem(row: MergedRow): FollowingFeedItem {
  const cursor = encodeCursor({ createdAt: row.createdAt.toISOString(), source: 'post', id: row.id })
  return {
    kind: 'post',
    verb: 'post',
    cursor,
    createdAt: row.createdAt.toISOString(),
    deepLink: `/feed/posts/${row.id}`,
    actor: { id: row.actorId, username: row.username },
    post: {
      id: row.id,
      authorId: row.actorId,
      authorUsername: row.username,
      authorAvatarUrl: deliverAvatarUrl(row.avatarUrl ?? null, 'sm'),
      kind: row.postRow?.kind,
      title: row.postRow?.title,
      body: row.postRow?.body,
      bodyFormat: row.postRow?.bodyFormat,
      attachments: row.postRow?.attachments,
      mentions: row.postRow?.mentions,
      repostOfId: row.postRow?.repostOfId,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

function shapeActivityItem(row: MergedRow): FollowingFeedItem {
  const meta = row.metadata ?? {}
  const objectType = row.objectType ?? ''
  const objectId = row.objectId ?? ''
  const verb = row.verb ?? ''
  const cursor = encodeCursor({ createdAt: row.createdAt.toISOString(), source: 'activity', id: row.id })
  return {
    kind: 'activity',
    verb,
    cursor,
    createdAt: row.createdAt.toISOString(),
    deepLink: deepLinkForActivity(verb, objectType, objectId, meta),
    actor: { id: row.actorId, username: row.username },
    object: {
      type: objectType,
      id: objectId,
      ...meta,
    },
  }
}

function beforeCursor(row: MergedRow, cursor: FollowingFeedCursor): boolean {
  const rowIso = row.createdAt.toISOString()
  if (rowIso < cursor.createdAt) return true
  if (rowIso > cursor.createdAt) return false
  if (row.source !== cursor.source) return row.source === 'activity' && cursor.source === 'post'
  return row.id < cursor.id
}

export async function getFollowingFeed(params: {
  viewerId: string
  limit: number
  cursor?: string
  filter?: string
}): Promise<{ items: FollowingFeedItem[]; nextCursor: string | null; connectionCount: number }> {
  const ids = await followingFeedAudienceIds(params.viewerId)
  const connectionCount = ids.length
  if (ids.length === 0) {
    return { items: [], nextCursor: null, connectionCount: 0 }
  }
  const decoded = decodeFollowingCursor(params.cursor)
  const settingsRow = await ensureUserSettingsRow(params.viewerId)
  const feedSettings = normalizeFeedSettings(settingsRow.feedSettings)
  const hideKinds = new Set<string>(feedSettings.hideStoryTypes)
  if (!feedSettings.showConnectionShares) hideKinds.add('repost')
  if (!feedSettings.showConnectionLikes) hideKinds.add('connection_like')
  const mutedTagIds = await getMutedTagIds(params.viewerId)
  // Privacy checks still treat accepted connections + follows as the viewer's network.
  // Viewer is intentionally omitted from the SQL audience so own posts never appear here.
  const connectionSet = new Set(ids)

  const fetchLimit = Math.min(120, params.limit * 4)

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
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.feedPosts)
    .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.feedPosts.authorId, ids))
    .orderBy(desc(schema.feedPosts.createdAt))
    .limit(fetchLimit)

  const activityRows = await db
    .select({
      id: schema.feedActivities.id,
      actorId: schema.feedActivities.actorId,
      verb: schema.feedActivities.verb,
      objectType: schema.feedActivities.objectType,
      objectId: schema.feedActivities.objectId,
      metadata: schema.feedActivities.metadata,
      createdAt: schema.feedActivities.createdAt,
      username: schema.users.username,
    })
    .from(schema.feedActivities)
    .innerJoin(schema.users, eq(schema.feedActivities.actorId, schema.users.id))
    .where(inArray(schema.feedActivities.actorId, ids))
    .orderBy(desc(schema.feedActivities.createdAt))
    .limit(fetchLimit)

  const privacyByActor = await loadActorFeedPrivacy([
    ...new Set([...postRows.map((p) => p.authorId), ...activityRows.map((a) => a.actorId)]),
  ])

  const tagIdsByPostId = new Map<string, string[]>()
  for (const p of postRows) {
    tagIdsByPostId.set(p.id, extractTagIdsFromMentions(p.mentions))
  }
  await hydrateRepostSourceTagIds(
    tagIdsByPostId,
    postRows.map((p) => p.repostOfId),
  )

  const merged: MergedRow[] = []

  for (const p of postRows) {
    if (
      !actorFeedActivityAllowed({
        actorId: p.authorId,
        verb: 'post',
        source: 'post',
        viewerId: params.viewerId,
        viewerConnectionIds: connectionSet,
        privacyByActor,
      })
    ) {
      continue
    }
    const inheritedTags = p.repostOfId ? tagIdsByPostId.get(p.repostOfId) : undefined
    if (postMatchesMutedTags(p.mentions, mutedTagIds, inheritedTags)) continue
    if (
      !matchesFollowingFilter('post', params.filter ?? 'all', hideKinds, {
        postKind: p.kind,
        attachments: p.attachments,
        body: p.body,
        bodyFormat: p.bodyFormat,
      })
    ) {
      continue
    }
    merged.push({
      source: 'post',
      id: p.id,
      createdAt: p.createdAt,
      actorId: p.authorId,
      username: p.username,
      avatarUrl: p.avatarUrl,
      verb: 'post',
      postRow: {
        kind: p.kind,
        title: p.title,
        body: p.body,
        bodyFormat: p.bodyFormat,
        attachments: p.attachments,
        mentions: p.mentions,
        repostOfId: p.repostOfId,
      },
    })
  }

  for (const a of activityRows) {
    if (
      !actorFeedActivityAllowed({
        actorId: a.actorId,
        verb: a.verb,
        source: 'activity',
        viewerId: params.viewerId,
        viewerConnectionIds: connectionSet,
        privacyByActor,
      })
    ) {
      continue
    }
    if (!matchesFollowingFilter('activity', params.filter ?? 'all', hideKinds, {
      verb: a.verb,
      objectType: a.objectType,
    })) {
      continue
    }
    merged.push({
      source: 'activity',
      id: a.id,
      createdAt: a.createdAt,
      actorId: a.actorId,
      username: a.username,
      verb: a.verb,
      objectType: a.objectType,
      objectId: a.objectId,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    })
  }

  merged.sort((a, b) => {
    const t = b.createdAt.getTime() - a.createdAt.getTime()
    if (t !== 0) return t
    if (a.source !== b.source) return a.source === 'activity' ? -1 : 1
    return b.id.localeCompare(a.id)
  })

  let visibleMerged = await filterRowsForGroupForumActivity(params.viewerId, merged)
  visibleMerged = await filterRowsForEventActivity(params.viewerId, visibleMerged)
  visibleMerged = await filterRowsForConventionActivity(params.viewerId, visibleMerged)

  const filtered = decoded ? visibleMerged.filter((row) => beforeCursor(row, decoded)) : visibleMerged
  const page = filtered.slice(0, params.limit)
  let items = page.map((row) => (row.source === 'post' ? shapePostItem(row) : shapeActivityItem(row)))

  const postIds = items.filter((item) => item.kind === 'post' && item.post?.id).map((item) => String(item.post!.id))
  if (postIds.length > 0) {
    const likeMeta = await enrichPostsWithLikeMeta(params.viewerId, postIds, { includeConnectionPreview: true })
    items = items.map((item) => {
      if (item.kind !== 'post' || !item.post?.id) return item
      const meta = likeMeta.get(String(item.post.id))
      if (!meta) return item
      return {
        ...item,
        post: {
          ...item.post,
          likeCount: meta.likeCount,
          likedByViewer: meta.likedByViewer,
          reactionCounts: meta.reactionCounts,
          viewerReaction: meta.viewerReaction,
          commentCount: meta.commentCount,
          commentPreview: meta.commentPreview,
          connectionLikerPreview: meta.connectionLikerPreview,
        },
      }
    })
  }

  items = aggregateFollowingFeedItems(items)

  items = await sanitizeFollowingFeedActivityItemsForViewer(params.viewerId, items)

  items = await Promise.all(
    items.map(async (item) => {
      if (item.kind !== 'post' || !item.post) return item
      return {
        ...item,
        post: {
          ...item.post,
          attachments: await filterVisibleFeedAttachments(params.viewerId, item.post.attachments),
        },
      }
    }),
  )

  const last = page[page.length - 1]
  const nextCursor =
    filtered.length > params.limit && last ?
      encodeCursor({ createdAt: last.createdAt.toISOString(), source: last.source, id: last.id })
    : null

  return { items, nextCursor, connectionCount }
}

export type FollowingFeedCounts = {
  all: number
  posts: number
  photos: number
  video: number
  articles: number
  reactions: number
  events: number
  groups: number
}

/** Count feed items in the last 7 days per filter bucket (same hide/dedup rules as read path). */
export async function getFollowingFeedCounts(viewerId: string): Promise<FollowingFeedCounts> {
  const ids = await followingFeedAudienceIds(viewerId)
  const since = new Date(Date.now() - FOLLOWING_COUNT_WINDOW_MS)
  const settingsRow = await ensureUserSettingsRow(viewerId)
  const feedSettings = normalizeFeedSettings(settingsRow.feedSettings)
  const hideKinds = new Set<string>(feedSettings.hideStoryTypes)
  if (!feedSettings.showConnectionShares) hideKinds.add('repost')
  if (!feedSettings.showConnectionLikes) hideKinds.add('connection_like')
  const mutedTagIds = await getMutedTagIds(viewerId)

  const counts: FollowingFeedCounts = {
    all: 0,
    posts: 0,
    photos: 0,
    video: 0,
    articles: 0,
    reactions: 0,
    events: 0,
    groups: 0,
  }

  if (ids.length === 0) return counts

  const postRows = await db
    .select({
      id: schema.feedPosts.id,
      authorId: schema.feedPosts.authorId,
      kind: schema.feedPosts.kind,
      body: schema.feedPosts.body,
      bodyFormat: schema.feedPosts.bodyFormat,
      attachments: schema.feedPosts.attachments,
      mentions: schema.feedPosts.mentions,
      repostOfId: schema.feedPosts.repostOfId,
      createdAt: schema.feedPosts.createdAt,
    })
    .from(schema.feedPosts)
    .where(and(inArray(schema.feedPosts.authorId, ids), gte(schema.feedPosts.createdAt, since)))

  const tagIdsByPostId = new Map<string, string[]>()
  for (const p of postRows) {
    tagIdsByPostId.set(p.id, extractTagIdsFromMentions(p.mentions))
  }
  await hydrateRepostSourceTagIds(
    tagIdsByPostId,
    postRows.map((p) => p.repostOfId),
  )

  const activityRows = await db
    .select({
      id: schema.feedActivities.id,
      verb: schema.feedActivities.verb,
      objectType: schema.feedActivities.objectType,
      objectId: schema.feedActivities.objectId,
      metadata: schema.feedActivities.metadata,
      actorId: schema.feedActivities.actorId,
      createdAt: schema.feedActivities.createdAt,
    })
    .from(schema.feedActivities)
    .where(and(inArray(schema.feedActivities.actorId, ids), gte(schema.feedActivities.createdAt, since)))

  const countConnectionSet = new Set(ids)
  const countPrivacyByActor = await loadActorFeedPrivacy([
    ...new Set([
      ...postRows.map((p) => p.authorId),
      ...activityRows.map((a) => a.actorId),
    ]),
  ])

  for (const p of postRows) {
    if (
      !actorFeedActivityAllowed({
        actorId: p.authorId,
        verb: 'post',
        source: 'post',
        viewerId,
        viewerConnectionIds: countConnectionSet,
        privacyByActor: countPrivacyByActor,
      })
    ) {
      continue
    }
    const inheritedTags = p.repostOfId ? tagIdsByPostId.get(p.repostOfId) : undefined
    if (postMatchesMutedTags(p.mentions, mutedTagIds, inheritedTags)) continue
    const shape = {
      postKind: p.kind,
      attachments: p.attachments,
      body: p.body,
      bodyFormat: p.bodyFormat,
    }
    if (!matchesFollowingFilter('post', 'all', hideKinds, shape)) continue
    counts.all++
    counts.posts++
    const bucket = bucketForPost(shape)
    if (bucket === 'photos' || bucket === 'video' || bucket === 'articles') counts[bucket]++
  }

  const activityCountCandidates: Array<{
    id: string
    actorId: string
    verb: string
    objectId?: string
    metadata?: Record<string, unknown>
  }> = []

  for (const a of activityRows) {
    if (
      !actorFeedActivityAllowed({
        actorId: a.actorId,
        verb: a.verb,
        source: 'activity',
        viewerId,
        viewerConnectionIds: countConnectionSet,
        privacyByActor: countPrivacyByActor,
      })
    ) {
      continue
    }
    if (!matchesFollowingFilter('activity', 'all', hideKinds, { verb: a.verb, objectType: a.objectType })) {
      continue
    }
    activityCountCandidates.push({
      id: a.id,
      actorId: a.actorId,
      verb: a.verb,
      objectId: a.objectId,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    })
  }

  let visibleActivities = await filterRowsForGroupForumActivity(viewerId, activityCountCandidates)
  visibleActivities = await filterRowsForEventActivity(viewerId, visibleActivities)
  visibleActivities = await filterRowsForConventionActivity(viewerId, visibleActivities)
  const visibleActivityIds = new Set(visibleActivities.map((r) => r.id))

  for (const a of activityRows) {
    if (!visibleActivityIds.has(a.id)) continue
    counts.all++
    const bucket = bucketForActivity(a.verb)
    if (bucket) counts[bucket]++
  }

  return counts
}
