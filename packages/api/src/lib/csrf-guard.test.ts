import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { SESSION_COOKIE_NAME } from '@c2k/shared/session-token'
import { enforceCookieCsrf } from './csrf-guard.js'

function mockReply() {
  let statusCode = 200
  let body: unknown
  return {
    reply: {
      status(code: number) {
        statusCode = code
        return this
      },
      send(payload: unknown) {
        body = payload
        return this
      },
    } as never,
    get status() {
      return statusCode
    },
    get body() {
      return body
    },
  }
}

describe('enforceCookieCsrf', () => {
  test('allows Stripe webhook POST without Origin', () => {
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/v1/webhooks/stripe',
        cookies: {},
        headers: {},
      } as never,
      reply,
    )
    assert.equal(ok, true)
  })

  test('allows GET with session cookie', () => {
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'GET',
        url: '/api/profile/me',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: {},
      } as never,
      reply,
    )
    assert.equal(ok, true)
  })

  test('blocks POST with session cookie and no Origin', () => {
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/feed/posts',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: {},
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    assert.equal((mock.body as { code?: string }).code, 'csrf_missing_origin')
  })

  test('blocks cross-site POST with session cookie', () => {
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/feed/posts',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: { 'sec-fetch-site': 'cross-site' },
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    assert.equal((mock.body as { code?: string }).code, 'csrf_cross_site')
  })

  test('allows POST with matching Origin', () => {
    const prev = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = 'https://kink.social'
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/feed/posts',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: { origin: 'https://kink.social', 'sec-fetch-site': 'same-origin' },
      } as never,
      reply,
    )
    assert.equal(ok, true)
    if (prev !== undefined) process.env.CORS_ORIGIN = prev
    else delete process.env.CORS_ORIGIN
  })

  test('allows non-browser login clients (no cookie, no provenance headers)', () => {
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/session',
        cookies: {},
        headers: {},
      } as never,
      reply,
    )
    assert.equal(ok, true)
  })

  // PR 3 (A4): auth routes are no longer blanket-exempt.

  test('blocks cross-site login POST even without a session cookie (login CSRF)', () => {
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/session',
        cookies: {},
        headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    assert.equal((mock.body as { code?: string }).code, 'csrf_cross_site')
  })

  test('blocks cross-site register POST with disallowed Origin', () => {
    const prev = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = 'https://kink.social'
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/register',
        cookies: {},
        headers: { origin: 'https://evil.example' },
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    assert.equal((mock.body as { code?: string }).code, 'csrf_bad_origin')
    if (prev !== undefined) process.env.CORS_ORIGIN = prev
    else delete process.env.CORS_ORIGIN
  })

  test('blocks cross-site password-reset request without session cookie', () => {
    const prev = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = 'https://kink.social'
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/password-reset/request',
        cookies: {},
        headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    if (prev !== undefined) process.env.CORS_ORIGIN = prev
    else delete process.env.CORS_ORIGIN
  })

  test('allows same-origin login POST with allowed Origin', () => {
    const prev = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = 'https://kink.social'
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/session',
        cookies: {},
        headers: { origin: 'https://kink.social', 'sec-fetch-site': 'same-origin' },
      } as never,
      reply,
    )
    assert.equal(ok, true)
    if (prev !== undefined) process.env.CORS_ORIGIN = prev
    else delete process.env.CORS_ORIGIN
  })

  test('blocks cross-site logout with a session cookie', () => {
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/logout',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: { 'sec-fetch-site': 'cross-site' },
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
  })

  test('blocks password change with session cookie and no Origin/Referer/metadata', () => {
    const mock = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/auth/password/change',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: {},
      } as never,
      mock.reply,
    )
    assert.equal(ok, false)
    assert.equal(mock.status, 403)
    assert.equal((mock.body as { code?: string }).code, 'csrf_missing_origin')
  })

  test('allows same-origin fetch metadata without Origin/Referer headers', () => {
    const { reply } = mockReply()
    const ok = enforceCookieCsrf(
      {
        method: 'POST',
        url: '/api/feed/posts',
        cookies: { [SESSION_COOKIE_NAME]: 'x' },
        headers: { 'sec-fetch-site': 'same-origin' },
      } as never,
      reply,
    )
    assert.equal(ok, true)
  })
})
