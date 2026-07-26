import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VendorProfileRow } from './vendor-shop-people.js'
import { resolveEckePublicVendorUrl } from './ecke-publish-client.js'
import { hashEckePayload } from './ecke-publish-payload.js'
import {
  getVendorDeferredFields,
  getVendorOmittedFields,
} from './ecke-redaction.js'
import { getRegistryEntry } from './ecke-publish-registry.js'
import { deriveTargetDisplayStatus } from './ecke-publish-target-store.js'
import {
  buildVendorProfilePlainFields,
  buildVendorProfilePublishContext,
  canViewerPublishVendorProfileEcke,
  computeVendorProfileActions,
  getVendorIneligibilityReason,
  payloadExcludesPrivateVendorFields,
  PASS5_UNSUPPORTED_ERROR,
  sanitizeVendorEckeWebsiteUrl,
  VENDOR_ECKE_OWNER_ONLY_MESSAGE,
  type VendorPublishAccess,
} from './ecke-publish-service.js'

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function baseVendor(overrides: Partial<VendorProfileRow> = {}): VendorProfileRow {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    userId: OWNER_ID,
    slug: 'rope-craft',
    displayName: 'Rope Craft',
    bio: 'Public bio',
    makerStory: null,
    shopPolicies: null,
    bannerUrl: null,
    logoUrl: 'https://cdn.example/logo.png',
    shopHeaderLayout: 'OVERLAY',
    website: 'https://shop.example.com',
    categories: ['Rope'],
    category: 'Rope',
    tags: ['shibari'],
    rating: 0,
    shipsTo: 'US',
    visibility: 'PUBLIC',
    commissionStatus: 'OPEN',
    commissionNotes: 'private commission notes',
    verified: false,
    externalStoreType: 'none',
    externalStorePublic: null,
    externalStoreSecretsEnc: 'encrypted-secrets',
    externalListingsSyncedAt: null,
    externalSyncError: null,
    usesEtsy: false,
    etsyShopId: '12345',
    etsyShopUrl: null,
    etsyShopName: null,
    etsyListingsSyncedAt: null,
    etsySyncError: null,
    eckePublish: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function vendorAccess(
  vendor: VendorProfileRow,
  shopAccess: VendorPublishAccess['shopAccess'],
): VendorPublishAccess {
  return {
    vendor,
    shopAccess,
    canPreview: shopAccess.canManageShop,
    canPublish: shopAccess.canManageShop,
  }
}

describe('ecke-publish-registry vendor_profile', () => {
  it('marks vendor_profile active_existing with supabase_rest', () => {
    const entry = getRegistryEntry('vendor_profile')!
    assert.equal(entry.supportState, 'active_existing')
    assert.equal(entry.currentTransport, 'supabase_rest')
    assert.equal(entry.visibleInUserDashboard, true)
    assert.equal(entry.visibleInOrgDashboard, true)
    assert.ok(entry.eckeSurfacesAffected.some((s) => /vendor detail/i.test(s)))
  })
})

describe('vendor profile eligibility', () => {
  it('public vendor with ECKE opt-in is eligible', () => {
    assert.equal(getVendorIneligibilityReason(baseVendor()), null)
  })

  it('private/unlisted vendor cannot publish', () => {
    assert.match(getVendorIneligibilityReason(baseVendor({ visibility: 'HIDDEN' })) ?? '', /public/i)
    assert.match(getVendorIneligibilityReason(baseVendor({ visibility: 'MEMBERS' })) ?? '', /public/i)
  })

  it('vendor without ECKE opt-in cannot publish', () => {
    assert.match(getVendorIneligibilityReason(baseVendor({ eckePublish: false })) ?? '', /opt/i)
  })

  it('suspended owner blocks publish eligibility', () => {
    assert.match(getVendorIneligibilityReason(baseVendor(), true) ?? '', /suspended/i)
  })
})

describe('vendor profile publish permissions', () => {
  it('owner can publish', () => {
    const vendor = baseVendor()
    assert.equal(
      canViewerPublishVendorProfileEcke(vendor, { isOwner: true, isRunner: false, canManageShop: true }),
      true,
    )
  })

  it('co-owner can publish', () => {
    const vendor = baseVendor()
    assert.equal(
      canViewerPublishVendorProfileEcke(vendor, { isOwner: false, isRunner: true, canManageShop: true }),
      true,
    )
  })

  it('non-owner cannot publish', () => {
    const vendor = baseVendor()
    assert.equal(
      canViewerPublishVendorProfileEcke(vendor, { isOwner: false, isRunner: false, canManageShop: false }),
      false,
    )
  })

  it('owner-only message is defined for dashboard read-only state', () => {
    assert.match(VENDOR_ECKE_OWNER_ONLY_MESSAGE, /owner/i)
    assert.match(VENDOR_ECKE_OWNER_ONLY_MESSAGE, /co-owner/i)
  })
})

describe('vendor profile preview payload', () => {
  it('builds server-side payload and excludes private secrets', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor(), { isOwner: true, isRunner: false, canManageShop: true }),
    )
    assert.equal(ctx.eligibility.eligible, true)
    assert.equal('email' in (ctx.payload as Record<string, unknown>), false)
    assert.equal(payloadExcludesPrivateVendorFields(ctx.payload as Record<string, unknown>), true)
    assert.equal((ctx.payload as { website_url?: string }).website_url, 'https://shop.example.com')
  })

  it('ignores non-HTTPS website URLs', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor({ website: 'http://insecure.example.com' }), {
        isOwner: true,
        isRunner: false,
        canManageShop: true,
      }),
    )
    assert.equal((ctx.payload as { website_url?: string | null }).website_url, null)
  })

  it('sanitizeVendorEckeWebsiteUrl accepts HTTPS only', () => {
    assert.equal(sanitizeVendorEckeWebsiteUrl('https://shop.example.com'), 'https://shop.example.com')
    assert.equal(sanitizeVendorEckeWebsiteUrl('http://shop.example.com'), null)
    assert.equal(sanitizeVendorEckeWebsiteUrl('ftp://shop.example.com'), null)
  })

  it('plain fields include public vendor summary', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor(), { isOwner: true, isRunner: false, canManageShop: true }),
    )
    const fields = buildVendorProfilePlainFields(ctx, getRegistryEntry('vendor_profile')!)
    assert.ok(fields.some((f) => f.label === 'Vendor name' && f.value === 'Rope Craft'))
    assert.ok(fields.some((f) => f.label === 'Canonical kink.social vendor URL'))
  })

  it('omitted and deferred fields are defined', () => {
    assert.ok(getVendorOmittedFields().some((f) => /payment/i.test(f.label)))
    assert.ok(getVendorOmittedFields().some((f) => /Etsy/i.test(f.label)))
    assert.ok(getVendorDeferredFields().some((f) => /Event appearances/i.test(f.label)))
  })

  it('computeVendorProfileActions disables publish when ineligible', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor({ eckePublish: false }), { isOwner: true, isRunner: false, canManageShop: true }),
    )
    const actions = computeVendorProfileActions({
      eligible: ctx.eligibility.eligible,
      status: 'never',
      bridgeConfigured: true,
    })
    assert.equal(actions.publish, false)
  })

  it('stale detection works after content hash change', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor(), { isOwner: true, isRunner: false, canManageShop: true }),
    )
    const status = deriveTargetDisplayStatus(`${ctx.contentHash}-changed`, {
      contentHash: ctx.contentHash,
      publishedContentHash: ctx.contentHash,
      status: 'published',
      lastPublishedAt: new Date(),
    })
    assert.equal(status, 'stale')
  })

  it('resolveEckePublicVendorUrl builds vendor page URL', () => {
    const url = resolveEckePublicVendorUrl('rope-craft')
    assert.match(url ?? '', /\/vendors\/rope-craft$/)
  })
})

