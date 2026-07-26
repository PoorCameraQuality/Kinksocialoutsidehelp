import { useCallback, useEffect, useId, useState } from 'react'
import FindPeopleFiltersPanel from '@/components/find-people/FindPeopleFiltersPanel'
import FindPeopleLeftRail from '@/components/find-people/FindPeopleLeftRail'
import FindPeopleProfileCard from '@/components/find-people/FindPeopleProfileCard'
import FindPeopleRightRail from '@/components/find-people/FindPeopleRightRail'
import FindPeopleScopeTabs from '@/components/find-people/FindPeopleScopeTabs'
import type { FindPeopleFilterDraft } from '@/components/find-people/FindPeopleFiltersPanel'
import DirectoryTemplate, { DirectoryFilterButton } from '@/components/templates/DirectoryTemplate'
import FilterSheet from '@/components/templates/FilterSheet'
import EmptyState from '@/components/ui/EmptyState'
import { useApiPeopleSearch } from '@/hooks/useApiPeopleSearch'
import { PEOPLE_STREAM_TABS, peopleStreamTabLabel } from '@/lib/people-search-constants'
import type { CommunityRoleFilterId } from '@/lib/people-search-constants'
import { shellOuterClass } from '@/lib/shell-contract'
import { cn } from '@/lib/cn'
import { countPeopleActiveFilters } from '@/lib/people-directory-utils'
import { toggleArrayItem } from '@/lib/utils/toggleArrayItem'
import {
  PEOPLE_EMPTY_NEW_ACCOUNT_BODY,
  PEOPLE_EMPTY_NEW_ACCOUNT_TITLE,
  PEOPLE_EMPTY_SEARCH_BODY,
  PEOPLE_EMPTY_SEARCH_TITLE,
} from '@/lib/social-graph-copy'

function filtersFromHook(hook: ReturnType<typeof useApiPeopleSearch>): FindPeopleFilterDraft {
  return {
    distance: hook.distance,
    country: hook.country,
    city: hook.city,
    peopleGender: hook.peopleGender,
    communityRoles: hook.communityRoleFilters,
    interestRoles: hook.selectedRoles,
    experienceLevel: hook.experienceLevel,
    verifiedOnly: hook.verifiedOnly,
    eventActiveOnly: hook.eventActiveOnly,
  }
}

