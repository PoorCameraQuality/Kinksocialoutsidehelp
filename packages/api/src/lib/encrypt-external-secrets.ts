import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function deriveKey(): Buffer {
  const secret = process.env.EXTERNAL_STORE_SECRET?.trim()
  if (!secret) {
    console.warn(
      '[external-store] EXTERNAL_STORE_SECRET unset. Storing tokens in plaintext-compatible mode (dev only)'
    )
    return createHash('sha256').update('dev-insecure-external-store-key').digest()
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

/** Encrypt JSON for `vendor_profiles.external_store_secrets_enc`. */
export function encryptExternalSecretsJson(obj: Record<string, unknown>): string {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const json = JSON.stringify(obj)
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptExternalSecretsJson(s: string): Record<string, unknown> | null {
  try {
    const buf = Buffer.from(s, 'base64url')
    if (buf.length < 12 + 16) return null
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const key = deriveKey()
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    return JSON.parse(out) as Record<string, unknown>
  } catch {
    return null
  }
}
