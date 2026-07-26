import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VENDOR_CATEGORY_DESCRIPTIONS } from '@c2k/shared'
import { VENDOR_CATEGORY_VALUES } from '@/lib/vendor-filters'
import type { ShipsToFilter } from '@/lib/vendor-filters'

/**
 * Directory sort options. Discovery-first: defaults to "Recommended" and avoids
 * leading with "Top rated" when community review data is still sparse.
 */
export type DirectorySort = 'Recommended' | 'Recently added' | 'Vending soon' | 'A–Z' | 'Community reviewed'

const RATING_PRESETS = [
  { value: 0, label: 'Any' },
  { value: 4, label: '4+' },
  { value: 4.5, label: '4.5+' },
  { value: 4.8, label: '4.8+' },
] as const

export type VendorsFilterState = {
  selectedCategory: string | null
  shipsTo: ShipsToFilter
  minRating: number
  sortTab: DirectorySort
}

type Props = {
  idPrefix?: string
  filters: VendorsFilterState
  categoryCounts: Record<string, number>
  totalCount: number
  sortTabs: readonly DirectorySort[]
  shopFacetVendors: Array<{ slug?: string; id?: number | string; name: string }>
  filteredCount: number
  showHeading?: boolean
  onCategoryChange: (cat: string | null) => void
  onShipsToChange: (v: ShipsToFilter) => void
  onMinRatingChange: (v: number) => void
  onSortChange: (tab: DirectorySort) => void
  onClearFilters: () => void
}

export default function VendorsFiltersPanel({
  idPrefix = 'vendors',
  filters,
  categoryCounts,
  totalCount,
  sortTabs,
  shopFacetVendors,
  filteredCount,
  showHeading = true,
  onCategoryChange,
  onShipsToChange,
  onMinRatingChange,
  onSortChange,
  onClearFilters,
}: Props) {
  const [shopsOpen, setShopsOpen] = useState(false)
  const shipsId = `${idPrefix}-ships`
  const ratingId = `${idPrefix}-rating`

  return (
    <div className="space-y-4">
      {showHeading ?
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-dc-text">Refine your search</h3>
          <button type="button" onClick={onClearFilters} className="text-xs font-medium text-dc-accent hover:underline">
            Reset all
          </button>
        </div>
      : null}

      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dc-muted">Category</legend>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              aria-pressed={filters.selectedCategory === null}
              onClick={() => onCategoryChange(null)}
              className={`flex w-full min-h-9 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                filters.selectedCategory === null ?
                  'bg-dc-accent-muted font-medium text-dc-accent'
                : 'text-dc-text-muted hover:bg-dc-elevated-solid hover:text-dc-text'
              }`}
            >
              <span>All categories</span>
              <span className="tabular-nums text-xs opacity-80">{totalCount}</span>
            </button>
          </li>
          {VENDOR_CATEGORY_VALUES.map((cat) => {
            const pressed = filters.selectedCategory === cat
            const count = categoryCounts[cat] ?? 0
            return (
              <li key={cat}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  title={VENDOR_CATEGORY_DESCRIPTIONS[cat]}
                  onClick={() => onCategoryChange(pressed ? null : cat)}
                  className={`flex w-full min-h-9 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    pressed ?
                      'bg-dc-accent-muted font-medium text-dc-accent'
                    : 'text-dc-text-muted hover:bg-dc-elevated-solid hover:text-dc-text'
                  }`}
                >
                  <span className="min-w-0 truncate">{cat}</span>
                  <span className={`shrink-0 tabular-nums text-xs ${pressed ? 'text-dc-accent' : 'text-dc-muted'}`}>
                    {count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div>
        <label htmlFor={shipsId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
          Ships to
        </label>
        <select
          id={shipsId}
          value={filters.shipsTo}
          onChange={(e) => onShipsToChange(e.target.value as ShipsToFilter)}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"
        >
          <option value="">Any</option>
          <option value="US">US</option>
          <option value="Canada">Canada</option>
          <option value="International">International</option>
        </select>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-dc-text-muted">Min rating</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {RATING_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={filters.minRating === preset.value}
              onClick={() => onMinRatingChange(preset.value)}
              className={`min-h-8 rounded-full px-2.5 text-xs font-medium ${
                filters.minRating === preset.value ?
                  'bg-dc-accent text-dc-accent-foreground'
                : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:text-dc-text'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label htmlFor={ratingId} className="sr-only">
          Minimum rating slider
        </label>
        <input
          id={ratingId}
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={filters.minRating}
          onChange={(e) => onMinRatingChange(Number(e.target.value))}
          className="w-full accent-dc-accent"
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-dc-text-muted">Sort</legend>
        <ul className="space-y-0.5">
          {sortTabs.map((tab) => {
            const pressed = filters.sortTab === tab
            return (
              <li key={tab}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onSortChange(tab)}
                  className={`flex w-full min-h-9 items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    pressed ?
                      'bg-dc-accent-muted font-medium text-dc-accent'
                    : 'text-dc-text-muted hover:bg-dc-elevated-solid hover:text-dc-text'
                  }`}
                >
                  {tab}
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {shopFacetVendors.length > 0 ?
        <div className="border-t border-dc-border pt-3">
          <button
            type="button"
            aria-expanded={shopsOpen}
            onClick={() => setShopsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 text-sm font-medium text-dc-text-muted hover:text-dc-text"
          >
            <span>{filters.selectedCategory ? `Shops in ${filters.selectedCategory}` : 'Shops in results'}</span>
            <span className="text-xs" aria-hidden>
              {shopsOpen ? '▾' : '▸'}
            </span>
          </button>
          {shopsOpen ?
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-sm">
              {shopFacetVendors.map((v) => {
                const slug = v.slug ?? String(v.id)
                return (
                  <li key={slug}>
                    <Link
                      to={`/vendors/${encodeURIComponent(slug)}`}
                      className="block truncate rounded-lg px-2 py-1.5 text-dc-text hover:bg-dc-elevated-solid hover:text-dc-accent"
                    >
                      {v.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          : null}
          {filteredCount > shopFacetVendors.length ?
            <p className="mt-1 text-xs text-dc-muted">+ {filteredCount - shopFacetVendors.length} more in grid</p>
          : null}
        </div>
      : null}
    </div>
  )
}
