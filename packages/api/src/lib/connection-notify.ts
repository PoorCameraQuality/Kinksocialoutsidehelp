import { NOTIFICATION_TYPES } from '@c2k/shared'
import { createNotification } from './create-notification.js'

export async function notifyConnectionRequest(
  recipientId: string,
  requesterUsername: string,
  connectionId: string
): Promise<void> {
  await createNotification(recipientId, NOTIFICATION_TYPES.connectionRequest, {
    requesterUsername,
    connectionId,
  })
}
