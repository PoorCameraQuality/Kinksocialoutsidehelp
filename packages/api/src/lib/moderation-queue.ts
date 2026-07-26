import { Queue } from 'bullmq'

export const MODERATION_QUEUE_NAME = 'c2k-moderation'

let moderationQueue: Queue | null = null

export function getModerationQueue(): Queue {
  if (!moderationQueue) {
    moderationQueue = new Queue(MODERATION_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return moderationQueue
}
