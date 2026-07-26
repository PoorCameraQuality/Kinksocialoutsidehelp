import { Queue } from 'bullmq'

/** BullMQ queue for Etsy / Shopify / Woo listing sync jobs. */
export const EXTERNAL_SYNC_QUEUE_NAME = 'c2k-external-sync'

let externalSyncQueue: Queue | null = null

export function getExternalSyncQueue(): Queue {
  if (!externalSyncQueue) {
    externalSyncQueue = new Queue(EXTERNAL_SYNC_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return externalSyncQueue
}

/** @deprecated use getExternalSyncQueue */
export const ETSY_SYNC_QUEUE_NAME = EXTERNAL_SYNC_QUEUE_NAME
export function getEtsySyncQueue(): Queue {
  return getExternalSyncQueue()
}
