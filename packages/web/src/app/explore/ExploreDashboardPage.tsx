import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import VendorCard from '@/components/cards/VendorCard'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import ExploreHubShell from '@/components/explore/ExploreHubShell'
import ExploreCompactEventRow from '@/components/explore/ExploreCompactEventRow'
import ExploreCompactGroupRow from '@/components/explore/ExploreCompactGroupRow'
import ExploreCompactTrendingRow from '@/components/explore/ExploreCompactTrendingRow'
import ExploreFeaturedTrendingCard from '@/components/explore/ExploreFeaturedTrendingCard'
import ExploreFiltersPanel from '@/components/explore/ExploreFiltersPanel'
import ExploreHubHeader from '@/components/explore/ExploreHubHeader'
import ExploreHubSection from '@/components/explore/ExploreHubSection'
import ExplorePersonPreviewCard from '@/components/explore/ExplorePersonPreviewCard'
import ExploreSuggestedRow from '@/components/explore/ExploreSuggestedRow'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import OrgDirectoryCard from '@/components/orgs/OrgDirectoryCard'
import EmptyState from '@/components/ui/EmptyState'
import { mockPeople, mockVendors, type MockVendor } from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEducationArticles } from '@/hooks/useApiEducationArticles'
import { useApiMediaShows } from '@/hooks/useApiMediaShows'
import { useApiOrganizations } from '@/hooks/useApiOrganizations'
import { useHomeSurface } from '@/hooks/useHomeSurface'
import { useOrganizerOrgScopes, viewerCanManageOrg } from '@/hooks/useOrganizerOrgScopes'
import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'
import {
  EMPTY_EXPLORE_FILTERS,
  applyExploreArticleFilters,
  applyExploreEventFilters,
  applyExploreGroupFilters,
  applyExploreMediaFilters,
  applyExploreOrgFilters,
  applyExplorePeopleFilters,
  applyExploreTrendingFilters,
  applyExploreVendorFilters,
  buildExploreActiveFilterPills,
  buildExplorePeoplePool,
  buildSuggestedItems,
  exploreFiltersActive,
  filterArticles,
  filterEvents,
  filterGroups,
  filterMedia,
  filterOrgs,
  filterPeople,
  filterTrending,
  filterVendors,
  parseExploreFilters,
  shouldShowExploreSection,
  toggleDiscoveryChip,
  writeExploreFiltersToParams,
  type ExploreActiveFilterPill,
  type ExploreDiscoveryChipId,
  type ExploreFilters,
} from '@/lib/explore-hub'
import { toOrgDirectoryModel } from '@/lib/org-directory-utils'
import { vendorsVendingSoon } from '@/lib/vendor-directory-utils'
import DirectoryTemplate from '@/components/templates/DirectoryTemplate'
import FilterSheet from '@/components/templates/FilterSheet'
import { cn } from '@/lib/cn'

const START_EXPLORING_LINKS = [
  { href: '/groups', label: 'Groups', hint: 'Join regional and interest communities.' },
  { href: '/orgs', label: 'Organizations', hint: 'Find hosts and educators near you.' },
  { href: '/education', label: 'Education', hint: 'Read guides and workshop paths.' },
] as const

/**
 * Explore frames vendors as discovery only — never a storefront. Strip pricing so
 * previews don't read like a marketplace; checkout always happens on the vendor's
 * own external store (VendorCard keeps the "Sold externally" framing).
 */
function toExploreVendor(vendor: MockVendor): MockVendor {
  const copy = { ...vendor }
  delete copy.featuredListingPriceCents
  delete copy.featuredListingCurrency
  return copy
}

const EXPLORE_MOBILE_ORDER: Record<number, string> = {
  3: 'order-3',
  4: 'order-4',
  5: 'order-5',
  6: 'order-6',
  7: 'order-7',
  8: 'order-8',
  9: 'order-9',
  10: 'order-10',
  11: 'order-11',
}

