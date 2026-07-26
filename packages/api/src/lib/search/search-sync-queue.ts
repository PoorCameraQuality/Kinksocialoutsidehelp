import { Queue } from 'bullmq'
import { readSearchConfig } from './config.js'
import { isIndexIndexingActive } from './index-registry.js'
import {
  deleteEducationArticleIndex,
  reindexAllEducationArticles,
  upsertEducationArticleIndex,
} from './education/education-sync.js'

export const SEARCH_SYNC_QUEUE_NAME = 'c2k-search-sync'

export type SearchSyncJobName =
  | 'upsert-education-article'
  | 'delete-education-article'
  | 'reindex-education-articles'

let searchSyncQueue: Queue | null = null

export function getSearchSyncQueue(): Queue {
  if (!searchSyncQueue) {
    searchSyncQueue = new Queue(SEARCH_SYNC_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return searchSyncQueue
}

async function runInlineSearchSync(name: SearchSyncJobName, data: Record<string, string>): Promise<void> {
  if (name === 'upsert-education-article') {
    const articleId = data.articleId
    if (articleId) await upsertEducationArticleIndex(articleId)
    return
  }
  if (name === 'delete-education-article') {
    const articleId = data.articleId
    if (articleId) await deleteEducationArticleIndex(articleId)
    return
  }
  if (name === 'reindex-education-articles') {
    await reindexAllEducationArticles()
  }
}

/** Enqueue search index sync after DB commit; inline fallback when queue unavailable. */
export async function enqueueSearchSyncJob(
  name: SearchSyncJobName,
  data: Record<string, string>,
): Promise<void> {
  if (!isIndexIndexingActive('education_articles') && name.startsWith('upsert-education')) return
  if (!isIndexIndexingActive('education_articles') && name.startsWith('delete-education')) return
  if (name === 'reindex-education-articles' && !readSearchConfig().adminReindexEnabled) return

  if (process.env.C2K_SEARCH_SYNC_INLINE === 'true') {
    await runInlineSearchSync(name, data)
    return
  }

  try {
    const jobId =
      name === 'reindex-education-articles'
        ? 'search-reindex-education'
        : `${name}:${data.articleId ?? 'all'}`
    await getSearchSyncQueue().add(name, data, {
      jobId,
      removeOnComplete: 200,
      removeOnFail: 50,
    })
  } catch (err) {
    console.warn('[search] queue enqueue failed — inline fallback', (err as Error).message)
    await runInlineSearchSync(name, data)
  }
}

export async function processSearchSyncJob(
  name: string,
  data: Record<string, string | undefined>,
): Promise<void> {
  await runInlineSearchSync(name as SearchSyncJobName, data as Record<string, string>)
}