describe('ecke-publish-service vendor control plane wiring', () => {
  it('service wires vendor_profile preview and publish executors', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildVendorProfilePreview/)
    assert.match(src, /executeVendorProfilePublish/)
    assert.match(src, /executeEckePublishVendor/)
    assert.match(src, /executeEckeUnpublishVendorWithTargetUpdate/)
    assert.match(src, /vendor_profile/)
  })

  it('Pass 5 supported write kinds include vendor_profile', () => {
    assert.match(PASS5_UNSUPPORTED_ERROR.message, /unified ECKE control plane/i)
  })

  it('executor persists eckePublicUrl for vendors', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-executor.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /resolveEckePublicVendorUrl/)
    assert.match(src, /markVendorProfileEckeUnpublished/)
  })

  it('unpublish sets unpublished status for vendors', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-executor.ts', import.meta.url), 'utf8'),
    )
    const fn = src.slice(src.indexOf('markVendorProfileEckeUnpublished'))
    assert.match(fn, /status: 'unpublished'/)
    assert.match(fn, /unpublishedAt/)
  })
})

describe('group_listing event_listing education_article regression guards', () => {
  it('group listing preview helper still exists', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildGroupListingPreview/)
    assert.match(src, /buildEventListingPreview/)
    assert.match(src, /buildEducationArticlePreview/)
  })
})

describe('vendor payload hash stability', () => {
  it('hashEckePayload is stable for identical vendor rows', () => {
    const ctx = buildVendorProfilePublishContext(
      vendorAccess(baseVendor(), { isOwner: true, isRunner: false, canManageShop: true }),
    )
    assert.equal(hashEckePayload(ctx.payload), hashEckePayload(ctx.payload))
  })
})
