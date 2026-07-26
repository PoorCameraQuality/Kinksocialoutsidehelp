import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { externalStoreSupportsSync } from './external-provider.js'

const panelSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../web/src/components/VendorExternalStorePanel.tsx'),
  'utf8',
)

describe('external store provider sync support', () => {
  it('link_only does not support product sync', () => {
    assert.equal(externalStoreSupportsSync('link_only'), false)
  })

  it('etsy, shopify, and woocommerce support sync', () => {
    assert.equal(externalStoreSupportsSync('etsy'), true)
    assert.equal(externalStoreSupportsSync('shopify'), true)
    assert.equal(externalStoreSupportsSync('woocommerce'), true)
  })

  it('link only tab does not show sync button in the panel', () => {
    assert.match(panelSrc, /externalStoreType === 'link_only'/)
    assert.match(panelSrc, /showSync/)
  })
})
