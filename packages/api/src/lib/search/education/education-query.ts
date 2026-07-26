import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { db, schema } from '../../../db/index.js'
import { isIndexQueryActive, resolveCollectionName } from '../index-registry.js'
import { getTypesenseReadClient } from '../typesense-client.js'

export type EducationArticlesListQuery = {
  category?: string
  difficulty?: string
  q?: string
  limit: number
  cursor?: string
}

export type EducationArticlesDbListResult = {
  rows: Array<typeof schema.educationArticles.$inferSelect>
  nextCursor: string | null
}

/** Existing Drizzle list + ILIKE search — canonical DB fallback. */
export async function listEducationArticlesFromDb(
  query: EducationArticlesListQuery,
): Promise<EducationArticlesDbListResult> {
  const conditions = [
    eq(schema.educationArticles.listInEducation, true),
    eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
  ]
  if (query.category?.trim()) {
    conditions.push(sql`${query.category.trim()} = ANY(${schema.educationArticles.categories})`)
  }
  if (query.difficulty?.trim()) {
    conditions.push(eq(schema.educationArticles.difficulty, query.difficulty.trim()))
  }
  if (query.q?.trim()) {
    const pattern = `%${query.q.trim()}%`
    conditions.push(or(ilike(schema.educationArticles.title, pattern), ilike(schema.educationArticles.excerpt, pattern))!)
  }
  if (query.cursor) {
    const d = new Date(query.cursor)
    if (!Number.isNaN(d.getTime())) {
      conditions.push(lt(schema.educationArticles.publishedAt, d))
    }
  }
  const rows = await db
    .select()
    .from(schema.educationArticles)
    .where(and(...conditions))
    .orderBy(desc(schema.educationArticles.publishedAt))
    .limit(query.limit + 1)
  const page = rows.slice(0, query.limit)
  const nextCursor =
    rows.length > query.limit && page[page.length - 1]?.publishedAt
      ? page[page.length - 1]!.publishedAt!.toISOString()
      : null
  return { rows: page, nextCursor }
}

export type EducationTypesenseSearchResult =
  | { ok: true; articleIds: string[]; nextCursor: string | null }
  | { ok: false; reason: 'disabled' | 'no_client' | 'error' }

function escapeFilterValue(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function searchEducationArticleIdsTypesense(
  query: EducationArticlesListQuery,
): Promise<EducationTypesenseSearchResult> {
  if (!isIndexQueryActive('education_articles')) return { ok: false, reason: 'disabled' }
  const client = getTypesenseReadClient()
  if (!client) return { ok: false, reason: 'no_client' }

  const filters: string[] = ['visibility:=PUBLIC']
  if (query.category?.trim()) {
    filters.push(`categories:=${escapeFilterValue(query.category.trim())}`)
  }
  if (query.difficulty?.trim()) {
    filters.push(`difficulty:=${escapeFilterValue(query.difficulty.trim())}`)
  }
  if (query.cursor) {
    const d = new Date(query.cursor)
    if (!Number.isNaN(d.getTime())) {
      filters.push(`published_at:<${Math.floor(d.getTime() / 1000)}`)
    }
  }

  const searchParams: Record<string, unknown> = {
    q: query.q?.trim() || '*',
    query_by: 'title,excerpt',
    filter_by: filters.join(' && '),
    sort_by: 'published_at:desc',
    per_page: query.limit + 1,
    page: 1,
  }

  try {
    const name = resolveCollectionName('education_articles')
    const result = await client.collections(name).documents().search(searchParams)
    const hits = (result.hits ?? []) as Array<{
      document?: { entity_id?: string; published_at?: number }
    }>
    const articleIds = hits
      .map((h) => h.document?.entity_id ?? '')
      .filter(Boolean)
    const hasMore = articleIds.length > query.limit
    const pageIds = hasMore ? articleIds.slice(0, query.limit) : articleIds
    let nextCursor: string | null = null
    if (hasMore && pageIds.length > 0) {
      const lastHit = hits[query.limit - 1]?.document as { published_at?: number } | undefined
      if (lastHit?.published_at) {
        nextCursor = new Date(lastHit.published_at * 1000).toISOString()
      }
    }
    return { ok: true, articleIds: pageIds, nextCursor }
  } catch (err) {
    console.warn('[search] education query failed — caller should DB fallback', (err as Error).message)
    return { ok: false, reason: 'error' }
  }
}

export async function hydrateEducationArticlesByIds(
  articleIds: string[],
): Promise<Array<typeof schema.educationArticles.$inferSelect>> {
  if (articleIds.length === 0) return []
  const rows = await db
    .select()
    .from(schema.educationArticles)
    .where(inArray(schema.educationArticles.id, articleIds))
  const byId = new Map(rows.map((r) => [r.id, r]))
  return articleIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r))
}

export async function listEducationArticlesForHub(
  query: EducationArticlesListQuery,
): Promise<EducationArticlesDbListResult & { searchBackend: 'database' | 'typesense' }> {
  const ts = await searchEducationArticleIdsTypesense(query)
  if (ts.ok) {
    const rows = await hydrateEducationArticlesByIds(ts.articleIds)
    return { rows, nextCursor: ts.nextCursor, searchBackend: 'typesense' }
  }
  const dbResult = await listEducationArticlesFromDb(query)
  return { ...dbResult, searchBackend: 'database' }
}
