/**
 * Session token expiry (launch-hardening PR 3, A1): tokens carry iat/exp and
 * decode fails closed for expired or legacy (exp-less) tokens.
 */
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, test } from 'node:test'
import {
  decodeSession,
  encodeSession,
  SESSION_TOKEN_TTL_MS,
  type SessionPayload,
} from './session-token.js'

function encodeRawPayload(payload: object): string {
  // Mirrors encodeSession's signing without the automatic iat/exp stamping,
  // to simulate legacy/crafted tokens.
  const secret = process.env.AUTH_SECRET ?? 'dev-insecure-auth-secret-change-me-in-env'
  const json = JSON.stringify(payload)
  const sig = createHmac('sha256', secret).update(json).digest('base64url')
  return Buffer.from(JSON.stringify({ json, sig })).toString('base64url')
}

describe('session token expiry', () => {
  test('fresh tokens round-trip and carry iat/exp', () => {
    const token = encodeSession({ username: 'alice', sub: 'user-1', sv: 3 })
    const decoded = decodeSession(token)
    assert.ok(decoded)
    assert.equal(decoded.username, 'alice')
    assert.equal(decoded.sv, 3)
    assert.equal(typeof decoded.iat, 'number')
    assert.equal(typeof decoded.exp, 'number')
    assert.ok(decoded.exp! - decoded.iat! === SESSION_TOKEN_TTL_MS)
  })

  test('expired tokens are rejected', () => {
    const now = Date.now()
    const token = encodeSession({
      username: 'alice',
      sub: 'user-1',
      iat: now - SESSION_TOKEN_TTL_MS - 1000,
      exp: now - 1000,
    } as SessionPayload)
    assert.equal(decodeSession(token), null)
  })

  test('legacy tokens without exp are rejected (fail closed)', () => {
    const token = encodeRawPayload({ username: 'alice', sub: 'user-1', sv: 0 })
    assert.equal(decodeSession(token), null)
  })

  test('tampered tokens are still rejected', () => {
    const token = encodeSession({ username: 'alice', sub: 'user-1' })
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as {
      json: string
      sig: string
    }
    raw.json = raw.json.replace('alice', 'mallory')
    const tampered = Buffer.from(JSON.stringify(raw)).toString('base64url')
    assert.equal(decodeSession(tampered), null)
  })
})
