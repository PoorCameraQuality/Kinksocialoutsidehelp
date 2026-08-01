import { createNotification } from './create-notification.js'
import { sendWebPushToUsers } from './web-push-send.js'

type DancecardNotifType =
  | 'dancecard_booking_requested'
  | 'dancecard_booking_accepted'
  | 'dancecard_booking_declined'
  | 'dancecard_scene_cancelled'
  | 'dancecard_reschedule_requested'
  | 'dancecard_reschedule_accepted'

const PUSH_COPY: Record<
  DancecardNotifType,
  { title: string; body: string }
> = {
  dancecard_booking_requested: {
    title: 'Scene booking request',
    body: 'Someone requested time on your dancecard.',
  },
  dancecard_booking_accepted: {
    title: 'Booking accepted',
    body: 'Your scene booking was accepted.',
  },
  dancecard_booking_declined: {
    title: 'Booking declined',
    body: 'Your scene request was declined.',
  },
  dancecard_scene_cancelled: {
    title: 'Scene cancelled',
    body: 'A scene on your dancecard was cancelled.',
  },
  dancecard_reschedule_requested: {
    title: 'Scene rescheduled',
    body: 'A scene time was changed — check your dancecard.',
  },
  dancecard_reschedule_accepted: {
    title: 'Reschedule confirmed',
    body: 'Your scene reschedule was confirmed.',
  },
}

function playSpaceHref(slug: string): string {
  return `/play/${encodeURIComponent(slug)}`
}

/**
 * In-app notification + optional Web Push for play-space dancecard events.
 * Skips when userId is null (anonymous guests).
 */
export async function notifyPlaySpaceDancecard(input: {
  userId: string | null | undefined
  type: DancecardNotifType
  playSpaceId: string
  playSpaceSlug: string
  bookingRequestId: string
  actorUserId?: string
}): Promise<void> {
  const userId = input.userId?.trim()
  if (!userId) return

  const href = playSpaceHref(input.playSpaceSlug)
  const payload: Record<string, unknown> = {
    playSpaceId: input.playSpaceId,
    playSpaceSlug: input.playSpaceSlug,
    bookingRequestId: input.bookingRequestId,
    href,
  }
  if (input.actorUserId) payload.actorUserId = input.actorUserId

  await createNotification(userId, input.type, payload)

  const copy = PUSH_COPY[input.type]
  void sendWebPushToUsers([userId], {
    title: copy.title,
    body: copy.body,
    url: href,
  }).catch(() => {
    /* push is best-effort */
  })
}
