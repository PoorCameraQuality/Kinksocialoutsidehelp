import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

export type EncryptedField = {
  ciphertext: string
  keyVersion: number
}

function parseKeyVersion(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Active data-encryption key version (increment when rotating C2K_FIELD_ENCRYPTION_KEY). */
export function activeFieldKeyVersion(): number {
  return parseKeyVersion(process.env.C2K_FIELD_ENCRYPTION_KEY_VERSION, 1)
}

function deriveAesKey(version: number): Buffer {
  const secret = process.env.C2K_FIELD_ENCRYPTION_KEY?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production') {
      throw new Error('C2K_FIELD_ENCRYPTION_KEY is required in production')
    }
    return createHash('sha256')
      .update(`dev-insecure-field-key:v${version}`)
      .digest()
  }
  return createHash('sha256')
    .update(`${secret}:v${version}`, 'utf8')
    .digest()
}

function lookupPepper(): string {
  const pepper = process.env.EMAIL_LOOKUP_PEPPER?.trim()
  if (pepper) return pepper
  if (process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production') {
    throw new Error('EMAIL_LOOKUP_PEPPER is required in production')
  }
  return 'dev-insecure-email-lookup-pepper'
}

/** Authenticated encryption for reversible PII fields (email, etc.). */
export function encryptField(plaintext: string, keyVersion = activeFieldKeyVersion()): EncryptedField {
  const key = deriveAesKey(keyVersion)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, enc]).toString('base64url')
  return { ciphertext: packed, keyVersion }
}

export function decryptField(ciphertext: string, keyVersion = activeFieldKeyVersion()): string | null {
  try {
    const buf = Buffer.from(ciphertext, 'base64url')
    if (buf.length < IV_BYTES + TAG_BYTES + 1) return null
    const iv = buf.subarray(0, IV_BYTES)
    const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const data = buf.subarray(IV_BYTES + TAG_BYTES)
    const key = deriveAesKey(keyVersion)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** HMAC-SHA256 lookup token for equality queries without storing plaintext. */
export function hmacLookup(normalizedValue: string, purpose = 'email'): string {
  return createHmac('sha256', lookupPepper())
    .update(`${purpose}:${normalizedValue}`, 'utf8')
    .digest('hex')
}

export function assertFieldEncryptionConfigured(): void {
  if (process.env.USE_DATABASE !== 'true') return
  if (process.env.NODE_ENV !== 'production' && process.env.C2K_ENV !== 'production') return
  if (!process.env.C2K_FIELD_ENCRYPTION_KEY?.trim()) {
    throw new Error('C2K_FIELD_ENCRYPTION_KEY is required when USE_DATABASE=true in production')
  }
  if (!process.env.EMAIL_LOOKUP_PEPPER?.trim()) {
    throw new Error('EMAIL_LOOKUP_PEPPER is required when USE_DATABASE=true in production')
  }
}
