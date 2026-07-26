import { useId, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import GroupDiscoverListCard from '@/components/groups/GroupDiscoverListCard'
import GroupsDiscoverLeftRail from '@/components/groups/GroupsDiscoverLeftRail'
import GroupsPurposeChips from '@/components/groups/GroupsPurposeChips'
import GroupsRightRail from '@/components/groups/GroupsRightRail'
import EmptyState from '@/components/ui/EmptyState'
import { GroupSkeleton } from '@/components/ui/skeleton'
import DirectoryTemplate, { DirectoryFilterButton } from '@/components/templates/DirectoryTemplate'
import FilterSheet from '@/components/templates/FilterSheet'
import type { MockGroup } from '@/data/mock-data'
import { mockGroups } from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { useApiGroups, type ApiGroupListItem } from '@/hooks/useApiGroups'
import { usePersistedGeoText } from '@/hooks/usePersistedGeoText'
import { cn } from '@/lib/cn'
import { MAX_DISTANCE_MI, rankGroups } from '@/lib/discovery-utils'
import { shellOuterClass } from '@/lib/shell-contract'
import {
  countGroupsByPurpose,
  deriveGroupDiscoverBadge,
  deriveGroupRecommendation,
  filterGroupsByPurpose,
  mockFriendsHereCount,
  sortGroupsForDiscover,
  type GroupPurposeFilter,
  type GroupsSortMode,
} from '@/lib/groups-page-utils'

function mapApiGroup(row: ApiGroupListItem): MockGroup {
  const vis =
    row.visibility === 'private' ? 'private' : row.visibility === 'invite-only' ? 'invite-only' : 'public'
  return {
    id: row.id,
    name: row.name,
    members: row.memberCount ?? 0,
    slug: row.slug,
    visibility: vis,
    category: row.category ?? null,
    tags: row.tags ?? undefined,
    descriptionSnippet: row.descriptionSnippet ?? null,
    memberAvatars: row.memberAvatars,
    coverImageUrl: row.coverImageUrl ?? null,
    placeLabel: row.placeLabel ?? null,
    location: row.placeLabel ?? undefined,
    distanceMi: row.distanceMi,
    createdAt: row.createdAt,
    joinMode: vis === 'public' ? 'open' : 'apply',
  }
}

function countGroupsActiveFilters(args: {
  searchQuery: string
  selectedPurposes: GroupPurposeFilter[]
  distance: number
  country: string
  city: string
}): number {
  let count = 0
  if (args.searchQuery.trim()) count++
  count += args.selectedPurposes.length
  if (args.distance < MAX_DISTANCE_MI) count++
  if (args.country.trim()) count++
  if (args.city.trim()) count++
  return count
}

export default function GroupsDiscoverPage() {
  const searchId = useId()
  const mainSearchId = useId()
  const [searchParams] = useSearchParams()

  const { isAuthenticated } = useAuth()
  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [morePurposeOpen, setMorePurposeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPurposes, setSelectedPurposes] = useState<GroupPurposeFilter[]>([])
  const [sortMode, setSortMode] = useState<GroupsSortMode>('recommended')
  const [distance, setDistance] = useState(MAX_DISTANCE_MI)
  const { country, setCountry, city, setCity } = usePersistedGeoText()

  const apiCategory = selectedPurposes.length === 1 && selectedPurposes[0] !== 'Support' ? selectedPurposes[0] : null
  const apiGroups = useApiGroups(!useDemoFallback, apiCategory)

  const dbGroups = useMemo(() => {
    if (apiGroups.status !== 'ready') return null
    return apiGroups.items.map(mapApiGroup)
  }, [apiGroups])

  const apiBackedGroups = dbGroups !== null

  const groupSource = useMemo(() => {
    if (useDemoFallback) return mockGroups
    if (apiBackedGroups) return dbGroups
    return []
  }, [useDemoFallback, apiBackedGroups, dbGroups])

  const purposeCounts = useMemo(() => countGroupsByPurpose(groupSource), [groupSource])

  const togglePurpose = (label: GroupPurposeFilter) => {
    setSelectedPurposes((prev) => (prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label]))
  }

  const rankOptions = useMemo(
    () => ({
      searchQuery,
      distanceMi: distance,
      visibility: undefined,
      category: undefined,
      cityFilter: city,
      countryFilter: country,
      sortBy: distance < MAX_DISTANCE_MI ? ('nearby' as const) : ('diverse' as const),
    }),
    [searchQuery, distance, city, country],
  )

  const filteredGroups = useMemo(() => {
    let list = rankGroups(groupSource, rankOptions)
    if (selectedPurposes.length > 0) {
      list = filterGroupsByPurpose(list, selectedPurposes)
    }
    return sortGroupsForDiscover(list, sortMode)
  }, [groupSource, rankOptions, selectedPurposes, sortMode])

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedPurposes.length > 0 ||
    distance < MAX_DISTANCE_MI ||
    Boolean(country.trim()) ||
    Boolean(city.trim())

  const activeFilterCount = countGroupsActiveFilters({
    searchQuery,
    selectedPurposes,
    distance,
    country,
    city,
  })

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedPurposes([])
    setSortMode('recommended')
    setDistance(MAX_DISTANCE_MI)
    setCountry('')
    setCity('')
    setFilterSheetOpen(false)
  }

  const filterState = {
    searchQuery,
    setSearchQuery,
    selectedPurposes,
    togglePurpose,
    distance,
    setDistance,
    country,
    setCountry,
    city,
    setCity,
    hasActiveFilters,
    clearFilters,
  }

  const loading = !useDemoFallback && apiGroups.status === 'loading'

  const sparse = filteredGroups.length > 0 && filteredGroups.length <= 3

  const rightRailProps = {
    allGroups: groupSource,
    suggested: filteredGroups.length > 0 ? filteredGroups : groupSource,
    onPurposeSelect: (p: string) => {
      togglePurpose(p as GroupPurposeFilter)
      setMorePurposeOpen(false)
    },
    onNearYou: () => setDistance(50),
  }

  if (searchParams.get('create') === 'group') {
    return <Navigate to="/groups/onboarding" replace />
  }

  return (
    <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>
      <DirectoryTemplate
        title="Discover Groups"
        className="py-4 sm:py-6"
        desktopAsideFrom="lg"
        header={
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Discover Groups</h1>
              <p className="mt-1 text-sm text-dc-text-muted">
                Find your people, munches, classes, and local scenes.
              </p>
            </div>
            <Link
              to="/groups/onboarding"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground transition-colors hover:bg-dc-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-bg"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create group
            </Link>
          </div>
        }
        toolbar={
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor={mainSearchId} className="sr-only">
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
              <input
                id={mainSearchId}
                type="search"
                placeholder="Search groups by name, description, or tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DirectoryFilterButton activeFilterCount={activeFilterCount} onClick={() => setFilterSheetOpen(true)} />
              <label className="sr-only" htmlFor="groups-sort">
                Sort groups
              </label>
              <select
                id="groups-sort"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as GroupsSortMode)}
                className="min-h-11 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
              >
                <option value="recommended">Sort by: Recommended</option>
                <option value="active">Sort by: Recently active</option>
                <option value="new">Sort by: Newest</option>
                <option value="members">Sort by: Most members</option>
                <option value="name">Sort by: Name</option>
              </select>
            </div>
          </div>
        }
        desktopSidebar={
          <GroupsDiscoverLeftRail
            filterState={filterState}
            purposeCounts={purposeCounts}
            searchId={searchId}
            filterIdPrefix="grp-rail"
          />
        }
        desktopAside={<GroupsRightRail {...rightRailProps} />}
      >
        <GroupsPurposeChips
          selected={selectedPurposes}
          onToggle={togglePurpose}
          moreOpen={morePurposeOpen}
          onMoreToggle={() => setMorePurposeOpen((o) => !o)}
        />

        {loading ?
          <GroupSkeleton count={4} />
        : !useDemoFallback && apiGroups.status === 'error' ?
          <EmptyState
            title="Could not load groups"
            message={apiGroups.errorMessage ?? 'The groups directory did not load.'}
            actionLabel="Retry"
            onAction={apiGroups.reload}
          />
        : filteredGroups.length === 0 ?
          hasActiveFilters ?
            <EmptyState
              title="No groups found"
              message="Try widening your location, removing a purpose filter, or starting a new community."
              actionLabel="Reset filters"
              onAction={clearFilters}
              secondaryCtaLabel="Organizations"
              secondaryCtaHref="/orgs"
            />
          : <EmptyState
              title="No groups found"
              message="Try widening your location or start a new community."
              ctaLabel="Create a group"
              ctaHref="/groups/onboarding"
              secondaryCtaLabel="Organizations"
              secondaryCtaHref="/orgs"
            />
        : <>
            <p className="mb-4 text-sm text-dc-muted" role="status">
              {filteredGroups.length} group{filteredGroups.length === 1 ? '' : 's'}
              {useDemoFallback ? ' · demo data' : null}
            </p>
            <ul className="space-y-4">
              {filteredGroups.map((g, index) => (
                <li key={g.id}>
                  <GroupDiscoverListCard
                    group={g}
                    badge={deriveGroupDiscoverBadge(g, index, 'all')}
                    friendsHere={useDemoFallback ? mockFriendsHereCount(g.id) : undefined}
                    recommendation={deriveGroupRecommendation(g, 'all')}
                  />
                </li>
              ))}
            </ul>
            {sparse ?
              <div className="mt-8 lg:hidden">
                <GroupsRightRail
                  allGroups={groupSource}
                  suggested={filteredGroups}
                  onPurposeSelect={(p) => {
                    togglePurpose(p as GroupPurposeFilter)
                    setMorePurposeOpen(false)
                  }}
                  onNearYou={() => setDistance(50)}
                />
              </div>
            : null}
          </>
        }

        <FilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="Group filters"
          activeFilterCount={activeFilterCount}
          onClear={clearFilters}
          liveApply
        >
          <GroupsDiscoverLeftRail
            filterState={filterState}
            purposeCounts={purposeCounts}
            searchId={searchId}
            filterIdPrefix="grp-mobile"
          />
        </FilterSheet>
      </DirectoryTemplate>
    </div>
  )
}
