import type { Dispatch, SetStateAction } from 'react'
import {
  CONVENTION_EVENT_TYPE_LABELS,
  CONVENTION_LOCATION_OPTIONS,
  type ConventionEventType,
} from '@/lib/conventions-page-utils'

export type ConventionFilterState = {
  searchQuery: string
  setSearchQuery: (v: string) => void
  dateRange: { start: string; end: string }
  setDateRange: Dispatch<SetStateAction<{ start: string; end: string }>>
  locationRegion: string
  setLocationRegion: (v: string) => void
  selectedEventTypes: ConventionEventType[]
  toggleEventType: (t: ConventionEventType) => void
  hasActiveFilters: boolean
  clearFilters: () => void
}

type Props = {
  idPrefix: string
  f: ConventionFilterState
  eventTypeCounts: Map<ConventionEventType, number>
  showHeading?: boolean
}

export default function ConventionFiltersPanel({ idPrefix, f, eventTypeCounts, showHeading = true }: Props) {
  const searchId = `${idPrefix}-search`
  const dateStartId = `${idPrefix}-date-start`
  const dateEndId = `${idPrefix}-date-end`
  const locationId = `${idPrefix}-location`

  return (
    <div className="space-y-4">
      {showHeading ?
        <h3 className="text-sm font-semibold text-dc-text">Filter conventions</h3>
      : null}

      <div>
        <label htmlFor={searchId} className="mb-2 block text-sm font-medium text-dc-text-muted">
          Search
        </label>
        <input
          id={searchId}
          type="search"
          value={f.searchQuery}
          onChange={(e) => f.setSearchQuery(e.target.value)}
          placeholder="Name, city, keyword…"
          className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 py-2 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-dc-text-muted">Date range</span>
        <label htmlFor={dateStartId} className="sr-only">
          Start date
        </label>
        <input
          id={dateStartId}
          type="date"
          value={f.dateRange.start}
          onChange={(e) => f.setDateRange((p) => ({ ...p, start: e.target.value }))}
          className="mb-2 w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 py-2 text-sm text-dc-text"
        />
        <label htmlFor={dateEndId} className="sr-only">
          End date
        </label>
        <input
          id={dateEndId}
          type="date"
          value={f.dateRange.end}
          onChange={(e) => f.setDateRange((p) => ({ ...p, end: e.target.value }))}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 py-2 text-sm text-dc-text"
        />
      </div>

      <div>
        <label htmlFor={locationId} className="mb-2 block text-sm font-medium text-dc-text-muted">
          Location
        </label>
        <select
          id={locationId}
          value={f.locationRegion}
          onChange={(e) => f.setLocationRegion(e.target.value)}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 py-2 text-sm text-dc-text"
        >
          {CONVENTION_LOCATION_OPTIONS.map((opt) => (
            <option key={opt.value || 'any'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-dc-text-muted">Event type</legend>
        <ul className="space-y-1">
          {(Object.keys(CONVENTION_EVENT_TYPE_LABELS) as ConventionEventType[]).map((t) => {
            const checked = f.selectedEventTypes.includes(t)
            const count = eventTypeCounts.get(t) ?? 0
            return (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg py-1 text-sm hover:bg-dc-elevated-hover">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => f.toggleEventType(t)}
                    className="rounded border-dc-border text-dc-accent focus:ring-dc-accent"
                  />
                  <span className="flex-1 text-dc-text-muted">{CONVENTION_EVENT_TYPE_LABELS[t]}</span>
                  <span className="text-xs tabular-nums text-dc-muted">{count}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <button
        type="button"
        onClick={f.clearFilters}
        className="w-full min-h-10 rounded-xl border border-dc-border text-sm font-medium text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
      >
        Reset filters
      </button>
    </div>
  )
}
