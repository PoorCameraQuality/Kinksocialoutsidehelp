import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import GroupsFiltersPanel, { type GroupsFilterState } from '@/components/groups/GroupsFiltersPanel'
import GroupsSectionNavLinks from '@/components/groups/GroupsSectionNavLinks'

type Props = {
  filterState: GroupsFilterState
  purposeCounts: Map<string, number>
  searchId: string
  filterIdPrefix: string
  invitationBadge?: number
}

export default function GroupsDiscoverLeftRail({
  filterState,
  purposeCounts,
  searchId,
  filterIdPrefix,
  invitationBadge,
}: Props) {
  const { pathname, search } = useLocation()
  const [filtersOpen, setFiltersOpen] = useState(filterState.hasActiveFilters)

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Groups discovery">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dc-muted">Groups</p>
        <GroupsSectionNavLinks pathname={pathname} search={search} invitationBadge={invitationBadge} />

        <div className="mt-4 border-t border-dc-border pt-4">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="mb-3 flex w-full min-h-10 items-center justify-between rounded-xl px-2 text-sm font-semibold text-dc-text hover:bg-dc-elevated-hover"
            aria-expanded={filtersOpen}
          >
            <span>Filters</span>
            <span className="text-dc-muted" aria-hidden>
              {filtersOpen ? '−' : '+'}
            </span>
          </button>
          {filtersOpen ?
            <GroupsFiltersPanel
              idPrefix={filterIdPrefix}
              searchId={searchId}
              f={filterState}
              purposeCounts={purposeCounts}
              showHeading={false}
            />
          : null}
        </div>
      </div>
    </aside>
  )
}
