import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const vendorPageSrc = readFileSync(join(webRoot, 'app/vendors/[id]/page.tsx'), 'utf8')
const vendorSettingsSrc = readFileSync(join(webRoot, 'components/settings/VendorShopSection.tsx'), 'utf8')
const managedShopsSrc = readFileSync(join(webRoot, 'components/settings/VendorManagedShopsSection.tsx'), 'utf8')
const vendorApiPathsSrc = readFileSync(join(webRoot, 'lib/vendor-api-paths.ts'), 'utf8')

describe('vendor shop runners web UI', () => {
  it('vendor settings uses Shop runners copy, not Co-owners', () => {
    assert.match(vendorSettingsSrc, /Shop runners/)
    assert.doesNotMatch(vendorSettingsSrc, /Co-owners \(community profiles\)/)
    assert.match(vendorSettingsSrc, /Runner usernames/)
    assert.match(vendorSettingsSrc, /Only add people you trust/)
  })

  it('vendor page uses canManageShop for management panels', () => {
    assert.match(vendorPageSrc, /canManageShop/)
    assert.match(vendorPageSrc, /VendorExternalStorePanel/)
    assert.match(vendorPageSrc, /VendorShopAppearancePanel/)
    assert.doesNotMatch(vendorPageSrc, /const isOwner\s*=/)
  })

  it('vendor page passes scoped vendor id for runners', () => {
    assert.match(vendorPageSrc, /manageVendorProfileId/)
    assert.match(vendorPageSrc, /vendorProfileId=\{manageVendorProfileId\}/)
  })

  it('managed shops section exists for runners', () => {
    assert.match(managedShopsSrc, /Shops you help run/)
    assert.match(managedShopsSrc, /\/api\/v1\/vendors\/managed/)
    assert.match(managedShopsSrc, /Manage shop/)
  })

  it('vendor API paths support scoped shop routes', () => {
    assert.match(vendorApiPathsSrc, /vendors\/\$\{encodeURIComponent\(vendorProfileId\)\}/)
    assert.match(vendorApiPathsSrc, /external-store\/sync/)
  })

  it('vendor page product grid keeps mobile-friendly layout', () => {
    assert.match(vendorPageSrc, /grid-cols-1 sm:grid-cols-2/)
  })
})
