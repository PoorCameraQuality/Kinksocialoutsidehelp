import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { syncAllEtsyVendors, syncVendorEtsyListings } from './etsy-sync.js'
import { externalStoreSupportsSync, resolveExternalProvider } from './external-provider.js'
import { syncAllShopifyVendors, syncVendorShopifyListings } from './shopify-sync.js'
import { emitVendorShopLiveIfEligible } from './vendor-shop-feed.js'
import { syncAllWooVendors, syncVendorWooListings } from './woo-sync.js'

export async function syncVendorExternalListings(
  vendorId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorId))
    .limit(1)
  if (!vendor) return { ok: false, error: 'Vendor not found' }

  const p = resolveExternalProvider(vendor)
  if (!externalStoreSupportsSync(p)) {
    return { ok: false, error: 'No API-backed external store to sync' }
  }

  let result: { ok: true; count: number } | { ok: false; error: string }
  switch (p) {
    case 'etsy':
      result = await syncVendorEtsyListings(vendorId)
      break
    case 'shopify':
      result = await syncVendorShopifyListings(vendorId)
      break
    case 'woocommerce':
      result = await syncVendorWooListings(vendorId)
      break
    default:
      return { ok: false, error: 'Unsupported provider' }
  }
  if (result.ok && result.count > 0) {
    void emitVendorShopLiveIfEligible(vendorId)
  }
  return result
}

/** Periodic job: sync all vendors that use Etsy, Shopify, or WooCommerce (sequential to reduce burst load). */
export async function syncAllExternalVendors(): Promise<{
  etsy: { vendors: number; errors: string[] }
  shopify: { vendors: number; errors: string[] }
  woo: { vendors: number; errors: string[] }
}> {
  const etsy = await syncAllEtsyVendors()
  const shopify = await syncAllShopifyVendors()
  const woo = await syncAllWooVendors()
  return { etsy, shopify, woo }
}
