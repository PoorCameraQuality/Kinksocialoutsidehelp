import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  buyCtaLabel,
  vendorCheckoutDisclaimer,
  VENDOR_BROWSE_BUY_TAGLINE,
  VENDOR_EXTERNAL_PURCHASE_NOTE,
} from './vendor-shop-display.ts'

const vendorPageSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/vendors/[id]/page.tsx'),
  'utf8',
)

describe('vendor shop display copy', () => {
  it('uses browse on kink.social tagline on public vendor pages', () => {
    assert.equal(VENDOR_BROWSE_BUY_TAGLINE, 'Browse on kink.social. Buy from the seller.')
    assert.match(vendorPageSrc, /VENDOR_BROWSE_BUY_TAGLINE/)
  })

  it('product cards note purchases happen off kink.social', () => {
    assert.equal(VENDOR_EXTERNAL_PURCHASE_NOTE, 'Purchases happen off kink.social.')
    // The live vendor page renders provider-specific off-platform copy via
    // vendorCheckoutDisclaimer (canonical per launch-hardening PR 1 decision).
    assert.match(vendorPageSrc, /vendorCheckoutDisclaimer/)
  })

  it('checkout disclaimers always state purchases complete off kink.social', () => {
    for (const provider of ['etsy', 'shopify', 'woocommerce', 'link_only', null]) {
      const copy = vendorCheckoutDisclaimer(provider)
      assert.match(copy, /Kink\.social does not process/i)
      assert.match(copy, /Purchases (complete|happen)/i)
    }
  })

  it('external listing buttons say View on seller shop', () => {
    assert.equal(buyCtaLabel('etsy'), "View on seller's shop")
    assert.equal(buyCtaLabel('shopify'), "View on seller's shop")
    assert.equal(buyCtaLabel('woocommerce'), "View on seller's shop")
  })

  it('vendor page product grid uses responsive columns', () => {
    assert.match(vendorPageSrc, /grid-cols-1 sm:grid-cols-2/)
  })
})
