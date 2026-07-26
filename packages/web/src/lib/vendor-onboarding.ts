import type { ApiVendorRow } from '@/lib/api-vendor-mapper'
import { VENDOR_CATEGORY_VALUES } from '@c2k/shared'

export const VENDOR_ONBOARDING_STEPS = [
  'welcome',
  'basics',
  'inventory',
  'appearance',
  'publish',
] as const

export type VendorOnboardingStep = (typeof VENDOR_ONBOARDING_STEPS)[number]

export const VENDOR_ONBOARDING_STEP_LABELS: Record<VendorOnboardingStep, string> = {
  welcome: 'Welcome',
  basics: 'Vendor page',
  inventory: 'Inventory',
  appearance: 'Appearance',
  publish: 'Publish',
}

export const VENDOR_BASICS_HEADING = 'Set up your vendor page'
export const VENDOR_BASICS_INTRO =
  'Start with the public details buyers will see on kink.social. Next, add curated products, import a CSV, or link your storefront. Checkout always stays on your shop.'
export const VENDOR_BASICS_CONTINUE_LABEL = 'Continue to inventory'
export const VENDOR_INVENTORY_HEADING = 'Add your inventory'
export const VENDOR_INVENTORY_INTRO =
  'Feature products with outbound buy links, bulk-import a CSV, or use link-only. Optional advanced sync can use your own store API keys. kink.social does not process checkout.'
export const VENDOR_CONNECTOR_PREVIEW = [
  'Curated products',
  'CSV import',
  'Link only',
  'BYO API keys (advanced)',
] as const
export const VENDOR_EXTERNAL_SYNC_PATH = '/api/v1/vendors/me/external-store/sync'

export { VENDOR_CATEGORY_VALUES }

/** @deprecated Use VENDOR_CATEGORY_VALUES */
export const VENDOR_CATEGORY_FILTERS = VENDOR_CATEGORY_VALUES

export function vendorHasStoreConnector(vendor: ApiVendorRow | null | undefined): boolean {
  if (!vendor) return false
  const t = vendor.externalStoreType ?? 'none'
  if (t !== 'none' && t !== '') return true
  if (vendor.usesEtsy) return true
  if (vendor.etsyShopUrl) return true
  return false
}

/** Inventory step satisfied: external connector, curated catalog, or explicit skip. */
export function vendorHasInventoryReady(
  vendor: ApiVendorRow | null | undefined,
  opts?: { curatedCount?: number; skipped?: boolean },
): boolean {
  if (opts?.skipped) return true
  if ((opts?.curatedCount ?? 0) > 0) return true
  return vendorHasStoreConnector(vendor)
}

export function vendorIsPublished(vendor: ApiVendorRow | null | undefined): boolean {
  return vendor?.visibility === 'PUBLIC'
}

/** First incomplete wizard step for resume. */
export function initialOnboardingStep(vendor: ApiVendorRow | null | undefined): VendorOnboardingStep {
  if (!vendor) return 'welcome'
  // Inventory is optional (curated / link / skip); resume at appearance when unpublished.
  if (!vendorIsPublished(vendor)) return 'appearance'
  return 'publish'
}

export function stepIndex(step: VendorOnboardingStep): number {
  return VENDOR_ONBOARDING_STEPS.indexOf(step)
}