export default function FindPeopleDiscoverPage() {
  const searchId = useId()
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const hook = useApiPeopleSearch()
  const {
    streamTab,
    setStreamTab,
    setDistance,
    setCountry,
    setCity,
    setPeopleGender,
    selectedRoles,
    setSelectedRoles,
    communityRoleFilters,
    setCommunityRoleFilters,
    setExperienceLevel,
    setVerifiedOnly,
    setEventActiveOnly,
    searchQuery,
    setSearchQuery,
    displayPeople,
    totalCount,
    peopleApiBacked,
    peopleLoading,
    peopleLoadError,
    reloadPeople,
    hasMore,
    loadMore,
    viewerMissingStateId,
    useDemoFallback,
  } = hook

  const [draft, setDraft] = useState<FindPeopleFilterDraft>(() => filtersFromHook(hook))

  useEffect(() => {
    setDraft(filtersFromHook(hook))
  }, [
    hook.distance,
    hook.country,
    hook.city,
    hook.peopleGender,
    hook.selectedRoles,
    hook.communityRoleFilters,
    hook.experienceLevel,
    hook.verifiedOnly,
    hook.eventActiveOnly,
  ])

  const applyDraft = useCallback(() => {
    setDistance(draft.distance)
    setCountry(draft.country)
    setCity(draft.city)
    setPeopleGender(draft.peopleGender)
    setSelectedRoles(draft.interestRoles)
    setCommunityRoleFilters(draft.communityRoles)
    setExperienceLevel(draft.experienceLevel)
    setVerifiedOnly(draft.verifiedOnly)
    setEventActiveOnly(draft.eventActiveOnly)
    setFilterSheetOpen(false)
  }, [
    draft,
    setCity,
    setCountry,
    setCommunityRoleFilters,
    setDistance,
    setEventActiveOnly,
    setExperienceLevel,
    setPeopleGender,
    setSelectedRoles,
    setVerifiedOnly,
  ])

  const resetAll = useCallback(() => {
    const cleared: FindPeopleFilterDraft = {
      distance: 50,
      country: '',
      city: '',
      peopleGender: '',
      communityRoles: [],
      interestRoles: [],
      experienceLevel: 'any',
      verifiedOnly: false,
      eventActiveOnly: false,
    }
    setDraft(cleared)
    setDistance(cleared.distance)
    setCountry('')
    setCity('')
    setPeopleGender('')
    setSelectedRoles([])
    setCommunityRoleFilters([])
    setExperienceLevel('any')
    setVerifiedOnly(false)
    setEventActiveOnly(false)
    setSearchQuery('')
  }, [
    setCity,
    setCountry,
    setCommunityRoleFilters,
    setDistance,
    setEventActiveOnly,
    setExperienceLevel,
    setPeopleGender,
    setSearchQuery,
    setSelectedRoles,
    setVerifiedOnly,
  ])

  const toggleDraftInterestRole = (role: string) => {
    setDraft((prev) => ({
      ...prev,
      interestRoles: toggleArrayItem(prev.interestRoles, role),
    }))
  }

  const toggleDraftCommunityRole = (id: CommunityRoleFilterId) => {
    setDraft((prev) => ({
      ...prev,
      communityRoles: toggleArrayItem(prev.communityRoles, id),
    }))
  }

  const peopleBrowseUnfiltered =
    !searchQuery.trim() &&
    selectedRoles.length === 0 &&
    communityRoleFilters.length === 0 &&
    !hook.verifiedOnly &&
    !hook.eventActiveOnly &&
    hook.experienceLevel === 'any' &&
    !hook.peopleGender.trim()

  const profileLocationEditHref = '/profile/edit#profile-location'

  const showMissingStatePeopleEmpty =
    peopleApiBacked &&
    !peopleLoading &&
    !peopleLoadError &&
    viewerMissingStateId &&
    peopleBrowseUnfiltered &&
    displayPeople.length === 0

  const peopleEmptyIsNewAccountBrowse =
    peopleApiBacked && peopleBrowseUnfiltered && !searchQuery.trim() && displayPeople.length === 0

  const appliedFilterCount = countPeopleActiveFilters(filtersFromHook(hook))
  const filterRailProps = {
    draft,
    onDraftChange: (patch: Partial<FindPeopleFilterDraft>) => setDraft((prev) => ({ ...prev, ...patch })),
    onToggleCommunityRole: toggleDraftCommunityRole,
    onToggleInterestRole: toggleDraftInterestRole,
    onResetAll: resetAll,
    onApply: applyDraft,
    memberCount: totalCount,
    streamTab,
    peopleApiBacked,
  }

  return (
    <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>
      <DirectoryTemplate
        title="People"
        className="py-4 sm:py-6"
        desktopAsideFrom="lg"
        header={
          <div className="mb-3 sm:mb-6">
            <h1 className="text-xl font-bold tracking-tight text-dc-text sm:text-3xl">People</h1>
            <p className="mt-0.5 hidden max-w-xl text-sm text-dc-text-muted sm:mt-1 sm:block">
              Find members, educators, organizers, vendors, and community connections.
            </p>
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <label htmlFor={searchId} className="sr-only">
                Search people
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
              <input
                id={searchId}
                type="search"
                placeholder="Search names, bios, roles…"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-10 rounded-xl border border-dc-border bg-[var(--dc-input)] py-2 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent sm:min-h-11 sm:py-2.5"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DirectoryFilterButton
                activeFilterCount={appliedFilterCount}
                onClick={() => setFilterSheetOpen(true)}
              />
              <label className="sr-only" htmlFor="people-sort">
                Sort people
              </label>
              <select
                id="people-sort"
                value={streamTab}
                onChange={(e) => setStreamTab(e.target.value)}
                className="hidden min-h-11 max-w-[11rem] rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text sm:block"
              >
                {PEOPLE_STREAM_TABS.map((tab) => (
                  <option key={tab} value={tab}>
                    {peopleStreamTabLabel(tab)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
        desktopSidebar={<FindPeopleLeftRail {...filterRailProps} />}
        desktopAside={<FindPeopleRightRail peopleApiBacked={peopleApiBacked} useDemoFallback={useDemoFallback} />}
      >
        {!searchQuery.trim() ?
          <FindPeopleScopeTabs active={streamTab} onChange={setStreamTab} />
        : null}

        {peopleLoadError && !peopleLoading ?
          <EmptyState
            inline
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title="Could not load people"
            message="The profile directory did not load. Check your connection and try again."
            actionLabel="Retry"
            onAction={reloadPeople}
            secondaryCtaLabel="Browse groups"
            secondaryCtaHref="/groups"
          />
        : peopleLoading ?
          <div className="dc-panel-enter" aria-busy="true" role="status">
            <p className="mb-3 text-sm text-dc-muted">Searching people…</p>
            <div className="dc-skeleton-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="dc-skeleton-bone h-64 rounded-2xl border border-dc-border" />
              ))}
            </div>
          </div>
        : displayPeople.length === 0 && showMissingStatePeopleEmpty ?
          <EmptyState
            inline
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title="Add your state or region"
            message="Regional People browse and Near you suggestions use the state or region on your profile. City is optional."
            ctaLabel="Set state or region"
            ctaHref={profileLocationEditHref}
            secondaryCtaLabel="Browse groups"
            secondaryCtaHref="/groups"
          />
        : displayPeople.length === 0 ?
          peopleEmptyIsNewAccountBrowse ?
            <EmptyState
              inline
              className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
              title={PEOPLE_EMPTY_NEW_ACCOUNT_TITLE}
              message={PEOPLE_EMPTY_NEW_ACCOUNT_BODY}
              actions={[
                { label: 'Browse people', href: '/people', primary: true },
                { label: 'Explore groups', href: '/groups' },
                { label: 'Browse events', href: '/events' },
                { label: 'Edit profile', href: '/profile/edit' },
              ]}
            />
          : <EmptyState
              inline
              className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
              title={PEOPLE_EMPTY_SEARCH_TITLE}
              message={PEOPLE_EMPTY_SEARCH_BODY}
              actions={[
                { label: 'Clear filters', onClick: resetAll, primary: true },
                { label: 'Browse groups', href: '/groups' },
                { label: 'Browse events', href: '/events' },
              ]}
            />
        : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {displayPeople.map((person, index) => {
              const isRecommended =
                index === 0 && streamTab === 'Recommended' && !searchQuery.trim() && peopleBrowseUnfiltered
              return (
                <FindPeopleProfileCard
                  key={person.id}
                  person={person}
                  recommended={isRecommended}
                  mobileCompact={!isRecommended && index >= 1}
                />
              )
            })}
          </div>
        )}

        {hasMore && !peopleLoading ?
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="min-h-11 rounded-xl border border-dc-accent px-8 py-3 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
            >
              Show more members
            </button>
          </div>
        : null}

        {useDemoFallback ?
          <p className="mt-6 text-center text-xs text-dc-muted">Showing demo members. Sign in for the live directory.</p>
        : null}

        <FilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="People filters"
          activeFilterCount={countPeopleActiveFilters(draft)}
          onApply={applyDraft}
          onClear={resetAll}
        >
          <FindPeopleFiltersPanel idPrefix="fp-sheet" showHeading={false} hideFooter {...filterRailProps} />
        </FilterSheet>
      </DirectoryTemplate>
    </div>
  )
}
