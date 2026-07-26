import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { VENDOR_CATEGORIES } from './vendor-categories.js'
import { preprocessVendorWriteBody } from './vendor-write-preprocess.js'

describe('preprocessVendorWriteBody', () => {
  it('normalizes website, category aliases, and tag noise', () => {
    const out = preprocessVendorWriteBody({
      website: 'etsy.com/shop/foo',
      category: 'gear',
      categories: ['rope', 'invalid-xyz'],
      tags: ['  Rope  ', '', 'ROPE', 'custom'],
    }) as Record<string, unknown>

    assert.equal(out.website, 'https://etsy.com/shop/foo')
    assert.equal(out.category, VENDOR_CATEGORIES.gearAccessories)
    assert.deepEqual(out.categories, [VENDOR_CATEGORIES.ropeRigging])
    assert.deepEqual(out.tags, ['rope', 'custom'])
  })

  it('normalizes external store URLs', () => {
    const out = preprocessVendorWriteBody({
      provider: 'link_only',
      storeUrl: 'myshop.example.com',
      siteUrl: 'store.example.com/wp',
    }) as Record<string, unknown>

    assert.equal(out.storeUrl, 'https://myshop.example.com/')
    assert.equal(out.siteUrl, 'https://store.example.com/wp')
  })
})
