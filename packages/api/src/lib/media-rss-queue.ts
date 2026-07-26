import { Queue } from 'bullmq'

export const MEDIA_RSS_QUEUE_NAME = 'c2k-media-rss'

let mediaRssQueue: Queue | null = null

export function getMediaRssQueue(): Queue {
  if (!mediaRssQueue) {
    mediaRssQueue = new Queue(MEDIA_RSS_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return mediaRssQueue
}

export async function enqueueMediaShowRssSync(showId: string): Promise<void> {
  try {
    await getMediaRssQueue().add(
      'sync-show',
      { showId },
      { jobId: `media-rss-${showId}`, removeOnComplete: true },
    )
  } catch (e) {
    console.warn('[media-rss] enqueue failed', showId, e)
  }
}
