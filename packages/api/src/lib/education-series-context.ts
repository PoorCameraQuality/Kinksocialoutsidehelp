import { asc, eq } from 'drizzle-orm'

import { db, schema } from '../db/index.js'
import { viewerCanReadEducationArticle } from './education-article-visibility.js'
import type { EducationSeriesContext } from './education-series-schema.js'

type ArticleRow = typeof schema.educationArticles.$inferSelect

export async function filterReadablePublishedArticles(
  rows: ArticleRow[],
  viewerUserId: string | null,
): Promise<ArticleRow[]> {
  const out: ArticleRow[] = []
  for (const row of rows) {
    if (row.publicationStatus !== 'PUBLISHED') {
      if (viewerUserId && viewerUserId === row.authorUserId) {
        out.push(row)
      }
      continue
    }
    if (await viewerCanReadEducationArticle(row.visibility, row.authorUserId, viewerUserId)) {
      out.push(row)
    }
  }
  return out
}

export async function loadSeriesContextForArticle(
  articleId: string,
  viewerUserId: string | null,
): Promise<EducationSeriesContext | null> {
  const [item] = await db
    .select({ seriesId: schema.educationArticleSeriesItems.seriesId })
    .from(schema.educationArticleSeriesItems)
    .where(eq(schema.educationArticleSeriesItems.articleId, articleId))
    .limit(1)
  if (!item) return null

  const [series] = await db
    .select()
    .from(schema.educationArticleSeries)
    .where(eq(schema.educationArticleSeries.id, item.seriesId))
    .limit(1)
  if (!series) return null

  const joined = await db
    .select({
      sortOrder: schema.educationArticleSeriesItems.sortOrder,
      article: schema.educationArticles,
    })
    .from(schema.educationArticleSeriesItems)
    .innerJoin(
      schema.educationArticles,
      eq(schema.educationArticleSeriesItems.articleId, schema.educationArticles.id),
    )
    .where(eq(schema.educationArticleSeriesItems.seriesId, series.id))
    .orderBy(asc(schema.educationArticleSeriesItems.sortOrder))

  const visible = await filterReadablePublishedArticles(
    joined.map((j) => j.article),
    viewerUserId,
  )
  if (visible.length === 0) return null

  const visibleIds = new Set(visible.map((a) => a.id))
  const orderedVisible = joined.filter((j) => visibleIds.has(j.article.id)).map((j) => j.article)

  const idx = orderedVisible.findIndex((a) => a.id === articleId)
  if (idx < 0) return null

  return {
    seriesSlug: series.slug,
    seriesTitle: series.title,
    partNumber: idx + 1,
    totalParts: orderedVisible.length,
    prevSlug: idx > 0 ? orderedVisible[idx - 1]!.slug : null,
    nextSlug: idx < orderedVisible.length - 1 ? orderedVisible[idx + 1]!.slug : null,
  }
}

export async function loadVisibleSeriesItems(
  seriesId: string,
  viewerUserId: string | null,
): Promise<
  Array<{
    sortOrder: number
    slug: string
    title: string
    excerpt: string | null
    readingMinutes: number | null
    difficulty: string | null
  }>
> {
  const joined = await db
    .select({
      sortOrder: schema.educationArticleSeriesItems.sortOrder,
      article: schema.educationArticles,
    })
    .from(schema.educationArticleSeriesItems)
    .innerJoin(
      schema.educationArticles,
      eq(schema.educationArticleSeriesItems.articleId, schema.educationArticles.id),
    )
    .where(eq(schema.educationArticleSeriesItems.seriesId, seriesId))
    .orderBy(asc(schema.educationArticleSeriesItems.sortOrder))

  const visible = await filterReadablePublishedArticles(
    joined.map((j) => j.article),
    viewerUserId,
  )
  const visibleIds = new Set(visible.map((a) => a.id))

  return joined
    .filter((j) => visibleIds.has(j.article.id))
    .map((j) => ({
      sortOrder: j.sortOrder,
      slug: j.article.slug,
      title: j.article.title,
      excerpt: j.article.excerpt,
      readingMinutes: j.article.readingMinutes,
      difficulty: j.article.difficulty,
    }))
}
