import {
  MEDIA_VISIBILITIES,
  canActorActivityAppearInFeed,
  defaultFeedActivityPrivacy,
} from '@c2k/shared'
import { and, count, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from './accepted-friends.js'
import { loadActorFeedPrivacy } from './feed-activity-privacy-filter.js'

export type DiscoveryProfileStats = {
  photoCount: number
  videoCount: number
  writingCount: number
  groupsLedCount: number
}

const EMPTY_STATS: DiscoveryProfileStats = {
  photoCount: 0,
  videoCount: 0,
  writingCount: 0,
  groupsLedCount: 0,
}

/**
 * PR 3 (P2): directory cards must only count broadly visible media. Followers/
 * private/scoped/staff media stay out of counts shown to other members.
 */
const BROADLY_VISIBLE_MEDIA = [MEDIA_VISIBILITIES.publicPreview, MEDIA_VISIBILITIES.loggedIn]

function rowsToCountMap(rows: { userId: string; n: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.userId, Number(r.n)]))
}

function mediaCountWhere(userIds: string[], mediaKind: 'image' | 'video', visibleOnly: boolean): SQL | undefined {
  const conditions = [
    inArray(schema.mediaItems.ownerUserId, userIds),
    eq(schema.mediaItems.mediaKind, mediaKind),
    isNull(schema.mediaItems.deletedAt),
  ]
  if (visibleOnly) {
    conditions.push(inArray(schema.mediaItems.visibility, BROADLY_VISIBLE_MEDIA))
  }
  return and(...conditions)
}

/**
 * Public-ish activity counts for people directory cards (batch).
 * Non-owner viewers get counts restricted to what they could actually browse:
 * broadly visible media and posts allowed by the author's feed privacy (P2).
 * The viewer's own card keeps full counts.
 */
export async function loadDiscoveryProfileStats(
  userIds: string[],
  viewerUserId: string | null = null,
): Promise<Map<string, DiscoveryProfileStats>> {
  if (userIds.length === 0) return new Map()

  const [photoRows, videoRows, feedRows, articleRows, groupLeadRows, privacyByAuthor, viewerConnections] =
    await Promise.all([
      db
        .select({ userId: schema.mediaItems.ownerUserId, n: count(schema.mediaItems.id).as('n') })
        .from(schema.mediaItems)
        .where(mediaCountWhere(userIds, 'image', true))
        .groupBy(schema.mediaItems.ownerUserId),
      db
        .select({ userId: schema.mediaItems.ownerUserId, n: count(schema.mediaItems.id).as('n') })
        .from(schema.mediaItems)
        .where(mediaCountWhere(userIds, 'video', true))
        .groupBy(schema.mediaItems.ownerUserId),
      db
        .select({ userId: schema.feedPosts.authorId, n: count(schema.feedPosts.id).as('n') })
        .from(schema.feedPosts)
        .where(inArray(schema.feedPosts.authorId, userIds))
        .groupBy(schema.feedPosts.authorId),
      db
        .select({ userId: schema.educationArticles.authorUserId, n: count(schema.educationArticles.id).as('n') })
        .from(schema.educationArticles)
        .where(
          and(
            inArray(schema.educationArticles.authorUserId, userIds),
            eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
          ),
        )
        .groupBy(schema.educationArticles.authorUserId),
      db
        .select({ userId: schema.groupMembers.userId, n: count(schema.groupMembers.id).as('n') })
        .from(schema.groupMembers)
        .where(
          and(
            inArray(schema.groupMembers.userId, userIds),
            or(
              eq(schema.groupMembers.role, 'owner'),
              eq(schema.groupMembers.role, 'admin'),
              eq(schema.groupMembers.role, 'moderator'),
            ),
          ),
        )
        .groupBy(schema.groupMembers.userId),
      loadActorFeedPrivacy(userIds),
      viewerUserId ? loadAcceptedFriendUserIds(viewerUserId) : Promise.resolve(new Set<string>()),
    ])

  const photos = rowsToCountMap(photoRows.map((r) => ({ userId: r.userId, n: Number(r.n) })))
  const videos = rowsToCountMap(videoRows.map((r) => ({ userId: r.userId, n: Number(r.n) })))
  const feeds = rowsToCountMap(feedRows.map((r) => ({ userId: r.userId, n: Number(r.n) })))
  const articles = rowsToCountMap(articleRows.map((r) => ({ userId: r.userId, n: Number(r.n) })))
  const groupsLed = rowsToCountMap(groupLeadRows.map((r) => ({ userId: r.userId, n: Number(r.n) })))

  const out = new Map<string, DiscoveryProfileStats>()
  for (const userId of userIds) {
    // P2: post counts respect the author's feed privacy for this viewer.
    const privacy = privacyByAuthor.get(userId) ?? defaultFeedActivityPrivacy
    const postsVisible =
      userId === viewerUserId ||
      canActorActivityAppearInFeed(privacy, 'posted', {
        viewerFollowsActor: viewerConnections.has(userId),
      })
    out.set(userId, {
      photoCount: photos.get(userId) ?? 0,
      videoCount: videos.get(userId) ?? 0,
      writingCount: (postsVisible ? (feeds.get(userId) ?? 0) : 0) + (articles.get(userId) ?? 0),
      groupsLedCount: groupsLed.get(userId) ?? 0,
    })
  }

  // The viewer's own card shows their full media library counts.
  if (viewerUserId && userIds.includes(viewerUserId)) {
    const [ownPhotos, ownVideos] = await Promise.all([
      db
        .select({ n: count(schema.mediaItems.id).as('n') })
        .from(schema.mediaItems)
        .where(mediaCountWhere([viewerUserId], 'image', false)),
      db
        .select({ n: count(schema.mediaItems.id).as('n') })
        .from(schema.mediaItems)
        .where(mediaCountWhere([viewerUserId], 'video', false)),
    ])
    const existing = out.get(viewerUserId) ?? EMPTY_STATS
    out.set(viewerUserId, {
      ...existing,
      photoCount: Number(ownPhotos[0]?.n ?? 0),
      videoCount: Number(ownVideos[0]?.n ?? 0),
    })
  }

  return out
}

export function mergeDiscoveryProfileStats(
  card: { userId: string },
  statsMap: Map<string, DiscoveryProfileStats>,
): DiscoveryProfileStats {
  return statsMap.get(card.userId) ?? EMPTY_STATS
}
