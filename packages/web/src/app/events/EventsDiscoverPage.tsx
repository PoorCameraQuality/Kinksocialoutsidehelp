import { useId, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import EventsGridCard from '@/components/events/EventsGridCard'
import EventsMobileFastFilters from '@/components/events/EventsMobileFastFilters'
import EventsFeaturedStrip from '@/components/events/EventsFeaturedStrip'
import EventsDiscoverLeftRail from '@/components/events/EventsDiscoverLeftRail'
import EventsPagination from '@/components/events/EventsPagination'
import EventFiltersPanel, { type EventFilterState } from '@/components/events/EventFiltersPanel'
import EventsAgendaList from '@/components/events/EventsAgendaList'
import EventsRightRail from '@/components/events/EventsRightRail'
import EventsDisplayControls, {
  type EventsSortMode,
  type EventsViewMode,
} from '@/components/events/EventsDisplayControls'
import EventsScopeTabs from '@/components/events/EventsScopeTabs'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/shell/PageHeader'
import { EventSkeleton } from '@/components/ui/skeleton'
import DirectoryTemplate, { DirectoryFilterButton } from '@/components/templates/DirectoryTemplate'
import FilterSheet from '@/components/templates/FilterSheet'
import { mockEvents } from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEvents, type ApiEventsFilters } from '@/hooks/useApiEvents'
import { useEventsAgendaSidebar } from '@/hooks/useEventsAgendaSidebar'
import { usePersistedGeoText } from '@/hooks/usePersistedGeoText'
import { MAX_DISTANCE_MI, rankEvents } from '@/lib/discovery-utils'
import {
  countEventsByCategory,
  eventStartDate,
  filterEventsByScope,
  paginateEvents,
  type EventsScopeTab,
} from '@/lib/events-page-utils'
type ViewMode = EventsViewMode
type SortMode = EventsSortMode

const SCOPE_SUMMARY_LABEL: Record<EventsScopeTab, string> = {
  all: 'events',
  'for-you': 'events picked for you',
  weekend: 'events this weekend',
  next7: 'events in the next 7 days',
  month: 'events this month',
}

const SORT_SUMMARY_LABEL: Record<SortMode, string> = {
  upcoming: 'sorted by soonest',
  relevance: 'sorted by popularity',
  new: 'sorted by newest',
}

function buildEventsResultSummary({
  count,
  pastView,
  scopeTab,
  searchQuery,
  appliedFilterCount,
  sortMode,
  viewMode,
  onClearFilters,
}: {
  count: number
  pastView: boolean
  scopeTab: EventsScopeTab
  searchQuery: string
  appliedFilterCount: number
  sortMode: SortMode
  viewMode: ViewMode
  onClearFilters: () => void
}): ReactNode {
  const scopeNoun = pastView ? 'past public events' : SCOPE_SUMMARY_LABEL[scopeTab]
  const parts = [`${count} ${scopeNoun}`]
  const q = searchQuery.trim()
  if (q) parts.push(`matching “${q}”`)
  if (appliedFilterCount > 0) {
    parts.push(`${appliedFilterCount} filter${appliedFilterCount === 1 ? '' : 's'} active`)
  }
  parts.push(SORT_SUMMARY_LABEL[sortMode])
  parts.push(`${viewMode} view`)

  return (
    <p className="text-sm text-dc-text-muted">
      <span>Showing {parts.join(' · ')}</span>
      {appliedFilterCount > 0 || q ?
        <>
          {' '}
          <button type="button" onClick={onClearFilters} className="font-medium text-dc-accent hover:underline">
            Clear filters
          </button>
        </>
      : null}
    </p>
  )
}

type EventFilterDraft = {
  eventFormatFilter: 'all' | 'in-person' | 'virtual'
  selectedCategories: string[]
  dateRange: { start: string; end: string }
  distance: number
  country: string
  city: string
}

function countEventActiveFilters(d: EventFilterDraft): number {
  let count = 0
  if (d.eventFormatFilter !== 'all') count++
  if (d.dateRange.start || d.dateRange.end) count++
  if (d.distance < MAX_DISTANCE_MI) count++
  if (d.country.trim()) count++
  if (d.city.trim()) count++
  if (d.selectedCategories.length > 0) count++
  return count
}

