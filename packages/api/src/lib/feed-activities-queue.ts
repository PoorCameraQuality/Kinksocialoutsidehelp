import { Queue } from 'bullmq'
import { insertFeedActivity, type EmitActivityParams } from './feed-activities.js'

export const FEED_ACTIVITIES_QUEUE_NAME = 'c2k-feed-activities'

let feedActivitiesQueue: Queue | null = null

export function getFeedActivitiesQueue(): Queue {
  if (!feedActivitiesQueue) {
    feedActivitiesQueue = new Queue(FEED_ACTIVITIES_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return feedActivitiesQueue
}

function jobIdFor(params: EmitActivityParams): string {
  // BullMQ custom job ids must not contain ':' — use a stable delimiter instead.
  return [
    'feed-activity',
    params.actorId,
    params.verb,
    params.objectType,
    params.objectId,
  ].join('--')
}

/** Enqueue feed activity insert; inline fallback if queue unavailable (dev without Redis). */
export async function requestFeedActivityEmit(params: EmitActivityParams): Promise<void> {
  if (process.env.C2K_FEED_ACTIVITIES_INLINE === 'true') {
    await insertFeedActivity(params)
    return
  }
  try {
    await getFeedActivitiesQueue().add('emit', params, {
      jobId: jobIdFor(params),
      removeOnComplete: 200,
      removeOnFail: 50,
    })
  } catch (err) {
    console.warn('[feed-activities] queue enqueue failed. Inline fallback', err)
    await insertFeedActivity(params)
  }
}
