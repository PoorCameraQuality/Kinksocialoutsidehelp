import { useEffect, useId, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import EventCard from '@/components/cards/EventCard'
import GeoFilterControl from '@/components/browse/GeoFilterControl'
import EmptyState from '@/components/ui/EmptyState'
import { EventSkeleton } from '@/components/ui/skeleton'
import { mockEvents } from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEvents, type ApiEventsFilters } from '@/hooks/useApiEvents'
import { usePersistedGeoText } from '@/hooks/usePersistedGeoText'
import { MAX_DISTANCE_MI, rankEvents } from '@/lib/discovery-utils'
import { EVENT_CATEGORY_VALUES } from '@c2k/shared'
import EventsDiscoverPage from '@/app/events/EventsDiscoverPage'
import EventsPersonalLibraryPage from '@/app/events/EventsPersonalLibraryPage'
import { isPersonalEventsMode, parseEventsSectionMode } from '@/lib/events-section-mode'

const EVENT_CATEGORIES = EVENT_CATEGORY_VALUES

type FilterState = {
  eventFormatFilter: 'all' | 'in-person' | 'virtual'
  setEventFormatFilter: (v: 'all' | 'in-person' | 'virtual') => void
  selectedCategories: string[]
  toggleCategory: (cat: string) => void
  dateRange: { start: string; end: string }
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>
  distance: number
  setDistance: (n: number) => void
  country: string
  setCountry: (v: string) => void
  city: string
  setCity: (v: string) => void
  hasActiveFilters: boolean
  clearFilters: () => void
}

