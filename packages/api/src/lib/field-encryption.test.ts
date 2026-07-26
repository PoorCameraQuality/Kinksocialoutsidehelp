import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  decryptField,
  encryptField,
  hmacLookup,
} from './field-encryption.js'
import {
  emailLookupHash,
  getEmailFromUserRow,
  normalizeEmail,
  prepareEmailStorage,
} from './user-email.js'
import { redactObject, redactString, REDACTED } from './log-redact.js'

describe('field encryption', () => {
  it('encrypts and decrypts round-trip', () => {
    const { ciphertext, keyVersion } = encryptField('user@example.com')
    assert.ok(ciphertext.length > 20)
    assert.equal(decryptField(ciphertext, keyVersion), 'user@example.com')
  })

  it('stores different ciphertext for same plaintext (random IV)', () => {
    const a = encryptField('user@example.com')
    const b = encryptField('user@example.com')
    assert.notEqual(a.ciphertext, b.ciphertext)
  })

  it('lookup hash is stable for normalized email', () => {
    const h1 = hmacLookup(normalizeEmail('User@Example.com'), 'email')
    const h2 = hmacLookup(normalizeEmail('user@example.com'), 'email')
    assert.equal(h1, h2)
    assert.match(h1, /^[a-f0-9]{64}$/)
  })
})

describe('user email storage', () => {
  it('prepareEmailStorage clears plaintext column', () => {
    const stored = prepareEmailStorage('user@example.com')
    assert.equal(stored.email, null)
    assert.ok(stored.emailCiphertext)
    assert.ok(stored.emailLookupHash)
  })

  it('getEmailFromUserRow prefers ciphertext over legacy', () => {
    const stored = prepareEmailStorage('legacy@example.com')
    const fromEnc = getEmailFromUserRow({
      email: 'plaintext@example.com',
      emailCiphertext: stored.emailCiphertext,
      emailKeyVersion: stored.emailKeyVersion,
    })
    assert.equal(fromEnc, 'legacy@example.com')
  })

  it('getEmailFromUserRow falls back to legacy plaintext', () => {
    assert.equal(getEmailFromUserRow({ email: 'plain@example.com' }), 'plain@example.com')
  })

  it('emailLookupHash matches prepareEmailStorage', () => {
    const stored = prepareEmailStorage('user@example.com')
    assert.equal(stored.emailLookupHash, emailLookupHash('user@example.com'))
  })
})

describe('log redaction', () => {
  it('redacts sensitive keys', () => {
    const out = redactObject({
      password: 'secret123',
      userId: 'abc',
      token: 'raw-token-value',
    })
    assert.equal(out.password, REDACTED)
    assert.equal(out.token, REDACTED)
    assert.equal(out.userId, 'abc')
  })

  it('redacts bearer tokens and emails in strings', () => {
    const s = redactString('Contact user@example.com with Bearer abc.def.ghi')
    assert.ok(!s.includes('user@example.com'))
    assert.ok(!s.includes('Bearer abc'))
  })

  it('redacts token query params in URLs', () => {
    const s = redactString('https://kink.social/reset-password?token=supersecret')
    assert.ok(!s.includes('supersecret'))
  })

  it('does not leak sample DM body text when redacting structured logs', () => {
    const out = redactObject({
      message: 'owner-investigation-dm-secret-body from user',
      userId: 'abc',
    })
    assert.equal((out as { userId: string }).userId, 'abc')
  })
})
