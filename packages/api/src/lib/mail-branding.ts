import { MAIL_BRAND_DISPLAY_NAME } from './mail-addresses.js'

/** Product name in email body/subject lines (not the SMTP From display name). */
export function mailProductName(): string {
  const raw = process.env.C2K_MAIL_PRODUCT_NAME?.trim()
  return raw || MAIL_BRAND_DISPLAY_NAME
}

function mailSubjectOverride(envKey: string, fallback: string): string {
  const raw = process.env[envKey]?.trim()
  return raw || fallback
}

export function passwordResetEmailSubject(): string {
  return mailSubjectOverride(
    'C2K_PASSWORD_RESET_EMAIL_SUBJECT',
    `${mailProductName()} password recovery`,
  )
}

export function passwordChangedEmailSubject(): string {
  return mailSubjectOverride(
    'C2K_PASSWORD_CHANGED_EMAIL_SUBJECT',
    `${mailProductName()} password changed`,
  )
}
