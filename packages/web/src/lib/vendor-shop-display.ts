import type { ApiVendorRow } from '@/lib/api-vendor-mapper'
import { PAYMENTS_BUYER_SHORT } from './payments-disclaimer.ts'

export const CATALOG_STALE_MS = 24 * 60 * 60 * 1000

export function formatRelativeCatalogSync(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} minutes ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hours ago`
  return `${Math.floor(ms / 86_400_000)} days ago`
}

export function isCatalogStale(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > CATALOG_STALE_MS
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(
      cents / 100,
    )
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

export function formatCommissionStatus(status: string | null | undefined): string | null {
  if (!status) return null
  if (status === 'OPEN') return 'Open to custom orders'
  if (status === 'LIMITED') return 'Limited custom order availability'
  if (status === 'CLOSED') return 'Not taking custom orders'
  return status
}

export function visitStoreLabel(externalType: string | null | undefined): string {
  switch (externalType) {
    case 'etsy':
      return 'Buy on Etsy'
    case 'shopify':
      return 'Buy on Shopify'
    case 'woocommerce':
      return 'Buy on store'
    case 'link_only':
      return 'Visit store'
    default:
      return 'Visit shop'
  }
}

export const VENDOR_BROWSE_BUY_TAGLINE = 'Browse on kink.social. Buy from the seller.'
export const VENDOR_EXTERNAL_PURCHASE_NOTE = 'Purchases happen off kink.social.'
/** Buyer note when in-platform Stripe Checkout is used (seller MoR). */
export const VENDOR_STRIPE_PURCHASE_NOTE = PAYMENTS_BUYER_SHORT

export function vendorCheckoutDisclaimer(externalType: string | null | undefined): string {
  switch (externalType) {
    case 'etsy':
      return 'Purchases complete on Etsy. Kink.social does not process this transaction.'
    case 'shopify':
      return 'Purchases complete on Shopify. Kink.social does not process this transaction.'
    case 'woocommerce':
      return 'Purchases complete on the vendor WooCommerce store. Kink.social does not process this transaction.'
    case 'stripe':
      return VENDOR_STRIPE_PURCHASE_NOTE
    default:
      return "Purchases happen on the vendor's store. Kink.social does not process payments, shipping, or returns."
  }
}

export function buyCtaLabel(source: string): string {
  switch (source) {
    case 'etsy':
    case 'shopify':
    case 'woocommerce':
      return "View on seller's shop"
    case 'native':
      return 'View listing'
    case 'link_only':
      return 'Visit store'
    default:
      return 'Open product'
  }
}

export function displayListingSource(source: string): string | null {
  switch (source) {
    case 'etsy':
      return 'Etsy'
    case 'shopify':
      return 'Shopify'
    case 'woocommerce':
      return 'Store'
    case 'native':
      return null
    default:
      return source
  }
}

export function stripEckeImportNote(text: string): string {
  return text
    .replace(/\s*\(Sourced from https:\/\/www\.eastcoastkinkevents\.com[^)]*\)\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function displayCategoriesFromVendor(row: ApiVendorRow | null, fallback: string[]): string[] {
  if (!row) return fallback
  if (row.category) {
    const tags = (row.tags ?? []).filter((t) => t.toLowerCase() !== row.category!.toLowerCase())
    return [row.category, ...tags]
  }
  return fallback
}

export function hasAnyShopPolicy(p: NonNullable<ApiVendorRow['shopPolicies']>): boolean {
  return Boolean(
    p.returns?.trim() || p.customOrders?.trim() || p.leadTime?.trim() || p.shippingNotes?.trim(),
  )
}

type ShopPolicies = NonNullable<ApiVendorRow['shopPolicies']>

/** Short trust bullets for sidebar (max 5 lines). */
export function vendorTrustBullets(input: {
  shipsTo?: string | null
  commissionStatus?: string | null
  commissionNotes?: string | null
  shopPolicies?: ShopPolicies | null
}): string[] {
  const bullets: string[] = []
  if (input.shipsTo?.trim()) bullets.push(`Ships to ${input.shipsTo}`)
  const commission = formatCommissionStatus(input.commissionStatus)
  if (commission) {
    bullets.push(
      input.commissionNotes?.trim() ? `${commission} · ${input.commissionNotes.trim()}` : commission,
    )
  }
  const p = input.shopPolicies
  if (p?.leadTime?.trim()) bullets.push(`Lead time: ${p.leadTime.trim()}`)
  if (p?.shippingNotes?.trim()) bullets.push(p.shippingNotes.trim())
  if (p?.returns?.trim()) bullets.push(`Returns: ${p.returns.trim()}`)
  if (p?.customOrders?.trim() && bullets.length < 5) bullets.push(`Custom orders: ${p.customOrders.trim()}`)
  return bullets.slice(0, 5)
}

export function isPlaceholderStoreUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true
  return url === 'https://example.com' || url.startsWith('https://example.com/')
}
