import { Queue } from 'bullmq'

export const CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME = 'c2k-convention-participation-offer'

export type ParticipationOfferEmailJob = {
  offerId: string
  conventionId: string
}

let offerQueue: Queue<ParticipationOfferEmailJob> | null = null

export function getParticipationOfferQueue(): Queue<ParticipationOfferEmailJob> {
  if (!offerQueue) {
    offerQueue = new Queue(CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME, {
      connection: { url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' },
    })
  }
  return offerQueue
}

export async function enqueueParticipationOfferEmail(offerId: string, conventionId: string): Promise<void> {
  try {
    await getParticipationOfferQueue().add(
      'send-offer-email',
      { offerId, conventionId },
      {
        jobId: `participation-offer:${offerId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    )
  } catch (err) {
    console.warn('[participation-offer] queue enqueue failed. Inline fallback', err)
    const { sendParticipationOfferEmail } = await import('./convention-participation-offer-email.js')
    await sendParticipationOfferEmail(offerId)
  }
}