function EventFiltersFields({ idPrefix, f }: { idPrefix: string; f: FilterState }) {
  const dateStartId = `${idPrefix}-date-start`
  const dateEndId = `${idPrefix}-date-end`

  return (
    <>
      <GeoFilterControl
        idPrefix={idPrefix}
        distance={f.distance}
        onDistanceChange={f.setDistance}
        country={f.country}
        onCountryChange={f.setCountry}
        city={f.city}
        onCityChange={f.setCity}
      />
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
          className="mb-2 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated/95 px-3 py-2 text-sm text-dc-text"
        />
        <label htmlFor={dateEndId} className="sr-only">
          End date
        </label>
        <input
          id={dateEndId}
          type="date"
          value={f.dateRange.end}
          onChange={(e) => f.setDateRange((p) => ({ ...p, end: e.target.value }))}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated/95 px-3 py-2 text-sm text-dc-text"
        />
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium text-dc-text-muted">Event format</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Event format">
          {(['all', 'in-person', 'virtual'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              aria-pressed={f.eventFormatFilter === fmt}
              onClick={() => f.setEventFormatFilter(fmt)}
              className={`min-h-11 min-w-[4.5rem] flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
                f.eventFormatFilter === fmt ? 'bg-dc-accent/20 text-dc-accent' : 'bg-dc-elevated/95 text-dc-text-muted hover:text-dc-text'
              }`}
            >
              {fmt === 'all' ? 'All' : fmt === 'in-person' ? 'In-person' : 'Virtual'}
            </button>
          ))}
        </div>
      </div>
      <fieldset aria-label="Category filters">
        <legend className="mb-2 block text-sm font-medium text-dc-text-muted">Category</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_CATEGORIES.map((cat) => {
            const pressed = f.selectedCategories.includes(cat)
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={pressed}
                onClick={() => f.toggleCategory(cat)}
                className={`min-h-11 rounded-lg px-3 py-2 text-sm ${
                  pressed ? 'bg-dc-accent text-dc-accent-foreground' : 'bg-dc-elevated/95 text-dc-text-muted hover:text-dc-text'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </fieldset>
      {f.hasActiveFilters ?
        <button
          type="button"
          onClick={f.clearFilters}
          className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm font-medium text-dc-text-muted hover:text-dc-text"
        >
          Clear filters
        </button>
      : null}
    </>
  )
}

function EventsGroupScopedPage({ scopeGroupId }: { scopeGroupId: string }) {
  const searchId = useId()
  const [scopeGroupName, setScopeGroupName] = useState<string | null>(null)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(scopeGroupId)) {
      setScopeGroupName(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(scopeGroupId)}`, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const d = (await r.json()) as { group?: { name?: string } }
        if (!cancelled) setScopeGroupName(d.group?.name ?? null)
      } catch {
        if (!cancelled) setScopeGroupName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scopeGroupId])

  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [eventFormatFilter, setEventFormatFilter] = useState<'all' | 'in-person' | 'virtual'>('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [distance, setDistance] = useState(MAX_DISTANCE_MI)
  const { country, setCountry, city, setCity } = usePersistedGeoText()
  const [searchQuery, setSearchQuery] = useState('')

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
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

  const apiEvents = useApiEvents(scopeGroupId, apiListFilters)

  const eventSource = useMemo(() => {
    if (useDemoFallback) return mockEvents
    if (apiEvents.status === 'ready') return apiEvents.items
    return []
  }, [apiEvents, useDemoFallback])

  const filteredEvents = useMemo(() => {
    return rankEvents(eventSource, {
      searchQuery,
      dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
      categories: useDemoFallback && selectedCategories.length > 0 ? selectedCategories : undefined,
      eventFormat: useDemoFallback && eventFormatFilter !== 'all' ? eventFormatFilter : undefined,
      distanceMi: distance,
      cityFilter: useDemoFallback ? city : undefined,
      countryFilter: useDemoFallback ? country : undefined,
      sortBy: 'soon',
    })
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
  ])

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
  }

  const filterState: FilterState = {
    eventFormatFilter,
    setEventFormatFilter,
    selectedCategories,
    toggleCategory,
    dateRange,
    setDateRange,
    distance,
    setDistance,
    country,
    setCountry,
    city,
    setCity,
    hasActiveFilters,
    clearFilters,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="hidden flex-shrink-0 space-y-6 lg:block lg:w-64 lg:sticky lg:top-24 lg:self-start" aria-label="Event filters">
          <EventFiltersFields idPrefix="evt-desktop" f={filterState} />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-dc-text">Group events</h1>
                <p className="mt-1 text-sm text-dc-text-muted">
                  {scopeGroupName ? `Showing events for ${scopeGroupName}.` : 'Showing events for this group.'}
                </p>
                <Link
                  to={`/groups/${encodeURIComponent(scopeGroupId)}?tab=Events`}
                  className="mt-2 inline-block text-sm text-dc-accent hover:underline"
                >
                  ← Back to group calendar
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dc-border bg-dc-elevated/95 px-4 text-sm font-medium text-dc-accent lg:hidden"
                >
                  Filters
                </button>
                <button
                  data-create-trigger
                  className="min-h-11 rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Create Event
                </button>
              </div>
            </div>
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search events by title or location
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
                name="events-search"
                placeholder="Search events by title or location…"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated/95 py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
              />
            </div>
          </div>

          {filterDrawerOpen ?
            <div className="mb-6 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 lg:hidden">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-dc-text">Filters</h2>
                <button type="button" onClick={() => setFilterDrawerOpen(false)} className="min-h-11 px-2 text-dc-muted hover:text-dc-text">
                  Close
                </button>
              </div>
              <EventFiltersFields idPrefix="evt-mobile" f={filterState} />
            </div>
          : null}

          {apiEvents.status === 'loading' ?
            <EventSkeleton count={4} />
          : apiEvents.status === 'error' ?
            <EmptyState
              inline
              title="Could not load events"
              message="The events list did not load. Check your connection and try again."
              actionLabel="Retry"
              onAction={apiEvents.reload}
            />
          : filteredEvents.length === 0 ?
            <EmptyState
              inline
              title="No events match"
              message={hasActiveFilters ? 'Try widening filters or searching with different keywords.' : 'Nothing listed for this group yet.'}
              actionLabel={hasActiveFilters ? 'Clear all filters' : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          }
        </main>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const [searchParams] = useSearchParams()
  const scopeGroupId = searchParams.get('groupId')

  if (searchParams.get('rsvp') === '1') {
    const next = new URLSearchParams(searchParams)
    next.delete('rsvp')
    next.set('mine', 'registrations')
    return <Navigate to={`/events?${next.toString()}`} replace />
  }

  if (scopeGroupId) {
    return <EventsGroupScopedPage scopeGroupId={scopeGroupId} />
  }

  const mode = parseEventsSectionMode(searchParams)
  if (isPersonalEventsMode(mode)) {
    return <EventsPersonalLibraryPage mode={mode} />
  }

  return <EventsDiscoverPage />
}
