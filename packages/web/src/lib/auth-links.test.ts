import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildLoginHref,
  buildLoginHrefFromLegacySearch,
  buildSignupHref,
  loginRedirectSearchParams,
} from './auth-links'

describe('buildLoginHref', () => {
  it('uses dedicated /login route', () => {
    assert.equal(buildLoginHref(), '/login')
    assert.equal(buildLoginHref('/play'), '/login?redirect=%2Fplay')
    assert.equal(buildLoginHref('/play/foo'), '/login?redirect=%2Fplay%2Ffoo')
  })

  it('rejects external redirects', () => {
    assert.equal(buildLoginHref('https://evil.example'), '/login')
  })
})

describe('buildSignupHref', () => {
  it('adds signup tab flag', () => {
    assert.equal(buildSignupHref(), '/login?signup=1')
    assert.equal(buildSignupHref('/play'), '/login?redirect=%2Fplay&signup=1')
  })
})

describe('loginRedirectSearchParams', () => {
  it('maps legacy next/login onto redirect-only search', () => {
    assert.equal(loginRedirectSearchParams('?login=1&next=/play'), '?redirect=%2Fplay')
    assert.equal(loginRedirectSearchParams('login=1'), '')
    assert.equal(loginRedirectSearchParams('?redirect=/play&login=1'), '?redirect=%2Fplay')
  })
})

describe('buildLoginHrefFromLegacySearch', () => {
  it('builds /login from landing bookmarks', () => {
    assert.equal(buildLoginHrefFromLegacySearch('?login=1&redirect=%2Fplay'), '/login?redirect=%2Fplay')
    assert.equal(buildLoginHrefFromLegacySearch('?login=1'), '/login')
  })
})
