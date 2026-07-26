import { and, count, desc, eq, gte, inArray, isNull, lte, ne, notLike, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadActiveMemberCounts } from './group-list-enrichment.js'
import {
  extractTagIdsFromMentions,
  getMutedTagIds,
  hydrateRepostSourceTagIds,
  postMatchesMutedTags,
} from './muted-tags.js'
import {
  applyTypeCaps,
  eventScoringAnchor,
  scoreV1,
  TRENDING_SCHEMA_VERSION,
  type ScoredTrendingItem,
  type TrendingCandidate,
} from './trending-score.js'
import { deliverAvatarUrl, deliverCardImageUrl } from './image-delivery.js'

export type TrendingItemDto = {
  kind: string
  id: string
  title: string
  subtitle?: string
  href: string
  imageUrl?: string | null
  audioPreviewUrl?: string | null
  scoreSchemaVersion: number
  score?: number
}

const MS_HOUR = 60 * 60 * 1000
const MS_DAY = 24 * MS_HOUR

function plainTextExcerpt(raw: string, maxLen: number): string {
  const stripped = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!stripped) return 'Post'
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped
}

function pickNonEmptyUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

/** First image/audio preview from feed post attachments (legacy + media pipeline). */
export function trendingMediaFromAttachments(raw: unknown): {
  imageUrl: string | null
  audioPreviewUrl: string | null
} {
  let imageUrl: string | null = null
  let audioPreviewUrl: string | null = null
  if (!Array.isArray(raw)) return { imageUrl, audioPreviewUrl }

  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as {
      type?: unknown
      url?: unknown
      mediaKind?: unknown
      previewUrl?: unknown
      blurredPreviewUrl?: unknown
      posterUrl?: unknown
    }

    if (o.type === 'image' && !imageUrl) {
      imageUrl = pickNonEmptyUrl(o.url)
      continue
    }
    if (o.type === 'audio' && !audioPreviewUrl) {
      audioPreviewUrl = pickNonEmptyUrl(o.url)
      continue
    }
    if (o.type === 'video' && !imageUrl) {
      imageUrl = pickNonEmptyUrl(o.posterUrl, o.url)
      continue
    }
    if (o.type === 'media') {
      if (o.mediaKind === 'image' && !imageUrl) {
        imageUrl = pickNonEmptyUrl(o.previewUrl, o.blurredPreviewUrl)
      } else if (o.mediaKind === 'audio' && !audioPreviewUrl) {
        audioPreviewUrl = pickNonEmptyUrl(o.previewUrl, o.url)
      } else if (o.mediaKind === 'video' && !imageUrl) {
        imageUrl = pickNonEmptyUrl(o.previewUrl, o.blurredPreviewUrl, o.posterUrl)
      }
    }
  }

  return { imageUrl, audioPreviewUrl }
}

type RankedCandidate = TrendingCandidate & {
  cardKind: string
  title: string
  subtitle?: string
  href: string
  imageUrl?: string | null
  audioPreviewUrl?: string | null
}

type ScoredRankedItem = RankedCandidate & { score: number }

function capKey(kind: string, id: string): string {
  return `${kind}:${id}`
}

async function loadLikeCounts(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map()
  const rows = await db
    .select({ postId: schema.postLikes.postId, n: count(schema.postLikes.postId).as('n') })
    .from(schema.postLikes)
    .where(inArray(schema.postLikes.postId, postIds))
    .groupBy(schema.postLikes.postId)
  return new Map(rows.map((r) => [r.postId, Number(r.n)]))
}

async function loadRepostCounts(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map()
  const rows = await db
    .select({ repostOfId: schema.feedPosts.repostOfId, n: count(schema.feedPosts.id).as('n') })
    .from(schema.feedPosts)
    .where(and(inArray(schema.feedPosts.repostOfId, postIds), notLike(schema.feedPosts.body, 'e2e-%')))
    .groupBy(schema.feedPosts.repostOfId)
  const out = new Map<string, number>()
  for (const row of rows) {
    if (row.repostOfId) out.set(row.repostOfId, Number(row.n))
  }
  return out
}

