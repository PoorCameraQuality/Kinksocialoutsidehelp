/**
 * Import published ECKE education articles into C2K education hub (alpha seed).
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import type { AlphaSeedMarker } from '../lib/alpha-seed-labels.js'
import {
  eckeEducationMarkdownToHtml,
  parseEckeReadMinutes,
} from '../lib/ecke-education-markdown.js'
import { estimateReadingMinutes, sanitizeEducationHtml } from '../lib/sanitize-education-body.js'
import { ECKE_EDUCATION_ARTICLES, type EckeEducationArticleRow } from './ecke-catalog-education.js'
import { ECKE_SOURCE } from './ecke-catalog.js'
import { resolveEastCoastRepoRoot } from './ecke-seed-images.js'
import { db, schema } from './index.js'

const ECKE_SERIES_SLUG = 'ecke-fundamentals'
const PRESENTER_USERNAMES = new Set(['RopeDreamer', 'LeatherCraftDemo'])

type EastCoastEducationArticle = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  tags?: string[]
  author: { name: string }
  publishDate: string
  readTime?: string
  featured?: boolean
  status?: string
}

type DemoActors = {
  ropeId: string
  leatherId: string
}

function mapEastCoastArticle(row: EastCoastEducationArticle): EckeEducationArticleRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    tags: row.tags ?? [],
    authorName: row.author.name,
    publishDate: row.publishDate,
    readTime: row.readTime ?? '',
    featured: row.featured ?? false,
  }
}

export async function loadEastCoastEducation(): Promise<{ rows: EckeEducationArticleRow[]; source: string }> {
  const root = resolveEastCoastRepoRoot()
  if (!root) {
    console.log('EastCoast repo not found; using ecke-catalog-education fallback.')
    return { rows: ECKE_EDUCATION_ARTICLES, source: 'ecke-catalog-education' }
  }

  try {
    const mod = await import(pathToFileURL(path.join(root, 'src/data/education.js')).href)
    const raw: EastCoastEducationArticle[] = mod.getAllArticles?.() ?? mod.articles ?? []
    const published = raw.filter((a) => (a.status ?? 'published') === 'published')
    const rows = published.map(mapEastCoastArticle)
    console.log(`Loaded ${rows.length} published education articles from ${root}.`)
    return { rows, source: root }
  } catch (err) {
    console.warn('EastCoast education import failed; using catalog fallback.', err)
    return { rows: ECKE_EDUCATION_ARTICLES, source: 'ecke-catalog-education' }
  }
}

function resolveAuthorUserId(authorName: string, actors: DemoActors): string {
  const normalized = authorName.toLowerCase()
  if (normalized.includes('marcus') || normalized.includes('rodriguez')) return actors.leatherId
  return actors.ropeId
}

function heroImageForSlug(slug: string): string {
  return `https://picsum.photos/seed/ecke-edu-${slug}/1200/630`
}

function categoriesForArticle(row: EckeEducationArticleRow): string[] {
  const out: string[] = []
  if (row.category?.trim()) out.push(row.category.trim())
  if (row.tags.includes('beginners')) out.push('Beginner')
  if (row.tags.some((t) => ['negotiation', 'consent', 'aftercare', 'ssc', 'rack', 'safety'].includes(t.toLowerCase()))) {
    if (!out.includes('Safety')) out.push('Safety')
  }
  if (row.tags.some((t) => ['relationships', 'emotional-health', 'psychology'].includes(t.toLowerCase()))) {
    out.push('Psychology')
  }
  return [...new Set(out)].slice(0, 4)
}

async function presenterProfileUserIdFor(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!user || !PRESENTER_USERNAMES.has(user.username)) return null

  const [profile] = await db
    .select({ userId: schema.presenterProfiles.userId })
    .from(schema.presenterProfiles)
    .where(eq(schema.presenterProfiles.userId, userId))
    .limit(1)
  return profile?.userId ?? null
}

export async function importEckeEducation(
  mark: AlphaSeedMarker,
  actors: DemoActors,
  rows: EckeEducationArticleRow[],
): Promise<void> {
  const articleIdBySlug = new Map<string, string>()
  let added = 0
  let updated = 0

  for (const row of rows) {
    const authorUserId = resolveAuthorUserId(row.authorName, actors)
    const presenterProfileUserId = await presenterProfileUserIdFor(authorUserId)
    const bodyHtml = sanitizeEducationHtml(eckeEducationMarkdownToHtml(row.content))
    const readingMinutes =
      parseEckeReadMinutes(row.readTime) ?? estimateReadingMinutes(bodyHtml)
    const publishedAt = new Date(`${row.publishDate}T12:00:00.000Z`)

    const patch = {
      authorUserId,
      presenterProfileUserId,
      title: row.title,
      excerpt: row.excerpt.slice(0, 500),
      bodyJson: { eckeSource: `${ECKE_SOURCE}/education/${row.slug}` },
      bodyHtml,
      heroImageUrl: heroImageForSlug(row.slug),
      categories: categoriesForArticle(row),
      difficulty: row.tags.includes('beginners') ? 'Beginner' : 'All levels',
      contentWarnings: row.category === 'Safety' ? ['BDSM safety discussion'] : [],
      readingMinutes,
      linkedOfferingIds: [] as string[],
      visibility: 'PUBLIC' as const,
      listInEducation: true,
      publicationStatus: 'PUBLISHED' as const,
      publishedAt,
      updatedAt: new Date(),
    }

    const [existing] = await db
      .select({ id: schema.educationArticles.id })
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.slug, row.slug))
      .limit(1)

    if (existing) {
      await db.update(schema.educationArticles).set(patch).where(eq(schema.educationArticles.id, existing.id))
      await mark({
        targetType: 'education_article',
        targetId: existing.id,
        isPublicSource: true,
        sourceType: 'ecke_education_article',
        sourceSlug: row.slug,
      })
      articleIdBySlug.set(row.slug, existing.id)
      updated++
      continue
    }

    const [created] = await db
      .insert(schema.educationArticles)
      .values({ slug: row.slug, ...patch })
      .returning()
    if (!created) continue

    await mark({
      targetType: 'education_article',
      targetId: created.id,
      isPublicSource: true,
      sourceType: 'ecke_education_article',
      sourceSlug: row.slug,
    })
    articleIdBySlug.set(row.slug, created.id)
    added++
  }

  if (articleIdBySlug.size >= 2) {
    await ensureEckeFundamentalsSeries(mark, actors.ropeId, articleIdBySlug, rows)
  }

  console.log(
    `Alpha ECKE: ${added} new, ${updated} updated education articles (${rows.length} considered).`,
  )
}

async function ensureEckeFundamentalsSeries(
  mark: AlphaSeedMarker,
  authorUserId: string,
  articleIdBySlug: Map<string, string>,
  rows: EckeEducationArticleRow[],
): Promise<void> {
  const sortedIds = [...rows]
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
    .map((row) => articleIdBySlug.get(row.slug))
    .filter(Boolean) as string[]

  const [existingSeries] = await db
    .select({ id: schema.educationArticleSeries.id })
    .from(schema.educationArticleSeries)
    .where(eq(schema.educationArticleSeries.slug, ECKE_SERIES_SLUG))
    .limit(1)

  let seriesId = existingSeries?.id
  if (!seriesId) {
    const [series] = await db
      .insert(schema.educationArticleSeries)
      .values({
        authorUserId,
        title: 'ECKE Fundamentals',
        slug: ECKE_SERIES_SLUG,
        description:
          'Core safety and relationship skills from East Coast Kink Events — SSC/RACK, negotiation, and aftercare.',
        listInEducation: true,
      })
      .returning()
    seriesId = series?.id
    if (series) {
      await mark({
        targetType: 'education_article_series',
        targetId: series.id,
        isPublicSource: true,
        sourceType: 'ecke_education_series',
        sourceSlug: ECKE_SERIES_SLUG,
      })
    }
  }

  if (!seriesId) return

  await db
    .delete(schema.educationArticleSeriesItems)
    .where(eq(schema.educationArticleSeriesItems.seriesId, seriesId))

  await db.insert(schema.educationArticleSeriesItems).values(
    sortedIds.map((articleId, i) => ({
      seriesId,
      articleId,
      sortOrder: i + 1,
    })),
  )

  await db
    .update(schema.educationArticleSeries)
    .set({ listInEducation: true, updatedAt: new Date() })
    .where(eq(schema.educationArticleSeries.slug, 'kink-101'))
}
