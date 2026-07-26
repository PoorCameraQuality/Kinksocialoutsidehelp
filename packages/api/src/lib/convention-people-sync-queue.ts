import { Queue } from 'bullmq'
import { syncConventionPeopleDirectory } from './convention-people-sync.js'

export const CONVENTION_PEOPLE_SYNC_QUEUE_NAME = 'c2k-convention-people-sync'

let peopleSyncQueue: Queue | null = null

export function getConventionPeopleSyncQueue(): Queue {
  if (!peopleSyncQueue) {
    peopleSyncQueue = new Queue(CONVENTION_PEOPLE_SYNC_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return peopleSyncQueue
}

/** Enqueue people-directory rebuild; inline fallback if queue unavailable (dev without Redis). */
export async function requestConventionPeopleDirectorySync(conventionId: string): Promise<void> {
  if (process.env.C2K_PEOPLE_SYNC_INLINE === 'true') {
    await syncConventionPeopleDirectory(conventionId)
    return
  }
  try {
    await getConventionPeopleSyncQueue().add(
      'sync-directory',
      { conventionId },
      {
        jobId: `people-sync:${conventionId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    )
  } catch (err) {
    console.warn('[people-sync] queue enqueue failed. Inline fallback', err)
    await syncConventionPeopleDirectory(conventionId)
  }
}
