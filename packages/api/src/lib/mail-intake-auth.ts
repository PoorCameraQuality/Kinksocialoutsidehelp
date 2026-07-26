import { isSiteAdmin, isSiteOwner, isTrustSafetyAdmin } from './platform-staff.js'
import type { MailIntakeItem } from '../db/schema.js'

export type MailIntakeTab = 'support' | 'legal' | 'business' | 'abuse' | 'security'

const TAB_VISIBILITY: Record<MailIntakeTab, MailIntakeItem['visibility'][]> = {
  support: ['support'],
  legal: ['owner_only'],
  business: ['business', 'admin_only'],
  abuse: ['trust_safety'],
  security: ['owner_only'],
}

export async function canViewMailIntakeTab(userId: string, tab: MailIntakeTab): Promise<boolean> {
  if (await isSiteOwner(userId)) return true
  switch (tab) {
    case 'support':
      return await isSiteAdmin(userId)
    case 'business':
      return await isSiteAdmin(userId)
    case 'abuse':
      return await isTrustSafetyAdmin(userId)
    case 'legal':
    case 'security':
      return false
    default:
      return false
  }
}

export async function canViewMailIntakeItem(userId: string, item: MailIntakeItem): Promise<boolean> {
  if (await isSiteOwner(userId)) return true
  if (item.visibility === 'owner_only') return false
  if (item.visibility === 'support') return await isSiteAdmin(userId)
  if (item.visibility === 'business' || item.visibility === 'admin_only') return await isSiteAdmin(userId)
  if (item.visibility === 'trust_safety') {
    if (await isTrustSafetyAdmin(userId)) return true
    return item.assignedToUserId === userId
  }
  return false
}

export function visibilitiesForTab(tab: MailIntakeTab): MailIntakeItem['visibility'][] {
  return TAB_VISIBILITY[tab]
}

export function mailboxKeyFromAddress(mailbox: string): MailIntakeTab | null {
  const local = mailbox.split('@')[0]?.toLowerCase()
  if (local === 'support') return 'support'
  if (local === 'legal') return 'legal'
  if (local === 'business') return 'business'
  if (local === 'abuse') return 'abuse'
  if (local === 'security') return 'security'
  return null
}
