import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, test } from 'node:test'
import { buildEckeOutboundAuthHeaders } from './ecke-ingest-auth.js'

describe('buildEckeOutboundAuthHeaders', () => {
  test('includes bearer, hmac, and idempotency headers', () => {
    const body = '{"entityType":"education_article"}'
    const secret = 'test-hmac-secret'
    const headers = buildEckeOutboundAuthHeaders(body, {
      bearerSecret: 'bearer-token',
      hmacSecret: secret,
      idempotencyKey: 'kink.social:education_article:abc',
    })

    assert.equal(headers.Authorization, 'Bearer bearer-token')
    assert.equal(headers['X-C2K-Idempotency-Key'], 'kink.social:education_article:abc')
    assert.ok(headers['X-C2K-Request-Id'])
    assert.ok(headers['X-Kink-Social-Timestamp'])
    const expectedSig = createHmac('sha256', secret)
      .update(`${headers['X-Kink-Social-Timestamp']}.${body}`)
      .digest('hex')
    assert.equal(headers['X-Kink-Social-Signature'], expectedSig)
  })
})
