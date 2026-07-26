import { useId } from 'react'
import ExploreActiveFilterPills from '@/components/explore/ExploreActiveFilterPills'
import ExploreChipRow from '@/components/explore/ExploreChipRow'
import {
  EXPLORE_DISCOVERY_CHIPS,
  buildExploreActiveFilterPills,
  isDiscoveryChipActive,
  type ExploreActiveFilterPill,
  type ExploreDiscoveryChipId,
  type ExploreFilters,
} from '@/lib/explore-hub'

type Props = {
  searchQuery: string
  onSearchChange: (value: string) => void
  filters: ExploreFilters
  onDiscoveryChipToggle: (chipId: ExploreDiscoveryChipId) => void
  onRemoveFilterPill: (pill: ExploreActiveFilterPill) => void
  onOpenFilters: () => void
  activeFilterCount?: number
}

export default function ExploreHubHeader({
  searchQuery,
  onSearchChange,
  filters,
  onDiscoveryChipToggle,
  onRemoveFilterPill,
  onOpenFilters,
  activeFilterCount = 0,
}: Props) {
  const searchId = useId()
  const activePills = buildExploreActiveFilterPills(filters)

  const discoveryChips = EXPLORE_DISCOVERY_CHIPS.map((chip) => ({
    id: chip.id,
    label: chip.label,
    active: isDiscoveryChipActive(filters, chip.id),
  }))

  return (
    <header className="space-y-4 lg:space-y-5">
      <div>
        <p className="xpl-hero__eyebrow">Discovery hub</p>
        <h1 className="xpl-hero__title">Explore the community</h1>
        <p className="xpl-hero__subtitle">
          Your map of kink.social. Search for something specific, open filters for trust and location, or browse chips
          and sections to jump into events, groups, people, orgs, vendors, education, and media.
        </p>
      </div>

      <div className="xpl-search-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search the community
            </label>
            <input
              id={searchId}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search events, groups, people, orgs, vendors, education, media…"
              className="xpl-search-input"
              autoComplete="off"
            />
          </div>
          <button type="button" onClick={onOpenFilters} className="xpl-filter-btn">
            <svg className="h-3.5 w-3.5 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3 4h18M7 8h10m-7 4h4m-7 4h10"
              />
            </svg>
            <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>
        </div>

        <ExploreActiveFilterPills pills={activePills} onRemove={onRemoveFilterPill} />
      </div>

      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Quick filters</p>
        <ExploreChipRow
          chips={discoveryChips}
          onToggle={(id) => onDiscoveryChipToggle(id as ExploreDiscoveryChipId)}
          ariaLabel="Discovery filters"
        />
      </div>
    </header>
  )
}
