/**
 * Education discover hub - mock learning paths, stats, and card mappers.
 * Extends existing article/presenter types; no new API tables.
 */
import { mockPeople } from '@/data/mock-data'
import { getMockEducationCatalog, mockEducationExtras } from '@/data/mock-home-surface'
import type { MockArticle } from '@/data/types'
import type { ApiEducationArticle } from '@/hooks/useApiEducationArticles'
import type { ApiEducationSeries } from '@/hooks/useApiEducationSeries'
import type { ApiMediaShowListItem } from '@/hooks/useApiMediaShows'
import type { ApiPresenterListItem } from '@/hooks/useApiPresenters'

export type EducationHubStats = {
  articles: number
  videos: number
  educators: number
  endorsements: number
}

export type EducationLearningPath = {
  id: string
  title: string
  href: string
  imageUrl?: string | null
  modules: { label: string; completed: boolean }[]
  progressPercent: number
}

export type EducationFeaturedEducator = {
  userId: string
  username: string
  displayName: string
  handle: string
  avatarUrl: string | null
  articleCount: number
  followerCount: number
  endorsementCount: number
}

export type EducationStripArticle = {
  slug: string
  title: string
  category: string
  readLabel: string
  thumbnailUrl: string | null
}

export type EducationStripVideo = {
  slug: string
  title: string
  category: string
  durationLabel: string
  thumbnailUrl: string | null
  /** Defaults to `/education/:slug` when omitted. */
  href?: string
}

export type EducationRecentTextItem = {
  slug: string
  title: string
  category: string
  addedLabel: string
  excerpt: string | null
}

export const EDUCATION_CATEGORY_FILTERS = [
  'Beginner',
  'Advanced',
  'Safety',
  'Psychology',
  'Gear',
  'Event Etiquette',
] as const

export type EducationTopicFilter = {
  /** Exact category string sent to the articles API. */
  category: string
  label: string
  icon: string
  count: number
}

const EDUCATION_TOPIC_ICONS: Record<string, string> = {
  safety: '🛡️',
  beginner: '🤝',
  consent: '🤝',
  psychology: '🧠',
  gear: '🪢',
  rope: '🪢',
  advanced: '👑',
  dominance: '👑',
  'event etiquette': '⚡',
  dynamics: '⚡',
  etiquette: '⚡',
  negotiation: '📝',
  aftercare: '💜',
  fundamentals: '📘',
}

function iconForEducationTopic(category: string): string {
  const key = category.trim().toLowerCase()
  if (EDUCATION_TOPIC_ICONS[key]) return EDUCATION_TOPIC_ICONS[key]
  for (const [needle, icon] of Object.entries(EDUCATION_TOPIC_ICONS)) {
    if (key.includes(needle)) return icon
  }
  return '📚'
}

type ArticleWithCategories = { categories?: string[] | null }

