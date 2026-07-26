import { useMemo, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import VendorDirectoryCard from '@/components/vendors/VendorDirectoryCard'
import VendorsCategoryChips from '@/components/vendors/VendorsCategoryChips'
import VendorsFiltersPanel, { type DirectorySort } from '@/components/vendors/VendorsFiltersPanel'
import VendorsRightRail from '@/components/vendors/VendorsRightRail'
import EmptyState from '@/components/ui/EmptyState'
import TextInput from '@/components/ui/TextInput'
import DirectoryTemplate, { DirectoryFilterButton } from '@/components/templates/DirectoryTemplate'
import FilterSheet from '@/components/templates/FilterSheet'
import { cn } from '@/lib/cn'
import { shellOuterClass } from '@/lib/shell-contract'
import { mockVendors } from '@/data/mock-data'
import type { MockVendor } from '@/data/types'
import { useAuth } from '@/contexts/AuthContext'
import { useApiVendors } from '@/hooks/useApiVendors'
import { countVendorsByCategory } from '@/lib/vendor-directory-utils'
import { filterVendors, type ShipsToFilter, type VendorSortTab } from '@/lib/vendor-filters'

const SORT_OPTIONS: readonly DirectorySort[] = [
  'Recommended',
  'Recently added',
  'Vending soon',
  'A–Z',
  'Community reviewed',
]

const DEFAULT_SORT: DirectorySort = 'Recommended'

/** Map discovery sort labels onto the underlying client-side sort engine. */
const SORT_TO_VENDOR_TAB: Record<DirectorySort, VendorSortTab> = {
  Recommended: 'Top rated',
  'Recently added': 'Recently added',
  'Vending soon': 'Vending soon',
  'A–Z': 'A–Z',
  'Community reviewed': 'Top rated',
}

/** Composite "recommended" score: surfaces active, reviewed, visual vendors first. */
function recommendationScore(v: MockVendor): number {
  let score = 0
  if (v.conventionSlot || (v.upcomingEvents ?? 0) > 0) score += 3
  score += Math.min(v.verifiedFeedbackCount ?? 0, 10) * 0.2
  score += (v.rating ?? 0) * 0.4
  if (v.listingImageUrl?.trim() || v.logoUrl?.trim() || v.bannerUrl?.trim()) score += 0.5
  return score
}

function applyDirectorySort(list: MockVendor[], sort: DirectorySort): MockVendor[] {
  if (sort === 'Community reviewed') {
    return [...list].sort(
      (a, b) => (b.verifiedFeedbackCount ?? 0) - (a.verifiedFeedbackCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0),
    )
  }
  if (sort === 'Recommended') {
    return [...list].sort((a, b) => recommendationScore(b) - recommendationScore(a))
  }
  return list
}

function directoryFilterSummary(opts: {
  searchQuery: string
  selectedCategory: string | null
  shipsTo: ShipsToFilter
  minRating: number
  sortTab: DirectorySort
}): string | null {
  const parts: string[] = []
  if (opts.searchQuery.trim()) parts.push(`"${opts.searchQuery.trim()}"`)
  if (opts.selectedCategory) parts.push(opts.selectedCategory)
  if (opts.shipsTo) parts.push(`Ships ${opts.shipsTo}`)
  if (opts.minRating > 0) parts.push(`${opts.minRating}+ stars`)
  if (opts.sortTab !== DEFAULT_SORT) parts.push(opts.sortTab)
  return parts.length > 0 ? parts.join(' · ') : null
}

function countDirectoryFilters(opts: {
  searchQuery: string
  selectedCategory: string | null
  shipsTo: ShipsToFilter
  minRating: number
  sortTab: DirectorySort
}): number {
  let n = 0
  if (opts.searchQuery.trim()) n++
  if (opts.selectedCategory) n++
  if (opts.shipsTo) n++
  if (opts.minRating > 0) n++
  if (opts.sortTab !== DEFAULT_SORT) n++
  return n
}

export default function VendorsPage() {
  const { isAuthenticated } = useAuth()
  const searchId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [shipsTo, setShipsTo] = useState<ShipsToFilter>('')
  const [minRating, setMinRating] = useState(0)
  const [sortTab, setSortTab] = useState<DirectorySort>(DEFAULT_SORT)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated
  const apiBackedVendors = !useDemoFallback

  const apiVendors = useApiVendors(apiBackedVendors, {
    category: selectedCategory,
    shipsTo,
    minRating,
    q: searchQuery.trim().length >= 2 ? searchQuery : undefined,
  })

  const vendorSource = useMemo(() => {
    if (useDemoFallback) return mockVendors
    if (apiVendors.status === 'ready') return apiVendors.items
    return []
  }, [apiVendors, useDemoFallback])

  const vendorsForCounts = useMemo(
    () =>
      filterVendors(vendorSource, {
        searchQuery: apiBackedVendors && searchQuery.trim().length >= 2 ? '' : searchQuery,
        selectedCategory: null,
        shipsTo: apiBackedVendors ? '' : shipsTo,
        minRating: apiBackedVendors ? 0 : minRating,
        sortTab: 'Top rated',
      }),
    [vendorSource, searchQuery, shipsTo, minRating, apiBackedVendors],
  )

  const categoryCounts = useMemo(() => countVendorsByCategory(vendorsForCounts), [vendorsForCounts])

  const filteredVendors = useMemo(() => {
    const base = filterVendors(vendorSource, {
      searchQuery: apiBackedVendors && searchQuery.trim().length >= 2 ? '' : searchQuery,
      selectedCategory: apiBackedVendors ? null : selectedCategory,
      shipsTo: apiBackedVendors ? '' : shipsTo,
      minRating: apiBackedVendors ? 0 : minRating,
      sortTab: SORT_TO_VENDOR_TAB[sortTab],
    })
    return applyDirectorySort(base, sortTab)
  }, [vendorSource, searchQuery, selectedCategory, shipsTo, minRating, sortTab, apiBackedVendors])

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedCategory !== null ||
    shipsTo !== '' ||
    minRating > 0 ||
    sortTab !== DEFAULT_SORT

  const activeFilterCount = countDirectoryFilters({
    searchQuery,
    selectedCategory,
    shipsTo,
    minRating,
    sortTab,
  })

  const hideMobileListShopCta = filteredVendors.length >= 5

  const shopFacetVendors = useMemo(() => {
    const seen = new Set<string>()
    const out: typeof filteredVendors = []
    for (const v of filteredVendors) {
      const key = v.slug ?? String(v.id)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(v)
      if (out.length >= 12) break
    }
    return out
  }, [filteredVendors])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory(null)
    setShipsTo('')
    setMinRating(0)
    setSortTab(DEFAULT_SORT)
    setFilterSheetOpen(false)
  }

  const activeFilterSummary = directoryFilterSummary({
    searchQuery,
    selectedCategory,
    shipsTo,
    minRating,
    sortTab,
  })

  const listLoading = !useDemoFallback && apiVendors.status === 'loading'
  const listError = !useDemoFallback && apiVendors.status === 'error'
  const directoryEmpty = !listLoading && !listError && vendorSource.length === 0

  const filterPanelProps = {
    filters: { selectedCategory, shipsTo, minRating, sortTab },
    categoryCounts,
    totalCount: vendorsForCounts.length,
    sortTabs: SORT_OPTIONS,
    shopFacetVendors,
    filteredCount: filteredVendors.length,
    onCategoryChange: setSelectedCategory,
    onShipsToChange: setShipsTo,
    onMinRatingChange: setMinRating,
    onSortChange: setSortTab,
    onClearFilters: clearFilters,
  }

  return (
    <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>
      <DirectoryTemplate
        title="Vendors & Shops"
        className="py-4 sm:py-6"
        desktopAsideFrom="lg"
        header={
          <div className="mb-3 flex flex-col gap-3 lg:mb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl lg:text-3xl">Vendors &amp; Shops</h1>
              <p className="mt-1 max-w-2xl text-xs leading-snug text-dc-text-muted sm:text-sm">
                Discover vendors, makers, educators, and service providers in the community.
              </p>
              <p className="mt-2 flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-dc-text-muted sm:text-sm">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-dc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>
                  Kink Social does not process orders or payments — purchases, shipping, refunds, and commissions happen
                  through each vendor&apos;s external shop.
                </span>
              </p>
            </div>
            <div className={cn('shrink-0 lg:text-right', hideMobileListShopCta && 'max-lg:hidden')}>
              <Link
                to="/vendors/onboarding"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:w-auto"
              >
                List your shop
              </Link>
              <p className="mt-1.5 text-xs text-dc-muted lg:ml-auto lg:max-w-[14rem]">
                Add your shop, feature products, and link out for checkout.
              </p>
            </div>
          </div>
        }
        toolbar={
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <label htmlFor={searchId} className="sr-only">
                Search vendors
              </label>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dc-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <TextInput
                id={searchId}
                type="search"
                name="vendor-search"
                placeholder="Search vendors by name, specialty, or category…"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 rounded-xl pl-10"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <DirectoryFilterButton activeFilterCount={activeFilterCount} onClick={() => setFilterSheetOpen(true)} />
              <label className="sr-only" htmlFor="vendor-sort-mobile">
                Sort vendors
              </label>
              <select
                id="vendor-sort-mobile"
                value={sortTab}
                onChange={(e) => setSortTab(e.target.value as DirectorySort)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text sm:w-auto sm:flex-none"
              >
                {SORT_OPTIONS.map((tab) => (
                  <option key={tab} value={tab}>
                    Sort: {tab}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
        desktopSidebar={
          <aside aria-label="Vendor filters">
            <div className="sticky top-24 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
              <VendorsFiltersPanel idPrefix="vendors-rail" {...filterPanelProps} />
            </div>
          </aside>
        }
        desktopAside={<VendorsRightRail vendors={vendorSource} useDemoFallback={useDemoFallback} />}
      >
        <VendorsCategoryChips
          selectedCategory={selectedCategory}
          categoryCounts={categoryCounts}
          totalCount={vendorsForCounts.length}
          onCategoryChange={setSelectedCategory}
        />

        {selectedCategory && !listLoading && !listError ?
          <p className="mb-1 mt-4 text-lg font-semibold text-dc-text">{selectedCategory}</p>
        : null}
        {filteredVendors.length > 0 && !listLoading && !listError ?
          <p className="mb-4 mt-4 text-sm text-dc-muted" role="status">
            {filteredVendors.length} listing{filteredVendors.length === 1 ? '' : 's'}
            {activeFilterSummary ? ` · ${activeFilterSummary}` : null}
          </p>
        : null}

        {listLoading ?
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" role="status">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="dc-skeleton-bone h-72 rounded-2xl border border-dc-border" />
            ))}
          </div>
        : listError ?
          <EmptyState
            inline
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title="Could not load vendors"
            message={apiVendors.errorMessage ?? 'The vendor directory did not load. Check your connection and try again.'}
            actionLabel="Retry"
            onAction={apiVendors.reload}
          />
        : filteredVendors.length === 0 ?
          <EmptyState
            inline
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title={directoryEmpty ? 'No vendors listed yet' : 'No vendors found'}
            message={
              directoryEmpty ?
                'Help build the directory by inviting trusted vendors and makers to list their shops.'
              : hasActiveFilters ?
                'Try another category, widen your shipping filter, or suggest a vendor the community should know about.'
              : 'No vendor listings match your search yet.'
            }
            ctaLabel={directoryEmpty ? 'List your shop' : undefined}
            ctaHref={directoryEmpty ? '/vendors/onboarding' : undefined}
            actionLabel={hasActiveFilters && !directoryEmpty ? 'Reset filters' : undefined}
            onAction={hasActiveFilters && !directoryEmpty ? clearFilters : undefined}
            secondaryCtaLabel="Suggest a vendor"
            secondaryCtaHref="/support"
          />
        : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVendors.map((v) => (
              <VendorDirectoryCard key={String(v.id)} vendor={v} />
            ))}
          </div>
        )}

        {filteredVendors.length >= 12 && !listLoading ?
          <div className="mt-8 text-center">
            <p className="text-xs text-dc-muted">More vendors may appear as makers join the directory.</p>
          </div>
        : null}

        <FilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="Refine your search"
          activeFilterCount={activeFilterCount}
          onClear={clearFilters}
          liveApply
        >
          <VendorsFiltersPanel idPrefix="vendors-sheet" showHeading={false} {...filterPanelProps} />
        </FilterSheet>
      </DirectoryTemplate>
    </div>
  )
}
