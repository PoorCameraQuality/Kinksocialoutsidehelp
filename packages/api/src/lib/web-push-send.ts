import webpush from 'web-push'
import { platformMailboxEmail } from './mail-addresses.js'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type WebPushPayload = {
  title: string
  body: string
  url?: string
}

export function webPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim())
}

export function vapidPublicKey(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY?.trim()
  return k || null
}

function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${platformMailboxEmail('admin')}`
  if (!pub || !priv) return false
  webpush.setVapidDetails(subject, pub, priv)
  return true
}

/** Send push to all subscriptions for the given user ids (skips when VAPID unset). */
export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!webPushConfigured() || userIds.length === 0) return { sent: 0, failed: 0 }
  if (!ensureVapid()) return { sent: 0, failed: 0 }

  const { isUserPushEnabled } = await import('./hub-push-preferences.js')
  const eligible: string[] = []
  for (const id of [...new Set(userIds)]) {
    if (await isUserPushEnabled(id)) eligible.push(id)
  }
  if (eligible.length === 0) return { sent: 0, failed: 0 }

  const uniqueIds = eligible
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(inArray(schema.pushSubscriptions.userId, uniqueIds))

  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      )
      sent += 1
    } catch (e) {
      failed += 1
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
      }
    }
  }

  return { sent, failed }
}
