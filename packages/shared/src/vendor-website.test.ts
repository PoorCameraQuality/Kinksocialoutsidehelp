import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeVendorWebsite } from './vendor-website.js'

describe('normalizeVendorWebsite', () => {
  it('prepends https:// to bare domains', () => {
    assert.equal(normalizeVendorWebsite('etsy.com/shop/foo'), 'https://etsy.com/shop/foo')
  })

  it('returns null for empty input', () => {
    assert.equal(normalizeVendorWebsite(''), null)
    assert.equal(normalizeVendorWebsite('   '), null)
  })

  it('preserves already-valid https URLs', () => {
    assert.equal(normalizeVendorWebsite('https://example.com/path'), 'https://example.com/path')
  })

  it('normalizes http to a valid URL string', () => {
    assert.equal(normalizeVendorWebsite('http://example.com'), 'http://example.com/')
  })

  it('returns null for unfixable garbage', () => {
    assert.equal(normalizeVendorWebsite('not a url!!!'), null)
    assert.equal(normalizeVendorWebsite('javascript:alert(1)'), null)
  })
})
