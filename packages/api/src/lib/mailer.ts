/**

 * Pluggable outbound email (SMTP or Resend). Default: disabled (dev-safe).

 * Set C2K_PLATFORM_MAIL_BCC to BCC the site owner on every outbound message.

 * Sensitive categories (password reset, legal, etc.) never receive platform BCC.

 */

import {
  formatMailFromAddress,
} from './mail-addresses.js'
import nodemailer from 'nodemailer'
import { stripHeaderInjection, validateReplyToEmail } from './mail-safety.js'

export type MailCategory =
  | 'password_reset'
  | 'password_changed'
  | 'email_verification'
  | 'account_welcome'
  | 'event_rsvp'
  | 'org_digest'
  | 'legal_request'
  | 'support'
  | 'business'
  | 'security_report'
  | 'abuse_report'
  | 'moderation'
  | 'dm_notification'
  | 'transactional'
  | 'marketing'

const SENSITIVE_CATEGORIES = new Set<MailCategory>([
  'password_reset',
  'password_changed',
  'email_verification',
  'legal_request',
  'security_report',
  'abuse_report',
  'moderation',
  'dm_notification',
])

export type SendEmailInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  headers?: Record<string, string>
  /** Extra BCC recipients (merged with C2K_PLATFORM_MAIL_BCC unless sensitive/noBcc). */
  bcc?: string | string[]
  /** Reply-To header — validated; invalid values are ignored. */
  replyTo?: string
  /** When true, platform BCC is never applied (even for non-sensitive categories). */
  noBcc?: boolean
  /** When true, platform BCC is never applied. */
  sensitive?: boolean
  /** Used to auto-mark sensitive mail and skip platform BCC. */
  category?: MailCategory
}

export function mailTransportMode(): 'disabled' | 'smtp' | 'resend' {
  const t = (process.env.C2K_MAIL_TRANSPORT ?? 'disabled').toLowerCase().trim()
  if (t === 'smtp' || t === 'resend') return t
  return 'disabled'
}

export function defaultMailReplyTo(): string | null {
  const raw = process.env.C2K_MAIL_REPLY_TO?.trim()
  if (!raw) return null
  return validateReplyToEmail(raw)
}

export function platformMailBcc(): string[] {
  const raw = process.env.C2K_PLATFORM_MAIL_BCC?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('@'))
}

function normalizeRecipients(v: string | string[]): string[] {
  const list = Array.isArray(v) ? v : [v]
  return list.map((s) => s.trim()).filter((s) => s.includes('@'))
}

function isSensitiveSend(input: SendEmailInput): boolean {
  if (input.sensitive || input.noBcc) return true
  if (input.category && SENSITIVE_CATEGORIES.has(input.category)) return true
  return false
}

function mergeBcc(explicit: string | string[] | undefined, input: SendEmailInput): string[] | undefined {
  if (isSensitiveSend(input)) return normalizeRecipients(explicit ?? []).length > 0 ?
      [...new Set(normalizeRecipients(explicit ?? []).map((e) => e.toLowerCase()))]
    : undefined
  const merged = [...platformMailBcc(), ...normalizeRecipients(explicit ?? [])]
  const uniq = [...new Set(merged.map((e) => e.toLowerCase()))]
  return uniq.length > 0 ? uniq : undefined
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHeaders(input: SendEmailInput): Record<string, string> | undefined {
  const headers: Record<string, string> = { ...(input.headers ?? {}) }
  const replyTo = validateReplyToEmail(input.replyTo) ?? defaultMailReplyTo()
  if (replyTo) {
    headers['Reply-To'] = replyTo
  }
  return Object.keys(headers).length > 0 ? headers : undefined
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const mode = mailTransportMode()
  if (mode === 'disabled') {
    return { ok: false, error: 'mail_transport_disabled' }
  }

  const from = process.env.C2K_MAIL_FROM?.trim() || formatMailFromAddress('noreply')
  const toList = normalizeRecipients(input.to)
  if (toList.length === 0) return { ok: false, error: 'no_recipients' }
  const bcc = mergeBcc(input.bcc, input)
  const subject = stripHeaderInjection(input.subject, 255)
  const headers = buildHeaders(input)

  if (mode === 'resend') {
    const key = process.env.RESEND_API_KEY?.trim()
    if (!key) return { ok: false, error: 'RESEND_API_KEY_missing' }
    const body: Record<string, unknown> = {
      from,
      to: toList.length === 1 ? toList[0] : toList,
      subject,
      text: input.text,
      html: input.html ?? `<pre style="white-space:pre-wrap">${escapeHtml(input.text)}</pre>`,
    }
    if (bcc) body.bcc = bcc
    if (headers && Object.keys(headers).length > 0) {
      body.headers = headers
    }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return { ok: false, error: `resend_${r.status}: ${errText.slice(0, 200)}` }
    }
    return { ok: true }
  }

  const host = process.env.SMTP_HOST?.trim() ?? process.env.C2K_SMTP_HOST?.trim()
  if (!host) return { ok: false, error: 'SMTP_HOST_missing' }
  const port = Number(process.env.SMTP_PORT ?? process.env.C2K_SMTP_PORT ?? 587)
  const secure =
    process.env.SMTP_SECURE === 'true' || process.env.C2K_SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER?.trim() ?? process.env.C2K_SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS ?? process.env.C2K_SMTP_PASS ?? ''

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  })

  try {
    await transporter.sendMail({
      from,
      to: toList.length === 1 ? toList[0] : toList,
      bcc: bcc?.join(', '),
      subject,
      text: input.text,
      html: input.html,
      headers,
      replyTo: headers?.['Reply-To'],
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
