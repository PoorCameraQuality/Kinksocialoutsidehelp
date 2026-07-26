import { APP_NAME } from '@c2k/shared'
import { createHash, randomBytes } from 'node:crypto'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { canManageGroupEvents, getGroupMembership } from './group-access.js'
import { sendEmail } from './mailer.js'
import { capturePlatformEmail } from './platform-email-capture.js'
import { buildScopeEmailConfirmEmail } from './transactional-email.js'

export type ScopeKind = 'organization' | 'group'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeSubscriberEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function orgEmailListEnabled(community: unknown): boolean {
  if (!community || typeof community !== 'object' || Array.isArray(community)) return false
  return (community as { emailListEnabled?: boolean }).emailListEnabled === true
}

export function scopeEmailDoubleOptInEnabled(): boolean {
  return process.env.C2K_SCOPE_EMAIL_DOUBLE_OPTIN === 'true'
}

function hashConfirmToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function sendScopeConfirmEmail(params: {
  email: string
  scopeName: string
  confirmUrl: string
}): Promise<void> {
  const { subject, text, html } = buildScopeEmailConfirmEmail({
    scopeName: params.scopeName,
    confirmUrl: params.confirmUrl,
  })
  await sendEmail({ to: params.email, subject, text, html })
}

export async function subscribeScopeEmail(params: {
  scopeType: ScopeKind
  scopeId: string
  scopeName: string
  email: string
  displayName?: string | null
  userId?: string | null
  source?: string
}): Promise<
  { ok: true; created: boolean; pending?: boolean } | { ok: false; error: string }
> {
  const email = normalizeSubscriberEmail(params.email)
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Invalid email' }

  const doubleOptIn = scopeEmailDoubleOptInEnabled()
  const publicWeb = process.env.C2K_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5173'

  const [existing] = await db
    .select()
    .from(schema.scopeEmailSubscribers)
    .where(
      and(
        eq(schema.scopeEmailSubscribers.scopeType, params.scopeType),
        eq(schema.scopeEmailSubscribers.scopeId, params.scopeId),
        eq(schema.scopeEmailSubscribers.email, email),
      ),
    )
    .limit(1)

  if (existing?.status === 'active') {
    await capturePlatformEmail({
      email,
      eventType: 'subscribe',
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      scopeName: params.scopeName,
      metadata: { duplicate: true },
    })
    return { ok: true, created: false }
  }

  if (doubleOptIn) {
    const rawToken = randomBytes(24).toString('hex')
    const tokenHash = hashConfirmToken(rawToken)
    const confirmExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS)
    const confirmUrl = `${publicWeb}/email/confirm?token=${encodeURIComponent(rawToken)}`

    if (existing) {
      await db
        .update(schema.scopeEmailSubscribers)
        .set({
          status: 'pending',
          unsubscribedAt: null,
          displayName: params.displayName ?? existing.displayName,
          userId: params.userId ?? existing.userId,
          confirmTokenHash: tokenHash,
          confirmExpiresAt,
        })
        .where(eq(schema.scopeEmailSubscribers.id, existing.id))
    } else {
      await db.insert(schema.scopeEmailSubscribers).values({
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        email,
        displayName: params.displayName ?? null,
        userId: params.userId ?? null,
        source: params.source ?? 'public_form',
        status: 'pending',
        confirmTokenHash: tokenHash,
        confirmExpiresAt,
      })
    }

    await sendScopeConfirmEmail({ email, scopeName: params.scopeName, confirmUrl })
    await capturePlatformEmail({
      email,
      eventType: 'subscribe_pending',
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      scopeName: params.scopeName,
    })
    return { ok: true, created: !existing, pending: true }
  }

  if (existing) {
    await db
      .update(schema.scopeEmailSubscribers)
      .set({
        status: 'active',
        unsubscribedAt: null,
        displayName: params.displayName ?? existing.displayName,
        userId: params.userId ?? existing.userId,
        optedInAt: new Date(),
        confirmTokenHash: null,
        confirmExpiresAt: null,
      })
      .where(eq(schema.scopeEmailSubscribers.id, existing.id))
  } else {
    await db.insert(schema.scopeEmailSubscribers).values({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      email,
      displayName: params.displayName ?? null,
      userId: params.userId ?? null,
      source: params.source ?? 'public_form',
      status: 'active',
    })
  }

  await capturePlatformEmail({
    email,
    eventType: 'subscribe',
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    scopeName: params.scopeName,
  })

  return { ok: true, created: !existing }
}

export async function confirmScopeEmailSubscription(
  rawToken: string,
): Promise<{ ok: true; scopeName: string } | { ok: false; error: string }> {
  const token = rawToken.trim()
  if (!token || token.length < 16) return { ok: false, error: 'Invalid token' }
  const tokenHash = hashConfirmToken(token)
  const [row] = await db
    .select()
    .from(schema.scopeEmailSubscribers)
    .where(eq(schema.scopeEmailSubscribers.confirmTokenHash, tokenHash))
    .limit(1)
  if (!row) return { ok: false, error: 'Invalid or expired link' }
  if (row.status === 'active') {
    const scopeName = await resolveScopeName(row.scopeType as ScopeKind, row.scopeId)
    return { ok: true, scopeName }
  }
  if (row.confirmExpiresAt && row.confirmExpiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Confirmation link expired' }
  }

  await db
    .update(schema.scopeEmailSubscribers)
    .set({
      status: 'active',
      optedInAt: new Date(),
      confirmExpiresAt: null,
      unsubscribedAt: null,
    })
    .where(eq(schema.scopeEmailSubscribers.id, row.id))

  const scopeName = await resolveScopeName(row.scopeType as ScopeKind, row.scopeId)
  await capturePlatformEmail({
    email: row.email,
    eventType: 'subscribe_confirmed',
    scopeType: row.scopeType as ScopeKind,
    scopeId: row.scopeId,
    scopeName,
  })
  return { ok: true, scopeName }
}

