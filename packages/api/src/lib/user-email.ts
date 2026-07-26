import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { decryptField, encryptField, hmacLookup } from './field-encryption.js'

export type UserEmailRow = {
  email?: string | null
  emailCiphertext?: string | null
  emailKeyVersion?: number | null
}

/** Drizzle select fragment for email resolution (encrypted + legacy). */
export const userEmailSelect = {
  email: schema.users.email,
  emailCiphertext: schema.users.emailCiphertext,
  emailKeyVersion: schema.users.emailKeyVersion,
} as const

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function emailLookupHash(normalizedEmail: string): string {
  return hmacLookup(normalizedEmail, 'email')
}

export function prepareEmailStorage(rawEmail: string): {
  email: null
  emailCiphertext: string
  emailLookupHash: string
  emailKeyVersion: number
} {
  const normalized = normalizeEmail(rawEmail)
  const enc = encryptField(normalized)
  return {
    email: null,
    emailCiphertext: enc.ciphertext,
    emailLookupHash: emailLookupHash(normalized),
    emailKeyVersion: enc.keyVersion,
  }
}

/** Resolve plaintext email from a user row (encrypted or legacy plaintext column). */
export function getEmailFromUserRow(row: UserEmailRow | null | undefined): string | null {
  if (!row) return null
  if (row.emailCiphertext) {
    const version = row.emailKeyVersion ?? 1
    const decrypted = decryptField(row.emailCiphertext, version)
    if (decrypted) return decrypted
  }
  const legacy = row.email?.trim()
  return legacy || null
}

export async function findUserByEmailLookup(email: string) {
  const normalized = normalizeEmail(email)
  const hash = emailLookupHash(normalized)
  const [byHash] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.emailLookupHash, hash), isNull(schema.users.deletedAt)))
    .limit(1)
  if (byHash) return byHash
  const [legacy] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, normalized), isNull(schema.users.deletedAt)))
    .limit(1)
  return legacy ?? null
}

/** Resolve a login or password-reset identifier (username or email). */
export async function findUserByLoginIdentifier(identifier: string) {
  const trimmed = identifier.trim()
  if (!trimmed) return null
  const normalized = normalizeEmail(trimmed)
  if (normalized.includes('@')) {
    return findUserByEmailLookup(normalized)
  }
  const [row] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.username, trimmed), isNull(schema.users.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function getUserEmailById(userId: string): Promise<string | null> {
  const [row] = await db
    .select({
      email: schema.users.email,
      emailCiphertext: schema.users.emailCiphertext,
      emailKeyVersion: schema.users.emailKeyVersion,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  return getEmailFromUserRow(row)
}

/** Migrate a legacy plaintext email row to encrypted storage (idempotent). */
export async function migrateUserEmailEncryption(userId: string): Promise<boolean> {
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      emailCiphertext: schema.users.emailCiphertext,
      emailLookupHash: schema.users.emailLookupHash,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!row) return false
  if (row.emailCiphertext && row.emailLookupHash) return true
  const plaintext = row.email?.trim()
  if (!plaintext) return false
  const stored = prepareEmailStorage(plaintext)
  await db
    .update(schema.users)
    .set({
      email: null,
      emailCiphertext: stored.emailCiphertext,
      emailLookupHash: stored.emailLookupHash,
      emailKeyVersion: stored.emailKeyVersion,
    })
    .where(eq(schema.users.id, userId))
  return true
}
