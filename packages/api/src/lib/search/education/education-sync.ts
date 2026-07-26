import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/index.js'
import { readSearchConfig } from '../config.js'
import { isIndexIndexingActive, resolveCollectionName } from '../index-registry.js'
import { getTypesenseAdminClient } from '../typesense-client.js'
import {
  buildEducationArticleSearchDocument,
  EDUCATION_ARTICLES_COLLECTION_SCHEMA,
} from './education-index-rules.js'

let educationCollectionReady = false

export async function ensureEducationArticlesCollection(): Promise<boolean> {
  if (!isIndexIndexingActive('education_articles')) return false
  if (educationCollectionReady) return true
  const client = getTypesenseAdminClient()
  if (!client) return false
  const name = resolveCollectionName('education_articles')
  try {
    await client.collections(name).retrieve()
    educationCollectionReady = true
    return true
  } catch {
    /* create below */
  }
  try {
    await client.collections().create({
      name,
      ...EDUCATION_ARTICLES_COLLECTION_SCHEMA,
    })
    educationCollectionReady = true
    return true
  } catch (err) {
    console.warn('[search] education collection create failed', (err as Error).message)
    return false
  }
}

export function resetEducationCollectionReadyForTests(): void {
  educationCollectionReady = false
}

export async function loadEducationArticleForIndex(articleId: string) {
  const [row] = await db
    .select()
    .from(schema.educationArticles)
    .where(eq(schema.educationArticles.id, articleId))
    .limit(1)
  return row ?? null
}

export async function upsertEducationArticleIndex(articleId: string): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isIndexIndexingActive('education_articles')) return { ok: true, skipped: true }
  const row = await loadEducationArticleForIndex(articleId)
  if (!row) {
    await deleteEducationArticleIndex(articleId)
    return { ok: true, skipped: true }
  }
  const doc = buildEducationArticleSearchDocument(row)
  if (!doc) {
    await deleteEducationArticleIndex(articleId)
    return { ok: true, skipped: true }
  }
  const ready = await ensureEducationArticlesCollection()
  if (!ready) return { ok: false }
  const client = getTypesenseAdminClient()
  if (!client) return { ok: false }
  const name = resolveCollectionName('education_articles')
  try {
    await client.collections(name).documents().upsert(doc)
    return { ok: true }
  } catch (err) {
    console.warn('[search] education upsert failed', articleId, (err as Error).message)
    return { ok: false }
  }
}

export async function deleteEducationArticleIndex(articleId: string): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isIndexIndexingActive('education_articles')) return { ok: true, skipped: true }
  const client = getTypesenseAdminClient()
  if (!client) return { ok: false }
  const name = resolveCollectionName('education_articles')
  const docId = `education:${articleId}`
  try {
    await client.collections(name).documents(docId).delete()
    return { ok: true }
  } catch (err) {
    const e = err as { httpStatus?: number }
    if (e.httpStatus === 404) return { ok: true }
    console.warn('[search] education delete failed', articleId, (err as Error).message)
    return { ok: false }
  }
}

export async function reindexAllEducationArticles(): Promise<{ indexed: number; removed: number; errors: number }> {
  if (!isIndexIndexingActive('education_articles')) {
    return { indexed: 0, removed: 0, errors: 0 }
  }
  const cfg = readSearchConfig()
  if (!cfg.adminReindexEnabled) {
    console.warn('[search] admin reindex disabled (SEARCH_ADMIN_REINDEX_ENABLED=false)')
    return { indexed: 0, removed: 0, errors: 0 }
  }
  await ensureEducationArticlesCollection()
  const rows = await db.select().from(schema.educationArticles)
  let indexed = 0
  let removed = 0
  let errors = 0
  for (const row of rows) {
    const doc = buildEducationArticleSearchDocument(row)
    if (!doc) {
      const r = await deleteEducationArticleIndex(row.id)
      if (r.ok) removed += 1
      else errors += 1
      continue
    }
    const r = await upsertEducationArticleIndex(row.id)
    if (r.ok) indexed += 1
    else errors += 1
  }
  return { indexed, removed, errors }
}