async function resolveScopeName(scopeType: ScopeKind, scopeId: string): Promise<string> {
  if (scopeType === 'organization') {
    const [org] = await db
      .select({ displayName: schema.organizations.displayName })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, scopeId))
      .limit(1)
    return org?.displayName ?? 'Organization'
  }
  const [g] = await db
    .select({ name: schema.groups.name })
    .from(schema.groups)
    .where(eq(schema.groups.id, scopeId))
    .limit(1)
  return g?.name ?? 'Group'
}

export async function unsubscribeScopeEmail(params: {
  scopeType: ScopeKind
  scopeId: string
  email: string
  scopeName?: string
}): Promise<boolean> {
  const email = normalizeSubscriberEmail(params.email)
  const [row] = await db
    .select()
    .from(schema.scopeEmailSubscribers)
    .where(
      and(
        eq(schema.scopeEmailSubscribers.scopeType, params.scopeType),
        eq(schema.scopeEmailSubscribers.scopeId, params.scopeId),
        eq(schema.scopeEmailSubscribers.email, email),
      ),
    )
    .limit(1)
  if (!row) return false
  await db
    .update(schema.scopeEmailSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
    .where(eq(schema.scopeEmailSubscribers.id, row.id))
  await capturePlatformEmail({
    email,
    eventType: 'unsubscribe',
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    scopeName: params.scopeName,
  })
  return true
}

export async function listScopeSubscribers(scopeType: ScopeKind, scopeId: string, status = 'active') {
  return db
    .select({
      id: schema.scopeEmailSubscribers.id,
      email: schema.scopeEmailSubscribers.email,
      displayName: schema.scopeEmailSubscribers.displayName,
      status: schema.scopeEmailSubscribers.status,
      optedInAt: schema.scopeEmailSubscribers.optedInAt,
      source: schema.scopeEmailSubscribers.source,
    })
    .from(schema.scopeEmailSubscribers)
    .where(
      and(
        eq(schema.scopeEmailSubscribers.scopeType, scopeType),
        eq(schema.scopeEmailSubscribers.scopeId, scopeId),
        eq(schema.scopeEmailSubscribers.status, status),
      ),
    )
    .orderBy(asc(schema.scopeEmailSubscribers.optedInAt))
}

export async function canManageOrgEmailList(orgId: string, userId: string): Promise<boolean> {
  const [m] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)),
    )
    .limit(1)
  if (!m) return false
  return ['OWNER', 'ADMIN', 'MODERATOR', 'STAFF'].includes(m.role)
}

export async function canManageGroupEmailList(groupId: string, userId: string): Promise<boolean> {
  const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
  if (!g) return false
  if (g.ownerId === userId) return true
  const mem = await getGroupMembership(groupId, userId)
  return canManageGroupEvents(mem?.role?.toLowerCase() ?? null)
}

export async function sendScopeEmailBroadcast(params: {
  scopeType: ScopeKind
  scopeId: string
  /** Public route key: org slug or group id (used in unsubscribe links). */
  scopePublicKey: string
  scopeName: string
  subject: string
  text: string
  html?: string
  sentByUserId: string
}): Promise<{ sent: number; failed: number; skipped: number; transportDisabled: boolean }> {
  const subs = await listScopeSubscribers(params.scopeType, params.scopeId, 'active')
  const publicWeb = process.env.C2K_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5173'
  const footer = `\n\n, ${params.scopeName} via ${APP_NAME}\n${publicWeb}`
  const htmlFooter = `<p style="color:#888;font-size:12px">, ${params.scopeName} via ${APP_NAME}</p>`

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const sub of subs) {
    const result = await sendEmail({
      to: sub.email,
      subject: params.subject,
      text: params.text + footer,
      html: (params.html ?? `<pre>${params.text}</pre>`) + htmlFooter,
      headers: {
        'List-Unsubscribe': `<${publicWeb}/email/unsubscribe?scope=${params.scopeType}&id=${encodeURIComponent(params.scopePublicKey)}&email=${encodeURIComponent(sub.email)}>`,
      },
    })
    if (result.error === 'mail_transport_disabled') {
      skipped = subs.length
      break
    }
    if (result.ok) {
      sent += 1
      await capturePlatformEmail({
        email: sub.email,
        eventType: 'broadcast',
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        scopeName: params.scopeName,
        metadata: { subject: params.subject, sentByUserId: params.sentByUserId },
      })
    } else {
      failed += 1
    }
  }

  return {
    sent,
    failed,
    skipped,
    transportDisabled: skipped === subs.length && subs.length > 0,
  }
}

export async function countScopeSubscribers(
  scopeType: ScopeKind,
  scopeId: string,
  status: 'active' | 'pending' = 'active',
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.scopeEmailSubscribers)
    .where(
      and(
        eq(schema.scopeEmailSubscribers.scopeType, scopeType),
        eq(schema.scopeEmailSubscribers.scopeId, scopeId),
        eq(schema.scopeEmailSubscribers.status, status),
      ),
    )
  return row?.n ?? 0
}
