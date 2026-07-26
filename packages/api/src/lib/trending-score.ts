/** Mirrors [docs/TRENDING_SCORE.md](../../../docs/TRENDING_SCORE.md) schemaVersion 1. */
export const TRENDING_SCHEMA_VERSION = 1

export const trendingWeightsV1 = {
  view: 0.02,
  reaction: 1.5,
  repost: 2.0,
  commentPerDay: 1.0,
  rsvpPerHour: 0.5,
  halfLifeHours: 48,
  /** Small boost for education articles in a published series. */
  seriesBoost: 0.5,
  /** Per active member (capped) for group candidates. */
  memberPerCount: 0.05,
  memberCountCap: 100,
} as const

export type TrendingItemKind =
  | 'feed_post'
  | 'event'
  | 'education_article'
  | 'group'
  | 'vendor'

export type TrendingCandidate = {
  kind: TrendingItemKind
  id: string
  createdAt: Date
  likeCount: number
  repostCount: number
  rsvpVelocityPerHour?: number
  memberCount?: number
  inSeries?: boolean
  featured?: boolean
}

export type ScoredTrendingItem = {
  kind: string
  id: string
  score: number
}

export function decayFactor(ageHours: number, halfLifeHours: number = trendingWeightsV1.halfLifeHours): number {
  return Math.pow(2, -ageHours / halfLifeHours)
}

export function rawScoreV1(c: TrendingCandidate): number {
  let score = 1.0
  score += c.likeCount * trendingWeightsV1.reaction
  score += c.repostCount * trendingWeightsV1.repost
  if (c.rsvpVelocityPerHour != null && c.rsvpVelocityPerHour > 0) {
    score += c.rsvpVelocityPerHour * trendingWeightsV1.rsvpPerHour
  }
  if (c.memberCount != null && c.memberCount > 0) {
    score += Math.min(c.memberCount, trendingWeightsV1.memberCountCap) * trendingWeightsV1.memberPerCount
  }
  if (c.inSeries) score += trendingWeightsV1.seriesBoost
  if (c.featured) score += 1.0
  return score
}

export function scoreV1(c: TrendingCandidate, now: Date = new Date()): number {
  const ageMs = now.getTime() - c.createdAt.getTime()
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60))
  return rawScoreV1(c) * decayFactor(ageHours)
}

/** Event scoring anchor: boost imminent events without letting far-future dates dominate decay. */
export function eventScoringAnchor(createdAt: Date, startsAt: Date): Date {
  const sevenDaysBeforeStart = new Date(startsAt.getTime() - 7 * 24 * 60 * 60 * 1000)
  return createdAt > sevenDaysBeforeStart ? createdAt : sevenDaysBeforeStart
}

export function trendingCapFamily(kind: string): 'feed' | 'event' | 'mixed' {
  if (kind.startsWith('feed_')) return 'feed'
  if (kind === 'event') return 'event'
  return 'mixed'
}

/** Per [docs/TRENDING_SCORE.md]: max 50% feed, 30% event, remainder mixed kinds. */
export function applyTypeCaps<T extends ScoredTrendingItem>(items: T[], limit: number): T[] {
  if (limit <= 0 || items.length === 0) return []
  const sorted = [...items].sort((a, b) => b.score - a.score)
  const maxFeed = Math.floor(limit * 0.5)
  const maxEvent = Math.floor(limit * 0.3)
  const counts = { feed: 0, event: 0, mixed: 0 }
  const out: T[] = []

  for (const item of sorted) {
    if (out.length >= limit) break
    const family = trendingCapFamily(item.kind)
    if (family === 'feed' && counts.feed >= maxFeed) continue
    if (family === 'event' && counts.event >= maxEvent) continue
    out.push(item)
    counts[family] += 1
  }

  if (out.length < limit) {
    for (const item of sorted) {
      if (out.length >= limit) break
      if (out.some((x) => x.kind === item.kind && x.id === item.id)) continue
      out.push(item)
    }
  }

  return out
}
