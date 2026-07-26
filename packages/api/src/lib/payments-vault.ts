import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { FastifyReply } from 'fastify'
import { db, schema } from '../db/index.js'
import { verifyUserPassword } from './legal-admin-auth.js'

/** Unlock window after entering the payments vault password. */
export const PAYMENTS_VAULT_TTL_MS = 30 * 60 * 1000

const MIN_VAULT_PASSWORD_LEN = 8
const MAX_VAULT_PASSWORD_LEN = 128

export type PaymentsVaultStatus = {
  configured: boolean
  unlocked: boolean
  unlockExpiresAt: string | null
}

export function validateVaultPassword(password: string): string | null {
  if (password.length < MIN_VAULT_PASSWORD_LEN) {
    return `Payments password must be at least ${MIN_VAULT_PASSWORD_LEN} characters`
  }
  if (password.length > MAX_VAULT_PASSWORD_LEN) {
    return `Payments password must be at most ${MAX_VAULT_PASSWORD_LEN} characters`
  }
  return null
}

export async function getPaymentsVaultStatus(userId: string): Promise<PaymentsVaultStatus> {
  const [row] = await db
    .select({
      hash: schema.users.paymentsVaultPasswordHash,
      unlockedAt: schema.users.paymentsVaultUnlockedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!row) return { configured: false, unlocked: false, unlockExpiresAt: null }
  const configured = Boolean(row.hash)
  if (!configured || !row.unlockedAt) {
    return { configured, unlocked: false, unlockExpiresAt: null }
  }
  const expires = row.unlockedAt.getTime() + PAYMENTS_VAULT_TTL_MS
  if (Date.now() > expires) {
    return { configured, unlocked: false, unlockExpiresAt: null }
  }
  return { configured, unlocked: true, unlockExpiresAt: new Date(expires).toISOString() }
}

export async function isPaymentsVaultUnlocked(userId: string): Promise<boolean> {
  const s = await getPaymentsVaultStatus(userId)
  return s.unlocked
}

/**
 * First-time (or rotate) set of the secondary payments password.
 * Requires the account login password; vault password must differ from login.
 */
export async function setPaymentsVaultPassword(
  userId: string,
  loginPassword: string,
  vaultPassword: string,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const lenErr = validateVaultPassword(vaultPassword)
  if (lenErr) return { ok: false, error: lenErr, code: 'invalid_vault_password' }

  const loginOk = await verifyUserPassword(userId, loginPassword)
  if (!loginOk) return { ok: false, error: 'Login password is incorrect', code: 'bad_login_password' }

  if (vaultPassword === loginPassword) {
    return {
      ok: false,
      error: 'Payments password must be different from your login password',
      code: 'vault_same_as_login',
    }
  }

  const hash = await bcrypt.hash(vaultPassword, 12)
  const now = new Date()
  await db
    .update(schema.users)
    .set({
      paymentsVaultPasswordHash: hash,
      paymentsVaultUnlockedAt: now,
    })
    .where(eq(schema.users.id, userId))
  return { ok: true }
}

export async function unlockPaymentsVault(
  userId: string,
  vaultPassword: string,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const [row] = await db
    .select({ hash: schema.users.paymentsVaultPasswordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!row?.hash) {
    return { ok: false, error: 'Payments password is not set yet', code: 'vault_not_configured' }
  }
  const ok = await bcrypt.compare(vaultPassword, row.hash)
  if (!ok) return { ok: false, error: 'Payments password is incorrect', code: 'bad_vault_password' }
  await db
    .update(schema.users)
    .set({ paymentsVaultUnlockedAt: new Date() })
    .where(eq(schema.users.id, userId))
  return { ok: true }
}

export async function lockPaymentsVault(userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ paymentsVaultUnlockedAt: null })
    .where(eq(schema.users.id, userId))
}

/** Enforce unlock before sensitive org payment routes. */
export async function requirePaymentsVaultUnlocked(
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const status = await getPaymentsVaultStatus(userId)
  if (!status.configured) {
    reply.status(403).send({
      error: 'Set a payments password before managing payment settings',
      code: 'payments_vault_setup_required',
    })
    return false
  }
  if (!status.unlocked) {
    reply.status(403).send({
      error: 'Enter your payments password to continue',
      code: 'payments_vault_locked',
    })
    return false
  }
  return true
}