export default function ExploreDashboardPage() {
  const { isAuthenticated, isFallback } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState<ExploreFilters>(EMPTY_EXPLORE_FILTERS)

  const searchQuery = searchParams.get('q') ?? ''
  const filters = useMemo(() => parseExploreFilters(searchParams), [searchParams])

  useEffect(() => {
    if (!searchParams.get('tab')) return
    setSearchParams(
      (prev: URLSearchParams) => writeExploreFiltersToParams(prev, parseExploreFilters(prev)),
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchParams(
        (prev: URLSearchParams) => {
          const next = new URLSearchParams(prev)
          if (q.trim()) next.set('q', q)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const applyFilters = useCallback(
    (next: ExploreFilters) => {
      setSearchParams((prev: URLSearchParams) => writeExploreFiltersToParams(prev, next), { replace: true })
    },
    [setSearchParams],
  )

  const openFilters = useCallback(() => {
    setFilterDraft(filters)
    setFiltersOpen(true)
  }, [filters])

  const handleDiscoveryChipToggle = useCallback(
    (chipId: ExploreDiscoveryChipId) => {
      applyFilters(toggleDiscoveryChip(filters, chipId))
    },
    [applyFilters, filters],
  )

  const handleRemoveFilterPill = useCallback(
    (pill: ExploreActiveFilterPill) => {
      applyFilters(pill.remove(filters))
    },
    [applyFilters, filters],
  )

  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated

  const surface = useHomeSurface({
    activeTab: 'Trending',
    postsRefreshKey: 0,
    conventionsTabActive: false,
  })

  const {
    rankedEvents,
    rankedGroups,
    rankedPeople,
    rankedVendorsHome,
    displayTrendingItems,
    displayCoSuggestions,
    nearbyPeople,
    homeEventsLoading,
    homeEventsApiError,
    apiEvents,
    homeGroupsLoading,
    homeGroupsApiError,
    apiGroups,
    homeTrendingLoading,
  } = surface

  const eduArticles = useApiEducationArticles({ limit: 8, enabled: true })
  const orgsApi = useApiOrganizations(true, { q: searchQuery, sort: 'popular' })
  const { bySlug } = useOrganizerOrgScopes()

  const peoplePool = useMemo(
    () => buildExplorePeoplePool(useDemoFallback, mockPeople, rankedPeople, displayCoSuggestions, nearbyPeople),
    [useDemoFallback, rankedPeople, displayCoSuggestions, nearbyPeople],
  )
  const vendorPool = useDemoFallback ? mockVendors : rankedVendorsHome
  const vendingSoon = vendorsVendingSoon(vendorPool, 6)

  const orgModels = useMemo(
    () => (orgsApi.status === 'ready' ? orgsApi.items.map(toOrgDirectoryModel) : []),
    [orgsApi.items, orgsApi.status],
  )

  const q = searchQuery.trim()
  const filtersActive = useMemo(() => exploreFiltersActive(filters), [filters])
  const hasSearchOrFilter = q.length > 0 || filtersActive

  const events = useMemo(() => {
    const searched = filterEvents(rankedEvents, q)
    return applyExploreEventFilters(searched, filters)
  }, [rankedEvents, q, filters])

  const groups = useMemo(() => {
    const searched = filterGroups(rankedGroups, q)
    return applyExploreGroupFilters(searched, filters)
  }, [rankedGroups, q, filters])

  const people = useMemo(() => {
    const searched = filterPeople(peoplePool, q)
    return applyExplorePeopleFilters(searched, filters)
  }, [peoplePool, q, filters])

  const vendors = useMemo(() => {
    const searched = filterVendors(vendingSoon, q)
    return applyExploreVendorFilters(searched, filters)
  }, [vendingSoon, q, filters])

  /**
   * Discovery preview: prefer "vending soon" matches; when nothing is vending and
   * the visitor hasn't searched/filtered, fall back to a couple of recent vendors so
   * the module never looks like a broken/empty search.
   */
  const vendorPreview = useMemo(() => {
    if (vendors.length > 0) return vendors.slice(0, 2)
    if (!hasSearchOrFilter) return vendorPool.slice(0, 2)
    return []
  }, [vendors, hasSearchOrFilter, vendorPool])

  const trending = useMemo(() => {
    const searched = filterTrending(displayTrendingItems, q)
    return applyExploreTrendingFilters(searched, filters)
  }, [displayTrendingItems, q, filters])

  const articles = useMemo(() => {
    const searched = filterArticles(eduArticles.items, q)
    return applyExploreArticleFilters(searched, filters)
  }, [eduArticles.items, q, filters])

  const orgs = useMemo(() => {
    const searched = filterOrgs(orgModels, q)
    return applyExploreOrgFilters(searched, filters)
  }, [orgModels, q, filters])

  const showMedia = shouldShowExploreSection('Media', filters)
  const mediaShowsApi = useApiMediaShows({ limit: 4, enabled: showMedia })

  const mediaShows = useMemo(() => {
    const pool = mediaShowsApi.status === 'ready' ? mediaShowsApi.items : []
    const searched = filterMedia(pool, q)
    return applyExploreMediaFilters(searched, filters)
  }, [mediaShowsApi.items, mediaShowsApi.status, q, filters])

  const suggested = useMemo(
    () =>
      buildSuggestedItems({
        people: peoplePool,
        groups: rankedGroups,
        events: rankedEvents,
        orgs: orgModels,
      }),
    [peoplePool, rankedGroups, rankedEvents, orgModels],
  )

  const showFeatured = shouldShowExploreSection('featured', filters)
  const showGroups = shouldShowExploreSection('Groups', filters)
  const showOrgs = shouldShowExploreSection('Organizations', filters)
  const showVendors = shouldShowExploreSection('Vendors', filters)
  const showEvents = shouldShowExploreSection('Events', filters)
  const showPeople = shouldShowExploreSection('People', filters)
  const showEducation = shouldShowExploreSection('Education', filters)

  const featuredGroups = groups.slice(0, 1)
  const featuredOrgs = orgs.slice(0, 1)
  const featuredTrendingHero = trending[0] ?? null
  const featuredTrendingRows = trending.slice(1, 3)

  const previewResultCount =
    events.length +
    groups.length +
    people.length +
    vendors.length +
    trending.length +
    articles.length +
    orgs.length +
    mediaShows.length
  const showNoExactMatches = q.length > 0 && previewResultCount === 0

  /** When trending is featured up top, date/event rows move down — avoid back-to-back event lists. */
  const deferUpcomingEvents = showFeatured
  const sectionOrders = deferUpcomingEvents ?
    { featured: 3, groups: 4, orgs: 5, people: 6, education: 7, vendors: 8, media: 9, events: 10, suggested: 11 }
  : { featured: 4, groups: 5, orgs: 6, people: 7, education: 8, vendors: 9, media: 10, events: 3, suggested: 11 }

  const exploreTile = (mobileOrder: number, span: 'third' | 'full', soloWide = false) => {
    const spanClass =
      span === 'full' ? 'sm:col-span-2 lg:col-span-12' : soloWide ? 'sm:col-span-2 lg:col-span-12 lg:max-w-xl' : 'lg:col-span-4'
    return cn(EXPLORE_MOBILE_ORDER[mobileOrder] ?? 'order-first', 'lg:order-none', spanClass)
  }

  const panelLayout = 'panel' as const

  const upcomingEventsSection =
    showEvents ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.events, 'third', !showFeatured)}
        title={events.length > 0 ? 'Upcoming events' : 'Start exploring'}
        href="/events"
        linkLabel={events.length > 0 ? 'Browse all events' : 'Open events directory'}
      >
        {homeEventsLoading ?
          <ul className="space-y-2" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" />
            ))}
          </ul>
        : homeEventsApiError ?
          <EmptyState
            inline
            title="Could not load events"
            message="We could not load upcoming events. Try again in a moment."
            actionLabel="Retry"
            onAction={apiEvents.reload}
          />
        : events.length > 0 ?
          <ul className="space-y-2">
            {events.slice(0, 2).map((event) => (
              <ExploreCompactEventRow key={String(event.id)} event={event} />
            ))}
          </ul>
        : q ?
          <p className="text-sm text-dc-muted">No upcoming events match your search.</p>
        : <ul className="grid gap-2">
            {START_EXPLORING_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className="xpl-teaser-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
                >
                  <span className="text-sm font-semibold text-dc-text">{link.label}</span>
                  <span className="text-xs leading-relaxed text-dc-text-muted">{link.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        }
      </ExploreHubSection>
    : null

  const featuredSection =
    showFeatured ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.featured, 'third', !showEvents)}
        title="Featured this week"
      >
        {homeTrendingLoading ?
          <ul className="space-y-2" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-xl bg-dc-elevated-muted" />
            ))}
          </ul>
        : trending.length === 0 ?
          <p className="text-sm text-dc-muted">Nothing featured this week yet. Check back soon.</p>
        : <div className="space-y-2">
            {featuredTrendingHero ?
              <ExploreFeaturedTrendingCard item={featuredTrendingHero} />
            : null}
            {featuredTrendingRows.length > 0 ?
              <ul className="xpl-trending-list space-y-1">
                {featuredTrendingRows.map((item) => (
                  <ExploreCompactTrendingRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            : null}
          </div>
        }
      </ExploreHubSection>
    : null

  const groupsSection =
    showGroups ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.groups, 'third')}
        title="Popular groups"
        href="/groups"
        linkLabel="Browse all groups"
      >
        {homeGroupsLoading ?
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" />
            ))}
          </div>
        : homeGroupsApiError ?
          <EmptyState
            inline
            title="Could not load groups"
            message="We could not load featured groups. Try again in a moment."
            actionLabel="Retry"
            onAction={apiGroups.reload}
          />
        : featuredGroups.length === 0 ?
          <p className="text-sm text-dc-muted">No groups match your search.</p>
        : <div className="space-y-2">
            {featuredGroups.map((g) => (
              <ExploreCompactGroupRow key={g.id} group={g} />
            ))}
          </div>
        }
      </ExploreHubSection>
    : null

  const orgsSection =
    showOrgs ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.orgs, 'third')}
        title="Featured organization"
        href="/orgs"
        linkLabel="Browse all organizations"
      >
        {orgsApi.status === 'loading' ?
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-dc-elevated-muted" />
            ))}
          </div>
        : featuredOrgs.length === 0 ?
          <p className="text-sm text-dc-muted">No organizations match your search.</p>
        : <div className="space-y-3">
            {featuredOrgs.map((org) => {
              const canManage = viewerCanManageOrg(bySlug, org.slug)
              return (
                <div key={org.id} className="space-y-1.5">
                  {/* Explore is discovery: lead with the public page, not an admin console. */}
                  <OrgDirectoryCard org={org} canManage={false} compact />
                  {canManage ?
                    <Link
                      to={`/organizer/orgs/${encodeURIComponent(org.slug)}`}
                      className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-dc-text-muted hover:text-dc-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
                    >
                      Manage this organization →
                    </Link>
                  : null}
                </div>
              )
            })}
          </div>
        }
      </ExploreHubSection>
    : null

  const peopleSection =
    showPeople ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.people, 'third')}
        title="People to discover"
        href={PEOPLE_DIRECTORY_PATH}
        linkLabel="Open people directory"
      >
        {people.length === 0 ?
          <p className="text-sm text-dc-muted">
            {q ?
              'No people match your search.'
            : 'No suggestions yet. Attend events or open the full People directory to browse members.'}
          </p>
        : <div className="space-y-2">
            {people.slice(0, 3).map((person) => (
              <ExplorePersonPreviewCard key={String(person.id)} person={person} />
            ))}
          </div>
        }
      </ExploreHubSection>
    : null

  const vendorsSection =
    showVendors ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.vendors, 'third')}
        title="Vendors"
        href="/vendors"
        linkLabel="Browse all vendors"
      >
        {vendorPreview.length > 0 ?
          <div className="space-y-3">
            {vendorPreview.map((v) => (
              <VendorCard key={String(v.id)} vendor={toExploreVendor(v)} compact />
            ))}
          </div>
        : <Link
            to="/vendors"
            className="xpl-teaser-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          >
            <p className="text-sm font-semibold text-dc-text">Vendor directory</p>
            <p className="text-sm text-dc-text-muted">
              {hasSearchOrFilter ?
                'No vendor matches yet. Browse all vendors or adjust your filters.'
              : 'No featured vendors yet. Browse the full directory of community shops and makers — checkout always stays on the vendor’s own store.'}
            </p>
            <span className="mt-1 text-sm font-medium text-dc-accent">Browse all vendors →</span>
          </Link>
        }
      </ExploreHubSection>
    : null

  const educationSection =
    showEducation ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.education, 'third')}
        title="Education"
        href="/education"
        linkLabel="Open education hub"
      >
        {eduArticles.status === 'loading' ?
          <div className="h-40 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
        : articles.length > 0 ?
          <div className="space-y-3">
            <EducationArticleCard article={articles[0]!} />
            {articles.length > 1 ?
              <p className="text-xs text-dc-muted">
                +{articles.length - 1} more{' '}
                <Link to="/education" className="font-medium text-dc-accent hover:underline">
                  in the library
                </Link>
              </p>
            : null}
          </div>
        : <Link
            to="/education"
            className="xpl-teaser-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          >
            <p className="text-sm font-semibold text-dc-text">Learning library</p>
            <p className="text-sm text-dc-text-muted">
              No articles match your filters yet — open the education hub for guides, safety resources, and workshop
              paths.
            </p>
            <span className="mt-1 text-sm font-medium text-dc-accent">Open education hub →</span>
          </Link>
        }
      </ExploreHubSection>
    : null

  const mediaSection =
    showMedia ?
      <ExploreHubSection
        layout={panelLayout}
        className={exploreTile(sectionOrders.media, 'third')}
        title="Media"
        href="/media"
        linkLabel="Browse all media"
      >
        {mediaShowsApi.status === 'loading' ?
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-dc-elevated-muted" />
            ))}
          </div>
        : mediaShowsApi.status === 'error' ?
          <EmptyState
            inline
            title="Could not load media"
            message={mediaShowsApi.error ?? 'Media previews are unavailable right now.'}
            ctaLabel="Open media directory"
            ctaHref="/media"
          />
        : mediaShows.length > 0 ?
          <div className="space-y-3">
            {mediaShows.slice(0, 1).map((show) => (
              <MediaChannelCard key={show.id} show={show} layout="compact" />
            ))}
          </div>
        : <Link
            to="/media"
            className="xpl-teaser-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          >
            <p className="text-sm font-semibold text-dc-text">Creator channels</p>
            <p className="text-sm text-dc-text-muted">
              Browse shows, galleries, and creator channels as they come online — no checkout on this preview.
            </p>
            <span className="mt-1 text-sm font-medium text-dc-accent">Browse media →</span>
          </Link>
        }
      </ExploreHubSection>
    : null

  const suggestedSection = (
    <ExploreHubSection
      layout={panelLayout}
      className={exploreTile(sectionOrders.suggested, 'full')}
      title="Suggested for you"
    >
      {suggested.length === 0 ?
        <p className="text-sm text-dc-muted">Suggestions appear as you participate in events and groups.</p>
      : <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {suggested.map((item) => (
            <ExploreSuggestedRow key={item.id} item={item} />
          ))}
        </ul>
      }
    </ExploreHubSection>
  )

  const activeFilterCount = buildExploreActiveFilterPills(filters).length

  return (
    <ExploreHubShell>
    <DirectoryTemplate
      title=""
      header={
        <div className="space-y-6">
          <ExploreHubHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onDiscoveryChipToggle={handleDiscoveryChipToggle}
            onRemoveFilterPill={handleRemoveFilterPill}
            onOpenFilters={openFilters}
            activeFilterCount={activeFilterCount}
          />
          {showNoExactMatches ?
            <div className="xpl-empty-banner">
              <EmptyState
                inline
                title="No exact matches"
                message="Nothing on this page matches your search. Try another term or open a full directory."
              />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <li>
                  <Link to="/events" className="font-medium text-dc-accent hover:underline">
                    Search events
                  </Link>
                </li>
                <li>
                  <Link to="/groups" className="font-medium text-dc-accent hover:underline">
                    Search groups
                  </Link>
                </li>
                <li>
                  <Link to={PEOPLE_DIRECTORY_PATH} className="font-medium text-dc-accent hover:underline">
                    Search people
                  </Link>
                </li>
                <li>
                  <Link to="/orgs" className="font-medium text-dc-accent hover:underline">
                    Search organizations
                  </Link>
                </li>
                <li>
                  <Link to="/vendors" className="font-medium text-dc-accent hover:underline">
                    Search vendors
                  </Link>
                </li>
                <li>
                  <Link to="/education" className="font-medium text-dc-accent hover:underline">
                    Search education
                  </Link>
                </li>
                <li>
                  <Link to="/media" className="font-medium text-dc-accent hover:underline">
                    Browse media
                  </Link>
                </li>
              </ul>
            </div>
          : null}
        </div>
      }
    >
      {/*
        Explore dashboard: 3-column tiles on desktop, stacked on mobile.
      */}
      <div className="xpl-dashboard-grid">
        {!deferUpcomingEvents ? upcomingEventsSection : null}
        {featuredSection}
        {groupsSection}
        {orgsSection}
        {peopleSection}
        {educationSection}
        {vendorsSection}
        {mediaSection}
        {deferUpcomingEvents ? upcomingEventsSection : null}
        {suggestedSection}
      </div>

      {!isAuthenticated || isFallback ?
        <p className="xpl-signin-banner">
          Sign in for personalized suggestions and saved filters. Public directories stay in the top navigation.
        </p>
      : null}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        activeFilterCount={buildExploreActiveFilterPills(filterDraft).length}
        onApply={() => applyFilters(filterDraft)}
        onClear={() => {
          setFilterDraft(EMPTY_EXPLORE_FILTERS)
          applyFilters(EMPTY_EXPLORE_FILTERS)
        }}
      >
        <ExploreFiltersPanel
          draft={filterDraft}
          onChange={setFilterDraft}
          hideFooter
          onApply={() => {
            applyFilters(filterDraft)
            setFiltersOpen(false)
          }}
          onClear={() => {
            setFilterDraft(EMPTY_EXPLORE_FILTERS)
            applyFilters(EMPTY_EXPLORE_FILTERS)
            setFiltersOpen(false)
          }}
        />
      </FilterSheet>
    </DirectoryTemplate>
    </ExploreHubShell>
  )
}
