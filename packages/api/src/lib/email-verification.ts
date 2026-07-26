import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { mailProductName } from './mail-branding.js'
import { sendEmail } from './mailer.js'
import { getEmailFromUserRow } from './user-email.js'

const TOKEN_TTL_MS = 45 * 60 * 1000

function authPepper(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.COOKIE_SECRET?.trim() ||
    'dev-insecure-auth-secret-change-me-in-env'
  )
}

/** HMAC-SHA256 so leaked 6-digit code hashes are not offline-bruteforceable without the pepper. */
export function hashEmailVerificationSecret(raw: string): string {
  return createHmac('sha256', authPepper()).update(raw).digest('hex')
}

export function generateEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url')
}

/** 6-digit numeric code for onboarding UI. */
export function generateEmailVerificationCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function emailVerificationPublicWebUrl(): string {
  return (process.env.C2K_PUBLIC_WEB_URL ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
}

export function buildEmailVerificationLink(rawToken: string): string {
  return `${emailVerificationPublicWebUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!domain) return '***'
  const keep = Math.min(2, local.length)
  return `${local.slice(0, keep)}***@${domain}`
}

export function buildEmailVerificationEmail(input: {
  code: string
  rawToken: string
}): { subject: string; text: string; html: string } {
  const product = mailProductName()
  const link = buildEmailVerificationLink(input.rawToken)
  const ttlMinutes = Math.round(TOKEN_TTL_MS / 60_000)
  const subject = `Verify your ${product} email`
  const text = [
    `Verify your email for ${product}.`,
    '',
    `Your code: ${input.code}`,
    '',
    `Or open this link (expires in about ${ttlMinutes} minutes):`,
    link,
    '',
    'If you did not create an account, you can ignore this email.',
  ].join('\n')
  const html = [
    `<p>Verify your email for ${product}.</p>`,
    `<p>Your code: <strong>${input.code}</strong></p>`,
    `<p><a href="${link}">Verify email</a> (expires in about ${ttlMinutes} minutes).</p>`,
    '<p>If you did not create an account, you can ignore this email.</p>',
  ].join('')
  return { subject, text, html }
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export async function sendEmailVerificationForUser(input: {
  userId: string
  log: { warn: (obj: object, msg?: string) => void }
}): Promise<{ ok: true; emailMasked: string } | { ok: false; status: number; error: string }> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, input.userId), isNull(schema.users.deletedAt)))
    .limit(1)
  if (!user) return { ok: false, status: 404, error: 'User not found' }
  if (user.emailVerifiedAt) {
    const email = getEmailFromUserRow(user)
    return { ok: true, emailMasked: email ? maskEmail(email) : '***' }
  }
  const email = getEmailFromUserRow(user)
  if (!email) return { ok: false, status: 400, error: 'No email on this account' }

  const rawToken = generateEmailVerificationToken()
  const code = generateEmailVerificationCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS)

  await db.delete(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.userId, user.id))
  await db.insert(schema.emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashEmailVerificationSecret(rawToken),
    codeHash: hashEmailVerificationSecret(code),
    expiresAt,
    createdAt: now,
  })

  const built = buildEmailVerificationEmail({ code, rawToken })
  const sent = await sendEmail({
    to: email,
    subject: built.subject,
    text: built.text,
    html: built.html,
    category: 'email_verification',
  })
  if (!sent.ok) {
    input.log.warn({ err: sent.error, userId: user.id }, 'email verification send failed')
    return { ok: false, status: 502, error: 'Could not send verification email' }
  }
  return { ok: true, emailMasked: maskEmail(email) }
}

export async function verifyEmailWithSecret(input: {
  userId?: string | null
  token?: string | null
  code?: string | null
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = input.token?.trim()
  const code = input.code?.trim()
  if (!token && !code) return { ok: false, status: 400, error: 'Code or token required' }

  const now = new Date()
  let match: typeof schema.emailVerificationTokens.$inferSelect | undefined

  if (token) {
    const hash = hashEmailVerificationSecret(token)
    const [row] = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(
        and(
          eq(schema.emailVerificationTokens.tokenHash, hash),
          isNull(schema.emailVerificationTokens.usedAt),
          gt(schema.emailVerificationTokens.expiresAt, now),
        ),
      )
      .limit(1)
    match = row
  } else if (code && input.userId) {
    const codeHash = hashEmailVerificationSecret(code)
    const rows = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(
        and(
          eq(schema.emailVerificationTokens.userId, input.userId),
          isNull(schema.emailVerificationTokens.usedAt),
          gt(schema.emailVerificationTokens.expiresAt, now),
        ),
      )
    match = rows.find((row) => row.codeHash && safeEqualHex(row.codeHash, codeHash))
  }

  if (!match) return { ok: false, status: 400, error: 'Invalid or expired verification code' }
  if (input.userId && match.userId !== input.userId && !token) {
    return { ok: false, status: 400, error: 'Invalid or expired verification code' }
  }

  await db
    .update(schema.emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(schema.emailVerificationTokens.id, match.id))
  await db
    .update(schema.users)
    .set({ emailVerifiedAt: now })
    .where(eq(schema.users.id, match.userId))
  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, match.userId))

  return { ok: true }
}

export async function getEmailVerificationStatus(userId: string): Promise<{
  verified: boolean
  emailMasked: string | null
  hasEmail: boolean
}> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1)
  if (!user) return { verified: false, emailMasked: null, hasEmail: false }
  const email = getEmailFromUserRow(user)
  return {
    verified: Boolean(user.emailVerifiedAt),
    emailMasked: email ? maskEmail(email) : null,
    hasEmail: Boolean(email),
  }
}
