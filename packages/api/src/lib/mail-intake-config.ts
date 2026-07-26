import { APP_DOMAIN } from '@c2k/shared'
import { platformMailboxEmail } from './mail-addresses.js'

export type MailIntakeMailboxKey = 'support' | 'legal' | 'business' | 'abuse' | 'security'

export type MailIntakeMailboxConfig = {
  key: MailIntakeMailboxKey
  user: string
  pass: string
  mailbox: string
  visibility: 'owner_only' | 'admin_only' | 'trust_safety' | 'support' | 'business'
}

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function isMailIntakeEnabled(): boolean {
  return process.env.C2K_MAIL_INTAKE_ENABLED === 'true'
}

export function mailIntakeImapHost(): string {
  return envTrim('C2K_MAIL_INTAKE_IMAP_HOST') || envTrim('SMTP_HOST') || 'mailserver'
}

export function mailIntakeImapPort(): number {
  return Number(process.env.C2K_MAIL_INTAKE_IMAP_PORT ?? 993)
}

export function mailIntakeImapSecure(): boolean {
  return process.env.C2K_MAIL_INTAKE_IMAP_SECURE !== 'false'
}

export function configuredMailIntakeMailboxes(): MailIntakeMailboxConfig[] {
  const entries: Array<{ key: MailIntakeMailboxKey; userEnv: string; passEnv: string; visibility: MailIntakeMailboxConfig['visibility'] }> = [
    { key: 'support', userEnv: 'C2K_MAIL_INTAKE_SUPPORT_USER', passEnv: 'C2K_MAIL_INTAKE_SUPPORT_PASS', visibility: 'support' },
    { key: 'legal', userEnv: 'C2K_MAIL_INTAKE_LEGAL_USER', passEnv: 'C2K_MAIL_INTAKE_LEGAL_PASS', visibility: 'owner_only' },
    { key: 'business', userEnv: 'C2K_MAIL_INTAKE_BUSINESS_USER', passEnv: 'C2K_MAIL_INTAKE_BUSINESS_PASS', visibility: 'business' },
    { key: 'abuse', userEnv: 'C2K_MAIL_INTAKE_ABUSE_USER', passEnv: 'C2K_MAIL_INTAKE_ABUSE_PASS', visibility: 'trust_safety' },
    { key: 'security', userEnv: 'C2K_MAIL_INTAKE_SECURITY_USER', passEnv: 'C2K_MAIL_INTAKE_SECURITY_PASS', visibility: 'owner_only' },
  ]

  const out: MailIntakeMailboxConfig[] = []
  for (const e of entries) {
    const user = envTrim(e.userEnv)
    const pass = envTrim(e.passEnv)
    if (!user || !pass) continue
    out.push({ key: e.key, user, pass, mailbox: user.toLowerCase(), visibility: e.visibility })
  }
  return out
}

/** Default IMAP sweep interval: 1 hour. Override with C2K_MAIL_INTAKE_REPEAT_MS (ms, min 60s). */
export function mailIntakeRepeatMs(): number {
  return Math.max(60_000, Number(process.env.C2K_MAIL_INTAKE_REPEAT_MS ?? 3_600_000))
}

/** Public-facing mailbox addresses for outbound form routing. */
export function platformMailboxAddress(kind: MailIntakeMailboxKey, domain = APP_DOMAIN): string {
  return platformMailboxEmail(kind, domain)
}