function emptyEventFilterDraft(): EventFilterDraft {
  return {
    eventFormatFilter: 'all',
    selectedCategories: [],
    dateRange: { start: '', end: '' },
    distance: MAX_DISTANCE_MI,
    country: '',
    city: '',
  }
}

export default function EventsDiscoverPage() {
  const searchId = useId()
  const sortId = useId()
  const [searchParams] = useSearchParams()
  const pastView = searchParams.get('view') === 'past'

  const { isAuthenticated } = useAuth()
  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState<EventFilterDraft>(emptyEventFilterDraft)
  const [eventFormatFilter, setEventFormatFilter] = useState<'all' | 'in-person' | 'virtual'>('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [distance, setDistance] = useState(MAX_DISTANCE_MI)
  const { country, setCountry, city, setCity } = usePersistedGeoText()
  const [searchQuery, setSearchQuery] = useState('')
  const [scopeTab, setScopeTab] = useState<EventsScopeTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortMode, setSortMode] = useState<SortMode>('upcoming')
  const [page, setPage] = useState(1)

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
    setPage(1)
  }

  const apiListFilters = useMemo((): ApiEventsFilters | undefined => {
    if (useDemoFallback) return undefined
    return {
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      format: eventFormatFilter,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
    }
  }, [useDemoFallback, selectedCategories, eventFormatFilter, city, country])

  const apiEvents = useApiEvents(apiListFilters)
  const apiBackedEvents = !useDemoFallback && apiEvents.status === 'ready'
  const agenda = useEventsAgendaSidebar({ enabled: apiBackedEvents })

  const eventSource = useMemo(() => {
    if (useDemoFallback) return mockEvents
    if (apiEvents.status === 'ready') return apiEvents.items
    return []
  }, [apiEvents, useDemoFallback])

  const categoryCounts = useMemo(() => countEventsByCategory(eventSource), [eventSource])

  const filteredEvents = useMemo(() => {
    const ranked = rankEvents(eventSource, {
      searchQuery,
      dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
      categories: useDemoFallback && selectedCategories.length > 0 ? selectedCategories : undefined,
      eventFormat: useDemoFallback && eventFormatFilter !== 'all' ? eventFormatFilter : undefined,
      distanceMi: distance,
      cityFilter: useDemoFallback ? city : undefined,
      countryFilter: useDemoFallback ? country : undefined,
      sortBy: sortMode === 'relevance' ? 'relevance' : sortMode === 'new' ? 'new' : 'soon',
    })

    const now = Date.now()
    const timeFiltered =
      pastView ?
        ranked.filter((e) => {
          const d = eventStartDate(e)
          return d ? d.getTime() < now : false
        })
      : ranked.filter((e) => {
          const d = eventStartDate(e)
          return d ? d.getTime() >= now : true
        })

    return filterEventsByScope(timeFiltered, scopeTab)
  }, [
    eventSource,
    searchQuery,
    dateRange,
    selectedCategories,
    eventFormatFilter,
    distance,
    city,
    country,
    useDemoFallback,
    sortMode,
    scopeTab,
    pastView,
  ])

  const { slice: pageEvents, totalPages } = useMemo(
    () => paginateEvents(filteredEvents, page),
    [filteredEvents, page],
  )

  // Strip is for organizer-featured picks only — not a duplicate of the list head.
  const featuredStripEvents = useMemo(
    () => filteredEvents.filter((e) => e.featured === true || e.isFeatured === true),
    [filteredEvents],
  )

  // Agenda grouping only makes sense in chronological (upcoming) order.
  const agendaGrouped = sortMode === 'upcoming' && !pastView

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedCategories.length > 0 ||
    Boolean(dateRange.start || dateRange.end) ||
    distance < MAX_DISTANCE_MI ||
    Boolean(country.trim()) ||
    Boolean(city.trim()) ||
    eventFormatFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategories([])
    setDateRange({ start: '', end: '' })
    setDistance(MAX_DISTANCE_MI)
    setCountry('')
    setCity('')
    setEventFormatFilter('all')
    setPage(1)
  }

  const openFilterSheet = () => {
    setFilterDraft({
      eventFormatFilter,
      selectedCategories: [...selectedCategories],
      dateRange: { ...dateRange },
      distance,
      country,
      city,
    })
    setFilterSheetOpen(true)
  }

  const applyFilterDraft = () => {
    setEventFormatFilter(filterDraft.eventFormatFilter)
    setSelectedCategories([...filterDraft.selectedCategories])
    setDateRange({ ...filterDraft.dateRange })
    setDistance(filterDraft.distance)
    setCountry(filterDraft.country)
    setCity(filterDraft.city)
    setPage(1)
  }

  const appliedFilterCount = countEventActiveFilters({
    eventFormatFilter,
    selectedCategories,
    dateRange,
    distance,
    country,
    city,
  })

  const filterDraftState = useMemo((): EventFilterState => {
    const setDateRangeDraft: Dispatch<SetStateAction<{ start: string; end: string }>> = (fn) => {
      setFilterDraft((d) => ({
        ...d,
        dateRange: typeof fn === 'function' ? fn(d.dateRange) : fn,
      }))
    }
    return {
      eventFormatFilter: filterDraft.eventFormatFilter,
      setEventFormatFilter: (v) => setFilterDraft((d) => ({ ...d, eventFormatFilter: v })),
      selectedCategories: filterDraft.selectedCategories,
      toggleCategory: (cat) =>
        setFilterDraft((d) => ({
          ...d,
          selectedCategories:
            d.selectedCategories.includes(cat) ?
              d.selectedCategories.filter((c) => c !== cat)
            : [...d.selectedCategories, cat],
        })),
      dateRange: filterDraft.dateRange,
      setDateRange: setDateRangeDraft,
      distance: filterDraft.distance,
      setDistance: (n) => setFilterDraft((d) => ({ ...d, distance: n })),
      country: filterDraft.country,
      setCountry: (v) => setFilterDraft((d) => ({ ...d, country: v })),
      city: filterDraft.city,
      setCity: (v) => setFilterDraft((d) => ({ ...d, city: v })),
      hasActiveFilters: countEventActiveFilters(filterDraft) > 0,
      clearFilters: () => setFilterDraft(emptyEventFilterDraft()),
    }
  }, [filterDraft])

  const filterState = {
    eventFormatFilter,
    setEventFormatFilter: (v: 'all' | 'in-person' | 'virtual') => {
      setEventFormatFilter(v)
      setPage(1)
    },
    selectedCategories,
    toggleCategory,
    dateRange,
    setDateRange,
    distance,
    setDistance: (n: number) => {
      setDistance(n)
      setPage(1)
    },
    country,
    setCountry,
    city,
    setCity,
    hasActiveFilters,
    clearFilters,
  }

  const pageTitle = pastView ? 'Past Public Events' : 'Events'
  const pageSubtitle =
    pastView ?
      'Browse events that have already happened.'
    : 'Find munches, classes, and parties near you.'
  const pageSubtitleLong =
    'Compare by date, location, format, and category before you RSVP.'

  const resetFastFilters = () => {
    setScopeTab('all')
    setEventFormatFilter('all')
    setSelectedCategories([])
    setPage(1)
  }

  const eventListBody =
    apiEvents.status === 'loading' ?
      <EventSkeleton count={4} />
    : apiEvents.status === 'error' ?
      <EmptyState
        inline
        title="Could not load events"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={apiEvents.reload}
      />
    : filteredEvents.length === 0 ?
      <EmptyState
        inline
        className="rounded-2xl border border-dc-border bg-dc-elevated-solid"
        icon={
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        title="No events match"
        message={hasActiveFilters ? 'Try resetting filters or widening your search.' : 'Nothing listed yet. Check back soon or browse all events.'}
        actionLabel={hasActiveFilters ? 'Reset filters' : undefined}
        onAction={hasActiveFilters ? clearFilters : undefined}
        ctaLabel={hasActiveFilters ? undefined : 'Browse all events'}
        ctaHref={hasActiveFilters ? undefined : '/events'}
      />
    : viewMode === 'list' ?
      <EventsAgendaList events={pageEvents} grouped={agendaGrouped} />
    : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {pageEvents.map((event) => (
          <EventsGridCard key={String(event.id)} event={event} />
        ))}
      </div>

  const resultSummary =
    apiEvents.status === 'ready' && filteredEvents.length > 0 ?
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {buildEventsResultSummary({
          count: filteredEvents.length,
          pastView,
          scopeTab,
          searchQuery,
          appliedFilterCount,
          sortMode,
          viewMode,
          onClearFilters: clearFilters,
        })}
        <EventsPagination variant="compact" page={page} totalPages={totalPages} onPageChange={setPage} className="shrink-0" />
      </div>
    : null

  return (
    <DirectoryTemplate
      title={pageTitle}
      description={pageSubtitle}
      className="py-4 sm:py-6"
      header={
        <PageHeader
          title={pageTitle}
          description={pageSubtitle}
          sticky={false}
          className="mb-2 lg:mb-6"
        />
      }
      desktopSidebar={
        <EventsDiscoverLeftRail
          filterState={filterState}
          categoryCounts={categoryCounts}
          {...agenda}
        />
      }
      desktopAside={
        <EventsRightRail
          allEvents={eventSource}
          suggested={filteredEvents}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortId={sortId}
        />
      }
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search events
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
              placeholder="Search events…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full min-h-11 rounded-xl border border-dc-border bg-[var(--dc-input)] py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 xl:hidden">
            <DirectoryFilterButton activeFilterCount={appliedFilterCount} onClick={openFilterSheet} />
            <EventsDisplayControls
              sortId={sortId}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </div>
      }
      resultSummary={
        resultSummary ?
          <>
            <p className="mb-2 text-xs text-dc-muted sm:hidden">
              {filteredEvents.length} {pastView ? 'past events' : 'events'}
              {appliedFilterCount > 0 ? ` · ${appliedFilterCount} filter${appliedFilterCount === 1 ? '' : 's'}` : ''}
            </p>
            <div className="mb-4 hidden sm:block">{resultSummary}</div>
          </>
        : null
      }
    >
      <p className="mb-3 hidden max-w-prose text-sm text-dc-muted lg:block">{pageSubtitleLong}</p>

      <EventsMobileFastFilters
        scopeTab={scopeTab}
        eventFormatFilter={eventFormatFilter}
        isAuthenticated={isAuthenticated}
        selectedCategories={selectedCategories}
        onScopeChange={(tab) => {
          setScopeTab(tab)
          setPage(1)
        }}
        onFormatChange={(format) => {
          setEventFormatFilter(format)
          setPage(1)
        }}
        onToggleCategory={toggleCategory}
        onReset={resetFastFilters}
      />

      <div className="hidden lg:block">
        <EventsScopeTabs
          active={scopeTab}
          onChange={(t) => {
            setScopeTab(t)
            setPage(1)
          }}
          totalCount={filteredEvents.length}
        />
      </div>

      <div className="hidden lg:block">
        {!pastView && featuredStripEvents.length > 1 ? <EventsFeaturedStrip events={featuredStripEvents} /> : null}
      </div>

      {eventListBody}

      {!pastView && featuredStripEvents.length > 1 ?
        <div className="mt-6 lg:hidden">
          <EventsFeaturedStrip events={featuredStripEvents} />
        </div>
      : null}

      {filteredEvents.length > 0 ?
        <EventsPagination variant="full" page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      : null}

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        activeFilterCount={countEventActiveFilters(filterDraft)}
        onApply={applyFilterDraft}
        onClear={() => {
          const empty = emptyEventFilterDraft()
          setFilterDraft(empty)
          setEventFormatFilter(empty.eventFormatFilter)
          setSelectedCategories(empty.selectedCategories)
          setDateRange(empty.dateRange)
          setDistance(empty.distance)
          setCountry(empty.country)
          setCity(empty.city)
          setPage(1)
        }}
      >
        <EventFiltersPanel
          idPrefix="evt-sheet"
          f={filterDraftState}
          categoryCounts={categoryCounts}
          hideFooter
        />
      </FilterSheet>
    </DirectoryTemplate>
  )
}
