import {
  normalizeVendorCategory,
  VENDOR_CATEGORY_VALUES,
  type VendorCategory,
} from '@c2k/shared'

import type { MockVendor } from '@/data/types'

export { VENDOR_CATEGORY_VALUES, type VendorCategory }

export type ShipsToFilter = '' | 'US' | 'Canada' | 'International'

export type VendorSortTab = 'Top rated' | 'Vending soon' | 'A–Z' | 'Recently added'

export function filterSummaryLabel(opts: {
  searchQuery: string
  selectedCategory: string | null
  shipsTo: ShipsToFilter
  minRating: number
  sortTab: VendorSortTab
}): string | null {
  const parts: string[] = []
  if (opts.searchQuery.trim()) parts.push(`"${opts.searchQuery.trim()}"`)
  if (opts.selectedCategory) parts.push(opts.selectedCategory)
  if (opts.shipsTo) parts.push(`Ships ${opts.shipsTo}`)
  if (opts.minRating > 0) parts.push(`${opts.minRating}+ stars`)
  if (opts.sortTab !== 'Top rated') parts.push(opts.sortTab)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function countActiveVendorFilters(opts: {
  searchQuery: string
  selectedCategory: string | null
  shipsTo: ShipsToFilter
  minRating: number
  sortTab: VendorSortTab
}): number {
  let n = 0
  if (opts.searchQuery.trim()) n++
  if (opts.selectedCategory) n++
  if (opts.shipsTo) n++
  if (opts.minRating > 0) n++
  if (opts.sortTab !== 'Top rated') n++
  return n
}

/**
 * Client-side filter/sort for vendor directory rows (API-mapped or mock).
 */
export function filterVendors(
  vendors: MockVendor[],
  opts: {
    searchQuery: string
    selectedCategory: string | null
    shipsTo: ShipsToFilter
    minRating: number
    sortTab?: VendorSortTab
  },
): MockVendor[] {
  const q = opts.searchQuery.trim().toLowerCase()
  const sortTab = opts.sortTab ?? 'Top rated'

  let out = vendors.filter((v) => {
    if (q) {
      const haystack = [
        v.name,
        v.description ?? '',
        v.category ?? '',
        ...(v.tags ?? []),
        ...(v.categories ?? []),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    if (opts.selectedCategory) {
      const vendorCategory =
        v.category ?? normalizeVendorCategory(v.categories?.[0] ?? '') ?? null
      if (vendorCategory !== opts.selectedCategory) return false
    }

    if (opts.shipsTo) {
      const s = v.shipsTo.toLowerCase()
      if (opts.shipsTo === 'US' && !s.includes('us')) return false
      if (opts.shipsTo === 'Canada' && !s.includes('canada')) return false
      if (opts.shipsTo === 'International') {
        const multiRegion = s.includes(',') || s.includes('international')
        if (!multiRegion) return false
      }
    }

    if (opts.minRating > 0 && v.rating < opts.minRating) return false

    return true
  })

  if (sortTab === 'A–Z') {
    out = [...out].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortTab === 'Recently added') {
    out = [...out].sort((a, b) => {
      const aId = typeof a.id === 'number' ? a.id : Number.parseInt(String(a.id), 10) || 0
      const bId = typeof b.id === 'number' ? b.id : Number.parseInt(String(b.id), 10) || 0
      return bId - aId
    })
  } else if (sortTab === 'Vending soon') {
    out = [...out].sort((a, b) => {
      const aSoon = a.conventionSlot || a.upcomingEvents > 0 ? 1 : 0
      const bSoon = b.conventionSlot || b.upcomingEvents > 0 ? 1 : 0
      if (bSoon !== aSoon) return bSoon - aSoon
      return b.rating - a.rating
    })
  } else {
    out = [...out].sort((a, b) => b.rating - a.rating)
  }

  return out
}

/** @deprecated Use filterVendors */
export const filterMockVendors = filterVendors
