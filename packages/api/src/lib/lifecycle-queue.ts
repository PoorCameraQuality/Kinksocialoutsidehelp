import { Queue } from 'bullmq'

export const LIFECYCLE_QUEUE_NAME = 'c2k-lifecycle'

let lifecycleQueue: Queue | null = null

export function getLifecycleQueue(): Queue {
  if (!lifecycleQueue) {
    lifecycleQueue = new Queue(LIFECYCLE_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return lifecycleQueue
}
