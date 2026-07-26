import { APP_DOMAIN } from '@c2k/shared'

/** SMTP From display name for outbound mail. */
export const MAIL_BRAND_DISPLAY_NAME = 'Kink.Social'

export type PlatformMailboxRole =
  | 'noreply'
  | 'support'
  | 'legal'
  | 'business'
  | 'security'
  | 'admin'
  | 'abuse'
  | 'postmaster'

export function platformMailboxEmail(role: PlatformMailboxRole, domain = APP_DOMAIN): string {
  return `${role}@${domain}`
}

export function formatMailFromAddress(role: PlatformMailboxRole = 'noreply', domain = APP_DOMAIN): string {
  return `${MAIL_BRAND_DISPLAY_NAME} <${platformMailboxEmail(role, domain)}>`
}