async function loadRsvpVelocity(eventIds: string[], since: Date): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()
  const rows = await db
    .select({ eventId: schema.eventRsvps.eventId, n: count(schema.eventRsvps.id).as('n') })
    .from(schema.eventRsvps)
    .where(
      and(
        inArray(schema.eventRsvps.eventId, eventIds),
        gte(schema.eventRsvps.createdAt, since),
        inArray(schema.eventRsvps.status, ['going', 'maybe']),
      ),
    )
    .groupBy(schema.eventRsvps.eventId)
  return new Map(rows.map((r) => [r.eventId, Number(r.n) / 24]))
}

async function loadSeriesArticleIds(articleIds: string[]): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set()
  const rows = await db
    .select({ articleId: schema.educationArticleSeriesItems.articleId })
    .from(schema.educationArticleSeriesItems)
    .innerJoin(
      schema.educationArticleSeries,
      eq(schema.educationArticleSeriesItems.seriesId, schema.educationArticleSeries.id),
    )
    .where(
      and(
        inArray(schema.educationArticleSeriesItems.articleId, articleIds),
        eq(schema.educationArticleSeries.listInEducation, true),
      ),
    )
  return new Set(rows.map((r) => r.articleId))
}

async function filterPostsForViewer(
  rows: Array<{
    id: string
    kind: string
    mentions: unknown
    repostOfId: string | null
  }>,
  viewerId: string | null | undefined,
): Promise<Set<string>> {
  const allowed = new Set<string>()
  if (!viewerId) {
    for (const row of rows) allowed.add(row.id)
    return allowed
  }
  const mutedTagIds = await getMutedTagIds(viewerId)
  const tagIdsByPostId = new Map<string, string[]>()
  for (const row of rows) {
    tagIdsByPostId.set(row.id, extractTagIdsFromMentions(row.mentions))
  }
  await hydrateRepostSourceTagIds(
    tagIdsByPostId,
    rows.map((r) => r.repostOfId),
  )
  for (const row of rows) {
    const inheritedTags = row.repostOfId ? tagIdsByPostId.get(row.repostOfId) : undefined
    if (postMatchesMutedTags(row.mentions, mutedTagIds, inheritedTags)) continue
    allowed.add(row.id)
  }
  return allowed
}