/** Topic directory derived from published article category tags (grows with catalogue). */
export function educationTopicFiltersFromArticles(articles: ArticleWithCategories[]): EducationTopicFilter[] {
  const byKey = new Map<string, { category: string; count: number }>()

  for (const article of articles) {
    for (const raw of article.categories ?? []) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      const existing = byKey.get(key)
      if (existing) {
        existing.count += 1
      } else {
        byKey.set(key, { category: trimmed, count: 1 })
      }
    }
  }

  return Array.from(byKey.values())
    .map(({ category, count }) => ({
      category,
      label: category,
      icon: iconForEducationTopic(category),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export const MOCK_LEARNING_PATHS: EducationLearningPath[] = [
  {
    id: 'path-foundations',
    title: 'BDSM Foundations',
    href: '/education?view=paths',
    modules: [
      { label: 'Consent & negotiation', completed: true },
      { label: 'Roles & dynamics', completed: true },
      { label: 'Scene planning basics', completed: false },
      { label: 'Aftercare essentials', completed: false },
    ],
    progressPercent: 48,
  },
  {
    id: 'path-rope',
    title: 'Rope Bondage Basics',
    href: '/education?view=paths',
    modules: [
      { label: 'Single-column tie', completed: true },
      { label: 'Double-column tie', completed: false },
      { label: 'Frictions & lock-offs', completed: false },
      { label: 'Safety & nerve awareness', completed: false },
    ],
    progressPercent: 22,
  },
  {
    id: 'path-leadership',
    title: 'Dominance & Leadership',
    href: '/education?view=paths',
    modules: [
      { label: 'Ethical dominance', completed: false },
      { label: 'Communication under stress', completed: false },
      { label: 'Community accountability', completed: false },
    ],
    progressPercent: 0,
  },
]

export function hubSeriesToLearningPaths(series: ApiEducationSeries[]): EducationLearningPath[] {
  return series.map((row) => {
    const modules = row.modules ?? []
    return {
      id: row.id,
      title: row.title,
      href: `/education/series/${encodeURIComponent(row.slug)}`,
      modules: modules.map((mod) => ({ label: mod.label, completed: false })),
      progressPercent: 0,
    }
  })
}

const EDUCATOR_USERNAMES = ['RopeDreamer', 'ConsentCoach', 'TherapyKink', 'PresenterNova'] as const

export function getMockFeaturedEducators(): EducationFeaturedEducator[] {
  return EDUCATOR_USERNAMES.map((username, i) => {
    const person = mockPeople.find((p) => p.username === username) ?? mockPeople[i % mockPeople.length]
    return {
      userId: person.id,
      username: person.username,
      displayName: person.sceneName ?? person.username,
      handle: `@${person.username}`,
      avatarUrl: person.avatarUrl ?? null,
      articleCount: 4 + (i % 5) * 3,
      followerCount: 120 + i * 87,
      endorsementCount: 18 + i * 11,
    }
  })
}

export function presenterToFeaturedEducator(p: ApiPresenterListItem): EducationFeaturedEducator {
  return {
    userId: p.userId,
    username: p.username,
    displayName: p.displayName ?? p.username,
    handle: `@${p.username}`,
    avatarUrl: p.avatarUrl,
    articleCount: p.publishedArticleCount ?? 0,
    followerCount: Math.max(p.reviewCount * 12, p.reviewCount),
    endorsementCount: Math.round(p.ratingAvg * p.reviewCount) || 0,
  }
}

/** Fallback featured row when presenter directory is sparse but hub articles exist. */
export function educatorsFromArticles(articles: ApiEducationArticle[]): EducationFeaturedEducator[] {
  const byAuthor = new Map<
    string,
    { userId: string; username: string; displayName: string | null; count: number }
  >()
  for (const article of articles) {
    const key = article.authorUsername
    if (!key) continue
    const existing = byAuthor.get(key)
    if (existing) existing.count += 1
    else {
      byAuthor.set(key, {
        userId: article.authorUserId,
        username: key,
        displayName: article.authorDisplayName,
        count: 1,
      })
    }
  }
  return [...byAuthor.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((row, index) => ({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName ?? row.username,
      handle: `@${row.username}`,
      avatarUrl: null,
      articleCount: row.count,
      followerCount: 24 + index * 16,
      endorsementCount: row.count * 4,
    }))
}

export function topicCountsFromArticles(articles: ApiEducationArticle[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const topic of educationTopicFiltersFromArticles(articles)) {
    counts[topic.category] = topic.count
  }
  return counts
}

export function apiArticleToVideoStrip(article: ApiEducationArticle): EducationStripVideo | null {
  const hasEmbed = /youtube\.com\/embed|player\.vimeo\.com\/video/i.test(article.bodyHtml ?? '')
  if (!hasEmbed && !article.heroImageUrl) return null
  return {
    slug: article.slug,
    title: article.title,
    category: article.categories[0] ?? 'Workshop',
    durationLabel: article.readingMinutes ? `${article.readingMinutes} min` : 'Workshop',
    thumbnailUrl: article.heroImageUrl,
    href: `/education/${encodeURIComponent(article.slug)}`,
  }
}

export function mediaShowToEducationVideo(show: ApiMediaShowListItem): EducationStripVideo {
  const formatLabel =
    show.mediaFormat === 'podcast' ? 'Podcast'
    : show.mediaFormat === 'hybrid' ? 'Hybrid'
    : 'Channel'
  return {
    slug: show.slug,
    title: show.title,
    category: show.tags[0] ?? formatLabel,
    durationLabel: formatLabel,
    thumbnailUrl: show.coverImageUrl,
    href: `/media/${encodeURIComponent(show.slug)}`,
  }
}

export function pickVideoStripsFromArticles(articles: ApiEducationArticle[], limit = 8): EducationStripVideo[] {
  const out: EducationStripVideo[] = []
  for (const article of articles) {
    const strip = apiArticleToVideoStrip(article)
    if (strip) out.push(strip)
    if (out.length >= limit) break
  }
  return out
}

function mockReadLabel(a: MockArticle): string {
  if (a.contentType === 'video' && a.durationLabel) return a.durationLabel
  return a.readTime.includes('min') ? a.readTime : `${a.readTime} read`
}

export function mockArticleToStrip(a: MockArticle): EducationStripArticle {
  return {
    slug: a.slug,
    title: a.title,
    category: a.category,
    readLabel: mockReadLabel(a),
    thumbnailUrl: a.thumbnailUrl ?? null,
  }
}

export function apiArticleToStrip(a: ApiEducationArticle): EducationStripArticle {
  const minutes = a.readingMinutes
  const readLabel = minutes != null && minutes >= 1 ? `${minutes} min read` : 'Article'
  return {
    slug: a.slug,
    title: a.title,
    category: a.categories[0] ?? 'Education',
    readLabel,
    thumbnailUrl: a.heroImageUrl,
  }
}

export function mockArticleToVideo(a: MockArticle): EducationStripVideo {
  return {
    slug: a.slug,
    title: a.title,
    category: a.category,
    durationLabel: a.durationLabel ?? a.readTime,
    thumbnailUrl: a.thumbnailUrl ?? null,
  }
}

export function mockArticleToRecent(a: MockArticle, index: number): EducationRecentTextItem {
  const days = index + 1
  return {
    slug: a.slug,
    title: a.title,
    category: a.category,
    addedLabel: days === 1 ? 'Added today' : `Added ${days} days ago`,
    excerpt: a.content.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 120) ?? null,
  }
}

export function apiArticleToRecent(a: ApiEducationArticle, index: number): EducationRecentTextItem {
  const published = a.publishedAt ? new Date(a.publishedAt) : null
  let addedLabel = 'Recently published'
  if (published && !Number.isNaN(published.getTime())) {
    const diffDays = Math.floor((Date.now() - published.getTime()) / 86_400_000)
    addedLabel = diffDays <= 0 ? 'Added today' : diffDays === 1 ? 'Added yesterday' : `Added ${diffDays} days ago`
  } else if (index === 0) {
    addedLabel = 'Added today'
  }
  return {
    slug: a.slug,
    title: a.title,
    category: a.categories[0] ?? 'Education',
    addedLabel,
    excerpt: a.excerpt,
  }
}

export function computeEducationHubStats(
  articleCount: number,
  videoCount?: number,
  educatorCount?: number,
): EducationHubStats {
  const catalog = getMockEducationCatalog()
  const videos =
    videoCount ??
    catalog.filter((a) => a.contentType === 'video').length + mockEducationExtras.length
  const educators = educatorCount ?? getMockFeaturedEducators().length
  return {
    articles: articleCount > 0 ? articleCount : catalog.filter((a) => a.contentType !== 'video').length,
    videos: videoCount != null && videoCount > 0 ? videoCount : videos,
    educators: educatorCount != null && educatorCount > 0 ? educatorCount : educators,
    endorsements: 0,
  }
}

export function pickTrendingFromMock(limit = 8): EducationStripArticle[] {
  return getMockEducationCatalog()
    .filter((a) => a.contentType !== 'video')
    .slice(0, limit)
    .map(mockArticleToStrip)
}

export function pickVideosFromMock(limit = 8): EducationStripVideo[] {
  return getMockEducationCatalog()
    .filter((a) => a.contentType === 'video')
    .slice(0, limit)
    .map(mockArticleToVideo)
}

export function pickRecentFromMock(limit = 6): EducationRecentTextItem[] {
  return getMockEducationCatalog()
    .slice(0, limit)
    .map((a, i) => mockArticleToRecent(a, i))
}
