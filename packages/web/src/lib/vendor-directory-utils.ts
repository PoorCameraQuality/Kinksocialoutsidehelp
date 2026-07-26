import { normalizeVendorCategory, VENDOR_CATEGORY_VALUES } from '@c2k/shared'
import type { MockVendor } from '@/data/types'

export function vendorPrimaryCategory(vendor: MockVendor): string | null {
  return vendor.category ?? normalizeVendorCategory(vendor.categories?.[0] ?? '') ?? null
}

/** Per-category counts from a vendor list (e.g. before category filter is applied). */
export function countVendorsByCategory(vendors: MockVendor[]): Record<string, number> {
  const counts = Object.fromEntries(VENDOR_CATEGORY_VALUES.map((c) => [c, 0])) as Record<string, number>
  for (const v of vendors) {
    const cat = vendorPrimaryCategory(v)
    if (cat && cat in counts) counts[cat] += 1
  }
  return counts
}

export function vendorsVendingSoon(vendors: MockVendor[], limit = 4): MockVendor[] {
  return vendors
    .filter((v) => v.conventionSlot != null || v.upcomingEvents > 0)
    .slice(0, limit)
}

export function vendorsFeatured(vendors: MockVendor[], limit = 3): MockVendor[] {
  return [...vendors].sort((a, b) => b.rating - a.rating).slice(0, limit)
}
