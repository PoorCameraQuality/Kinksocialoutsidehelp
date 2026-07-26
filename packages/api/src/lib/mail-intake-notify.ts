import { NOTIFICATION_TYPES } from '@c2k/shared'
import { createNotification } from './create-notification.js'
import type { MailIntakeMailboxKey } from './mail-intake-config.js'
import { listSiteAdminOnlyUserIds, listSiteOwnerUserIds, listTrustSafetyAdminUserIds } from './platform-staff.js'

const SAFE_LABELS: Record<MailIntakeMailboxKey, string> = {
  support: 'New support email received.',
  legal: 'New legal email received.',
  business: 'New business inquiry email received.',
  abuse: 'New abuse or safety email received.',
  security: 'New security report email received.',
}

async function listTrustSafetyUserIds(): Promise<string[]> {
  return listTrustSafetyAdminUserIds()
}

export async function notifyMailIntakeImported(input: {
  mailboxKey: MailIntakeMailboxKey
  itemId: string
}): Promise<void> {
  const body = SAFE_LABELS[input.mailboxKey]
  const payload = { itemId: input.itemId, mailboxKey: input.mailboxKey }

  let recipients: string[] = []
  switch (input.mailboxKey) {
    case 'support':
      recipients = await listSiteAdminOnlyUserIds()
      break
    case 'business':
      recipients = await listSiteAdminOnlyUserIds()
      break
    case 'abuse':
      recipients = [...new Set([...(await listTrustSafetyUserIds()), ...(await listSiteOwnerUserIds())])]
      break
    case 'legal':
    case 'security':
      recipients = await listSiteOwnerUserIds()
      break
    default:
      recipients = await listSiteAdminOnlyUserIds()
  }

  const unique = [...new Set(recipients)]
  await Promise.all(
    unique.map((userId) =>
      createNotification(userId, NOTIFICATION_TYPES.mailIntakeReceived, {
        ...payload,
        body,
        title: body,
      }),
    ),
  )
}
