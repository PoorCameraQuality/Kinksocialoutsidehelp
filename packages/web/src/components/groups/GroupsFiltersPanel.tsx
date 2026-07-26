import GeoFilterControl from '@/components/browse/GeoFilterControl'
import TextInput from '@/components/ui/TextInput'
import {
  GROUP_PURPOSE_FILTERS,
  type GroupPurposeFilter,
} from '@/lib/groups-page-utils'
import { GROUP_CATEGORY_DESCRIPTIONS } from '@c2k/shared'

export type GroupsFilterState = {
  searchQuery: string
  setSearchQuery: (v: string) => void
  selectedPurposes: GroupPurposeFilter[]
  togglePurpose: (label: GroupPurposeFilter) => void
  distance: number
  setDistance: (n: number) => void
  country: string
  setCountry: (v: string) => void
  city: string
  setCity: (v: string) => void
  hasActiveFilters: boolean
  clearFilters: () => void
}

type Props = {
  idPrefix: string
  searchId?: string
  f: GroupsFilterState
  purposeCounts: Map<string, number>
  showSearch?: boolean
  showHeading?: boolean
}

export default function GroupsFiltersPanel({
  idPrefix,
  searchId,
  f,
  purposeCounts,
  showSearch = true,
  showHeading = true,
}: Props) {
  return (
    <div className="space-y-4">
      {showHeading ?
        <h3 className="text-sm font-semibold text-dc-text">Filter groups</h3>
      : null}
      {showSearch && searchId ?
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Search groups
          </label>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dc-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <TextInput
            id={searchId}
            type="search"
            placeholder="Search groups…"
            value={f.searchQuery}
            onChange={(e) => f.setSearchQuery(e.target.value)}
            className="min-h-10 rounded-xl pl-10 text-sm"
          />
        </div>
      : null}
      <section aria-label="Location filters" className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-dc-muted">Location</h4>
        <GeoFilterControl
          idPrefix={idPrefix}
          distance={f.distance}
          onDistanceChange={f.setDistance}
          country={f.country}
          onCountryChange={f.setCountry}
          city={f.city}
          onCityChange={f.setCity}
        />
      </section>
      <fieldset className="border-t border-dc-border/60 pt-4">
        <legend className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-dc-muted">
          Purpose
        </legend>
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {GROUP_PURPOSE_FILTERS.map((label) => {
            const checked = f.selectedPurposes.includes(label)
            const count = purposeCounts.get(label) ?? 0
            const desc =
              label === 'Support' ?
                'Support groups, peer help, and community care'
              : GROUP_CATEGORY_DESCRIPTIONS[label as keyof typeof GROUP_CATEGORY_DESCRIPTIONS]
            return (
              <li key={label}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-dc-elevated-hover"
                  title={desc}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => f.togglePurpose(label)}
                    className="rounded border-dc-border text-dc-accent focus:ring-2 focus:ring-dc-accent focus:ring-offset-0"
                  />
                  <span className="flex-1 text-dc-text-muted">{label}</span>
                  <span className="text-xs tabular-nums text-dc-muted">{count}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      {f.hasActiveFilters ?
        <button
          type="button"
          onClick={f.clearFilters}
          className="w-full min-h-10 rounded-xl border border-dc-border text-sm font-medium text-dc-text-muted transition-colors hover:bg-dc-elevated-hover hover:text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
        >
          Reset filters
        </button>
      : null}
    </div>
  )
}
