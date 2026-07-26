import type { InferSelectModel } from 'drizzle-orm'
import { vendorProfiles } from '../db/schema.js'

export type ExternalProvider = 'none' | 'etsy' | 'shopify' | 'woocommerce' | 'link_only'

export type VendorProfileRow = InferSelectModel<typeof vendorProfiles>

export function resolveExternalProvider(v: VendorProfileRow): ExternalProvider {
  const t = v.externalStoreType as ExternalProvider
  if (t && t !== 'none') return t
  if (v.usesEtsy && v.etsyShopId) return 'etsy'
  return 'none'
}

export function externalStoreSupportsSync(p: ExternalProvider): boolean {
  return p === 'etsy' || p === 'shopify' || p === 'woocommerce'
}