export async function fetchTrendingItems(options: {
  limit: number
  viewerId?: string | null
  debug?: boolean
}): Promise<TrendingItemDto[]> {
  const { limit, viewerId, debug = false } = options
  const now = new Date()
  const postCutoff = new Date(now.getTime() - 14 * MS_DAY)
  const mixedCutoff = new Date(now.getTime() - 90 * MS_DAY)
  const eventStartMin = new Date(now.getTime() - 3 * MS_DAY)
  const eventStartMax = new Date(now.getTime() + 90 * MS_DAY)
  const rsvpSince = new Date(now.getTime() - MS_DAY)
  const poolLimit = Math.min(200, Math.max(limit * 4, 80))

  const [postRows, eventRows, educationRows, groupRows, vendorRows] = await Promise.all([
    db
      .select({
        id: schema.feedPosts.id,
        kind: schema.feedPosts.kind,
        title: schema.feedPosts.title,
        body: schema.feedPosts.body,
        attachments: schema.feedPosts.attachments,
        mentions: schema.feedPosts.mentions,
        repostOfId: schema.feedPosts.repostOfId,
        createdAt: schema.feedPosts.createdAt,
        username: schema.users.username,
      })
      .from(schema.feedPosts)
      .innerJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
      .where(
        and(
          notLike(schema.feedPosts.body, 'e2e-%'),
          gte(schema.feedPosts.createdAt, postCutoff),
          ne(schema.feedPosts.kind, 'repost'),
        ),
      )
      .orderBy(desc(schema.feedPosts.createdAt))
      .limit(poolLimit),
    db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        location: schema.events.location,
        startsAt: schema.events.startsAt,
        createdAt: schema.events.createdAt,
        imageUrl: schema.events.imageUrl,
        featured: schema.events.featured,
      })
      .from(schema.events)
      .where(
        and(
          eq(schema.events.visibility, 'public'),
          gte(schema.events.startsAt, eventStartMin),
          lte(schema.events.startsAt, eventStartMax),
        ),
      )
      .orderBy(desc(schema.events.startsAt))
      .limit(poolLimit),
    db
      .select({
        id: schema.educationArticles.id,
        slug: schema.educationArticles.slug,
        title: schema.educationArticles.title,
        excerpt: schema.educationArticles.excerpt,
        heroImageUrl: schema.educationArticles.heroImageUrl,
        publishedAt: schema.educationArticles.publishedAt,
        updatedAt: schema.educationArticles.updatedAt,
        username: schema.users.username,
      })
      .from(schema.educationArticles)
      .innerJoin(schema.users, eq(schema.educationArticles.authorUserId, schema.users.id))
      .where(
        and(
          eq(schema.educationArticles.listInEducation, true),
          eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
          eq(schema.educationArticles.visibility, 'PUBLIC'),
          or(
            gte(schema.educationArticles.publishedAt, mixedCutoff),
            and(isNull(schema.educationArticles.publishedAt), gte(schema.educationArticles.updatedAt, mixedCutoff)),
          ),
        ),
      )
      .orderBy(desc(schema.educationArticles.publishedAt), desc(schema.educationArticles.updatedAt))
      .limit(Math.ceil(poolLimit / 2)),
    db
      .select({
        id: schema.groups.id,
        name: schema.groups.name,
        description: schema.groups.description,
        bannerUrl: schema.groups.bannerUrl,
        logoUrl: schema.groups.logoUrl,
        lastActivityAt: schema.groups.lastActivityAt,
        createdAt: schema.groups.createdAt,
      })
      .from(schema.groups)
      .where(
        and(
          eq(schema.groups.visibility, 'public'),
          isNull(schema.groups.disbandedAt),
          gte(schema.groups.lastActivityAt, mixedCutoff),
        ),
      )
      .orderBy(desc(schema.groups.lastActivityAt))
      .limit(Math.ceil(poolLimit / 2)),
    db
      .select({
        id: schema.vendorProfiles.id,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
        logoUrl: schema.vendorProfiles.logoUrl,
        categories: schema.vendorProfiles.categories,
        createdAt: schema.vendorProfiles.createdAt,
        externalListingsSyncedAt: schema.vendorProfiles.externalListingsSyncedAt,
        etsyListingsSyncedAt: schema.vendorProfiles.etsyListingsSyncedAt,
      })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.visibility, 'PUBLIC'))
      .orderBy(desc(schema.vendorProfiles.createdAt))
      .limit(Math.ceil(poolLimit / 2)),
  ])

  const allowedPostIds = await filterPostsForViewer(postRows, viewerId)
  const visiblePosts = postRows.filter((p) => allowedPostIds.has(p.id))
  const postIds = visiblePosts.map((p) => p.id)
  const eventIds = eventRows.map((e) => e.id)
  const educationIds = educationRows.map((a) => a.id)
  const groupIds = groupRows.map((g) => g.id)

  const [likeCounts, repostCounts, rsvpVelocity, memberCounts, seriesArticleIds] = await Promise.all([
    loadLikeCounts(postIds),
    loadRepostCounts(postIds),
    loadRsvpVelocity(eventIds, rsvpSince),
    loadActiveMemberCounts(groupIds),
    loadSeriesArticleIds(educationIds),
  ])

  const vendorCandidates: RankedCandidate[] = []
  for (const v of vendorRows) {
    const [product] = await db
      .select({
        title: schema.products.title,
        primaryImageUrl: schema.products.primaryImageUrl,
      })
      .from(schema.products)
      .where(eq(schema.products.vendorId, v.id))
      .limit(1)
    const [external] = await db
      .select({
        title: schema.vendorExternalListings.title,
        primaryImageUrl: schema.vendorExternalListings.primaryImageUrl,
      })
      .from(schema.vendorExternalListings)
      .where(eq(schema.vendorExternalListings.vendorId, v.id))
      .limit(1)
    const listingTitle = product?.title ?? external?.title
    if (!listingTitle) continue
    const syncDates = [v.createdAt, v.externalListingsSyncedAt, v.etsyListingsSyncedAt].filter(
      (d): d is Date => d instanceof Date,
    )
    const createdAt = syncDates.reduce((latest, d) => (d > latest ? d : latest), v.createdAt)
    vendorCandidates.push({
      kind: 'vendor',
      id: v.id,
      createdAt,
      likeCount: 0,
      repostCount: 0,
      cardKind: 'vendor',
      title: v.displayName,
      subtitle: (v.categories ?? []).slice(0, 2).join(' · ') || listingTitle,
      href: `/vendors/${v.id}`,
      imageUrl: product?.primaryImageUrl ?? external?.primaryImageUrl ?? v.logoUrl ?? null,
    })
  }

  const candidates: RankedCandidate[] = [
    ...visiblePosts.map((p) => {
      const { imageUrl: attImg, audioPreviewUrl } = trendingMediaFromAttachments(p.attachments)
      return {
        kind: 'feed_post' as const,
        id: p.id,
        createdAt: p.createdAt,
        likeCount: likeCounts.get(p.id) ?? 0,
        repostCount: repostCounts.get(p.id) ?? 0,
        cardKind: `feed_${p.kind}`,
        title: p.title?.trim() || plainTextExcerpt(p.body, 80),
        subtitle: `@${p.username}`,
        href: `/share/post/${p.id}`,
        imageUrl: attImg ?? null,
        audioPreviewUrl: attImg ? null : audioPreviewUrl,
      }
    }),
    ...eventRows.map((e) => ({
      kind: 'event' as const,
      id: e.id,
      createdAt: eventScoringAnchor(e.createdAt, e.startsAt),
      likeCount: 0,
      repostCount: 0,
      rsvpVelocityPerHour: rsvpVelocity.get(e.id) ?? 0,
      featured: e.featured,
      cardKind: 'event',
      title: e.title,
      subtitle: e.location ?? undefined,
      href: `/events/${e.id}`,
      imageUrl: e.imageUrl ?? null,
    })),
    ...educationRows.map((a) => ({
      kind: 'education_article' as const,
      id: a.id,
      createdAt: a.publishedAt ?? a.updatedAt,
      likeCount: 0,
      repostCount: 0,
      inSeries: seriesArticleIds.has(a.id),
      cardKind: 'education_article',
      title: a.title,
      subtitle: a.excerpt?.trim() ? plainTextExcerpt(a.excerpt, 80) : `@${a.username}`,
      href: `/education/${a.slug}`,
      imageUrl: a.heroImageUrl ?? null,
    })),
    ...groupRows.map((g) => ({
      kind: 'group' as const,
      id: g.id,
      createdAt: g.lastActivityAt ?? g.createdAt,
      likeCount: 0,
      repostCount: 0,
      memberCount: memberCounts.get(g.id) ?? 0,
      cardKind: 'group',
      title: g.name,
      subtitle:
        memberCounts.get(g.id) != null ? `${memberCounts.get(g.id)} members` : g.description?.trim() || undefined,
      href: `/groups/${g.id}`,
      imageUrl: g.bannerUrl ?? g.logoUrl ?? null,
    })),
    ...vendorCandidates,
  ]

  const scored: ScoredRankedItem[] = candidates.map((c) => ({
    ...c,
    score: scoreV1(c, now),
  }))

  const capped = applyTypeCaps(
    scored.map((item) => ({ kind: item.cardKind, id: item.id, score: item.score })),
    limit,
  )
  const byKey = new Map(scored.map((item) => [capKey(item.cardKind, item.id), item]))

  return capped.map((cap) => {
    const item = byKey.get(capKey(cap.kind, cap.id))
    if (!item) {
      throw new Error(`Trending cap item missing source row: ${cap.kind}/${cap.id}`)
    }
    return {
      kind: item.cardKind,
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href,
      imageUrl: deliverCardImageUrl(item.imageUrl),
      audioPreviewUrl: item.audioPreviewUrl,
      scoreSchemaVersion: TRENDING_SCHEMA_VERSION,
      ...(debug ? { score: Math.round(item.score * 100) / 100 } : {}),
    }
  })
}
