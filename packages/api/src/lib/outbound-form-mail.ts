import { APP_NAME } from '@c2k/shared'
import { sendEmail } from './mailer.js'
import type { MailIntakeMailboxKey } from './mail-intake-config.js'
import { platformMailboxAddress } from './mail-intake-config.js'
import { sanitizeDisplayName, sanitizeEmailSubject, validateReplyToEmail } from './mail-safety.js'

function domainFromEnv(): string {
  const url = process.env.C2K_PUBLIC_WEB_URL?.trim()
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      /* fall through */
    }
  }
  return process.env.DOMAIN?.trim() || 'kink.social'
}

export function mailboxForContactCategory(category: string): MailIntakeMailboxKey {
  switch (category) {
    case 'legal':
    case 'law_enforcement':
      return 'legal'
    case 'partnership':
      return 'business'
    case 'dmca':
      return 'abuse'
    default:
      return 'support'
  }
}

export async function sendContactFormOutboundEmail(input: {
  mailboxKey: MailIntakeMailboxKey
  subject: string
  senderName: string
  senderEmail: string
  message: string
  category?: string
}): Promise<{ ok: boolean; error?: string }> {
  const domain = domainFromEnv()
  const to = platformMailboxAddress(input.mailboxKey, domain)
  const replyTo = validateReplyToEmail(input.senderEmail)
  const name = sanitizeDisplayName(input.senderName)
  const subject = sanitizeEmailSubject(input.subject)
  const category = input.category ? sanitizeDisplayName(input.category) : undefined

  const text = [
    category ? `Category: ${category}` : null,
    `From: ${name} <${replyTo ?? input.senderEmail}>`,
    '',
    input.message.slice(0, 8000),
  ]
    .filter(Boolean)
    .join('\n')

  const html = text
    .split('\n')
    .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
    .join('')

  return sendEmail({
    to,
    subject: `[${APP_NAME} contact] ${subject}`,
    text,
    html,
    replyTo: replyTo ?? undefined,
    category:
      input.mailboxKey === 'legal' ? 'legal_request'
      : input.mailboxKey === 'security' ? 'security_report'
      : input.mailboxKey === 'abuse' ? 'abuse_report'
      : input.mailboxKey === 'business' ? 'business'
      : 'support',
    sensitive: input.mailboxKey === 'legal' || input.mailboxKey === 'security' || input.mailboxKey === 'abuse',
  })
}

export async function sendSecurityReportEmail(input: {
  subject: string
  senderName: string
  senderEmail: string
  message: string
}): Promise<{ ok: boolean; error?: string }> {
  return sendContactFormOutboundEmail({
    mailboxKey: 'security',
    subject: input.subject,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    message: input.message,
    category: 'security',
  })
}

export async function sendAbuseReportEmail(input: {
  subject: string
  senderName: string
  senderEmail: string
  message: string
}): Promise<{ ok: boolean; error?: string }> {
  return sendContactFormOutboundEmail({
    mailboxKey: 'abuse',
    subject: input.subject,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    message: input.message,
    category: 'abuse',
  })
}
