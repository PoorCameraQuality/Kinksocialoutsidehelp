/**
 * Outbound ECKE publish job queue (BullMQ).
 *
 * Prefer Redis enqueue so HTTP handlers return before network I/O. Two inline paths:
 * - `C2K_ECKE_PUBLISH_INLINE=true` — always run the job in-process (local/dev without workers).
 * - Enqueue failure (Redis down, etc.) — warn and run the same job inline so publish is not lost.
 * Inline fallback moves side effects onto the request path; production should keep Redis + workers healthy.
 */
import { Queue } from 'bullmq'
import {
  executeEckePublishArticle,
  executeEckePublishConventionEvent,
  executeEckePublishStandaloneEvent,
  executeEckePublishVendor,
  type EckePublishJobName,
} from './ecke-publish-executor.js'
import type { EckePublishResult } from './ecke-publish-client.js'

export const ECKE_PUBLISH_QUEUE_NAME = 'c2k-ecke-publish'

let eckePublishQueue: Queue | null = null

export function getEckePublishQueue(): Queue {
  if (!eckePublishQueue) {
    eckePublishQueue = new Queue(ECKE_PUBLISH_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return eckePublishQueue
}

async function enqueueOrInline(
  jobName: EckePublishJobName,
  data: Record<string, string | undefined>,
  jobId: string,
): Promise<void> {
  if (process.env.C2K_ECKE_PUBLISH_INLINE === 'true') {
    await runEckePublishJob(jobName, data)
    return
  }
  try {
    await getEckePublishQueue().add(jobName, data, {
      jobId,
      removeOnComplete: 200,
      removeOnFail: 100,
    })
  } catch (err) {
    console.warn('[ecke-publish] queue enqueue failed. Inline fallback', err)
    await runEckePublishJob(jobName, data)
  }
}

export async function requestEckeArticlePublish(articleId: string, userId?: string): Promise<void> {
  await enqueueOrInline('publish-article', { articleId, userId }, `ecke-article-${articleId}`)
}

export async function requestEckeVendorPublish(vendorProfileId: string, userId?: string): Promise<void> {
  await enqueueOrInline('publish-vendor', { vendorProfileId, userId }, `ecke-vendor-${vendorProfileId}`)
}

export async function requestEckeConventionEventPublish(conventionId: string, userId?: string): Promise<void> {
  await enqueueOrInline(
    'publish-convention-event',
    { conventionId, userId },
    `ecke-convention-event-${conventionId}`,
  )
}

export async function requestEckeStandaloneEventPublish(eventId: string, userId?: string): Promise<void> {
  await enqueueOrInline('publish-standalone-event', { eventId, userId }, `ecke-standalone-event-${eventId}`)
}

export async function runEckePublishJob(
  jobName: EckePublishJobName,
  data: Record<string, string | undefined>,
): Promise<EckePublishResult> {
  let result: EckePublishResult
  switch (jobName) {
    case 'publish-article':
      if (!data.articleId) throw new Error('publish-article missing articleId')
      result = await executeEckePublishArticle(data.articleId, data.userId)
      break
    case 'publish-vendor':
      if (!data.vendorProfileId) throw new Error('publish-vendor missing vendorProfileId')
      result = await executeEckePublishVendor(data.vendorProfileId, data.userId)
      break
    case 'publish-convention-event':
      if (!data.conventionId) throw new Error('publish-convention-event missing conventionId')
      result = await executeEckePublishConventionEvent(data.conventionId, data.userId)
      break
    case 'publish-standalone-event':
      if (!data.eventId) throw new Error('publish-standalone-event missing eventId')
      result = await executeEckePublishStandaloneEvent(data.eventId, data.userId)
      break
    default:
      throw new Error(`[ecke-publish] unknown job ${String(jobName)}`)
  }

  if (!result.ok) {
    throw new Error(result.error || `${jobName} failed`)
  }
  return result
}
