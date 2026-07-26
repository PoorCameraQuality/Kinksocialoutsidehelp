import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  VENDOR_BASICS_CONTINUE_LABEL,
  VENDOR_BASICS_INTRO,
  VENDOR_CONNECTOR_PREVIEW,
  VENDOR_EXTERNAL_SYNC_PATH,
  VENDOR_INVENTORY_HEADING,
  VENDOR_ONBOARDING_STEPS,
  VENDOR_ONBOARDING_STEP_LABELS,
} from './vendor-onboarding.ts'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const wizardSrc = readFileSync(join(webRoot, 'components/vendors/VendorOnboardingWizard.tsx'), 'utf8')
const panelSrc = readFileSync(join(webRoot, 'components/VendorExternalStorePanel.tsx'), 'utf8')

describe('vendor onboarding copy and flow', () => {
  it('exposes five labeled onboarding steps', () => {
    assert.equal(VENDOR_ONBOARDING_STEPS.length, 5)
    assert.deepEqual(VENDOR_ONBOARDING_STEPS, ['welcome', 'basics', 'inventory', 'appearance', 'publish'])
    assert.equal(VENDOR_ONBOARDING_STEP_LABELS.inventory, 'Inventory')
  })

  it('Step 2 primary button says Continue to inventory', () => {
    assert.equal(VENDOR_BASICS_CONTINUE_LABEL, 'Continue to inventory')
    assert.match(wizardSrc, /VENDOR_BASICS_CONTINUE_LABEL/)
  })

  it('Step 2 intro emphasizes curated catalog and external checkout', () => {
    assert.match(VENDOR_BASICS_INTRO, /curated products/i)
    assert.match(VENDOR_BASICS_INTRO, /CSV/i)
    assert.match(VENDOR_BASICS_INTRO, /checkout/i)
  })

  it('Step 2 connector preview lists curated, CSV, link, and BYO', () => {
    assert.deepEqual(
      [...VENDOR_CONNECTOR_PREVIEW],
      ['Curated products', 'CSV import', 'Link only', 'BYO API keys (advanced)'],
    )
  })

  it('basics step routes to inventory after shop creation', () => {
    assert.equal(VENDOR_ONBOARDING_STEPS[1], 'basics')
    assert.equal(VENDOR_ONBOARDING_STEPS[2], 'inventory')
    assert.match(wizardSrc, /setStep\('inventory'\)/)
  })

  it('Step 3 heading is Add your inventory', () => {
    assert.equal(VENDOR_INVENTORY_HEADING, 'Add your inventory')
  })

  it('Step 3 renders catalog, link-only, and advanced BYO sync', () => {
    assert.match(wizardSrc, /VendorCatalogPanel/)
    assert.match(wizardSrc, /variant="link-only"/)
    assert.match(wizardSrc, /variant="advanced"/)
    assert.match(wizardSrc, /curated products/i)
  })

  it('external store panel exposes Etsy, Shopify, WooCommerce, and Link only tabs', () => {
    assert.match(panelSrc, /Etsy/)
    assert.match(panelSrc, /Shopify/)
    assert.match(panelSrc, /WooCommerce/)
    assert.match(panelSrc, /Link only/)
    assert.match(panelSrc, /bring-your-own|your own/i)
  })

  it('sync uses POST external-store sync path', () => {
    assert.equal(VENDOR_EXTERNAL_SYNC_PATH, '/api/v1/vendors/me/external-store/sync')
    assert.match(panelSrc, /vendorExternalSyncPath/)
    assert.match(panelSrc, /method: 'POST'/)
  })
})
