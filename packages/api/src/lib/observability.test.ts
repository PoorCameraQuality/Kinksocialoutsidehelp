import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { eckeHealthDiagnostic } from './health-ecke.js'
import { isErrorTrackingTestRouteAllowed, scrubSentryEvent } from './error-tracking.js'

describe('eckeHealthDiagnostic', () => {
  test('returns disabled when ECKE publish is off', async () => {
    const prev = process.env.ECKE_PUBLISH_ENABLED
    process.env.ECKE_PUBLISH_ENABLED = 'false'
    try {
      const result = await eckeHealthDiagnostic()
      assert.equal(result.enabled, false)
      assert.equal(result.mode, 'disabled')
      assert.equal(result.ok, true)
    } finally {
      process.env.ECKE_PUBLISH_ENABLED = prev
    }
  })
})

describe('error tracking privacy', () => {
  test('scrubSentryEvent removes request bodies and redacts auth headers', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://example.com/api/v1/messages/abc',
        headers: { authorization: 'Bearer secret-token', cookie: 'c2k_session=abc123' },
        data: { body: 'private dm text' },
        cookies: { c2k_session: 'abc123' },
      },
      extra: { password: 'hunter2', note: 'token=abc' },
    })
    assert.ok(event)
    assert.equal(event.request?.data, undefined)
    assert.equal(event.request?.cookies, undefined)
    assert.equal(event.request?.headers?.authorization, '[REDACTED]')
    assert.equal((event.extra as Record<string, unknown>).password, '[REDACTED]')
  })

  test('error-test route blocked in production without secret', () => {
    const prevEnabled = process.env.ERROR_TRACKING_TEST_ENABLED
    const prevEnv = process.env.NODE_ENV
    const prevSecret = process.env.ERROR_TRACKING_TEST_SECRET
    process.env.ERROR_TRACKING_TEST_ENABLED = 'true'
    process.env.NODE_ENV = 'production'
    delete process.env.ERROR_TRACKING_TEST_SECRET
    try {
      assert.equal(isErrorTrackingTestRouteAllowed({}), false)
      assert.equal(isErrorTrackingTestRouteAllowed({ 'x-error-tracking-test-secret': 'nope' }), false)
    } finally {
      process.env.ERROR_TRACKING_TEST_ENABLED = prevEnabled
      process.env.NODE_ENV = prevEnv
      process.env.ERROR_TRACKING_TEST_SECRET = prevSecret
    }
  })

  test('error-test route allowed in non-production when enabled', () => {
    const prevEnabled = process.env.ERROR_TRACKING_TEST_ENABLED
    const prevEnv = process.env.NODE_ENV
    process.env.ERROR_TRACKING_TEST_ENABLED = 'true'
    process.env.NODE_ENV = 'development'
    try {
      assert.equal(isErrorTrackingTestRouteAllowed({}), true)
    } finally {
      process.env.ERROR_TRACKING_TEST_ENABLED = prevEnabled
      process.env.NODE_ENV = prevEnv
    }
  })
})
