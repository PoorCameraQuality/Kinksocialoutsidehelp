import type { NotificationType } from '@c2k/shared'
import { db, schema } from '../db/index.js'

export async function createNotification(
  userId: string,
  type: NotificationType | string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await db.insert(schema.notifications).values({
    userId,
    type,
    payload,
  })
}
