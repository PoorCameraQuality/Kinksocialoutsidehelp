import type { EducationArticleVisibility } from '../../education-article-visibility.js'

export type EducationArticleIndexInput = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  categories: string[] | null
  difficulty: string | null
  visibility: EducationArticleVisibility | string | null
  listInEducation: boolean
  publicationStatus: string
  publishedAt: Date | null
  updatedAt: Date
}

/**
 * Privacy gate: only PUBLIC hub-listed published articles enter Typesense.
 * CONNECTIONS/MEMBERS articles remain DB-only until a scoped index path exists.
 */
export function shouldIndexEducationArticle(row: EducationArticleIndexInput): boolean {
  if (!row.listInEducation) return false
  if (row.publicationStatus !== 'PUBLISHED') return false
  if ((row.visibility ?? 'PUBLIC') !== 'PUBLIC') return false
  if (!row.title?.trim()) return false
  return true
}

export type EducationArticleSearchDocument = {
  id: string
  entity_type: 'education'
  entity_id: string
  slug: string
  title: string
  excerpt: string
  categories: string[]
  difficulty: string
  published_at: number
  updated_at: number
  visibility: 'PUBLIC'
}

export function buildEducationArticleSearchDocument(
  row: EducationArticleIndexInput,
): EducationArticleSearchDocument | null {
  if (!shouldIndexEducationArticle(row)) return null
  const publishedAt = row.publishedAt ?? row.updatedAt
  return {
    id: `education:${row.id}`,
    entity_type: 'education',
    entity_id: row.id,
    slug: row.slug,
    title: row.title.trim(),
    excerpt: (row.excerpt ?? '').trim(),
    categories: row.categories ?? [],
    difficulty: row.difficulty?.trim() || '',
    published_at: Math.floor(publishedAt.getTime() / 1000),
    updated_at: Math.floor(row.updatedAt.getTime() / 1000),
    visibility: 'PUBLIC',
  }
}

export const EDUCATION_ARTICLES_COLLECTION_SCHEMA = {
  fields: [
    { name: 'entity_type', type: 'string' as const, facet: true },
    { name: 'entity_id', type: 'string' as const },
    { name: 'slug', type: 'string' as const },
    { name: 'title', type: 'string' as const },
    { name: 'excerpt', type: 'string' as const, optional: true },
    { name: 'categories', type: 'string[]' as const, facet: true, optional: true },
    { name: 'difficulty', type: 'string' as const, facet: true, optional: true },
    { name: 'published_at', type: 'int64' as const, sort: true },
    { name: 'updated_at', type: 'int64' as const, sort: true },
    { name: 'visibility', type: 'string' as const, facet: true },
  ],
  default_sorting_field: 'published_at',
}
