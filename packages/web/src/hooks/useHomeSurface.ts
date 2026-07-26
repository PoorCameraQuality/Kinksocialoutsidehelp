import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mockPeople,
  mockEvents,
  mockVendors,
  mockGroups,
  mockHomeConventions,
  getPublicGroupDiscussionPeek,
  mockCoAttendanceSuggestions,
  mockNearbyPeopleSuggestions,
  mockVendorSpotlightListings,
  mockVendorInPersonRows,
  mockVendorListingCarousel,
  mockTrendingMixedFeed,
  mockUpcomingClassesRail,
  mockGroupsForHomeJoin,
  type MockCoSuggestHome,
} from '@/data/mock-data'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEvents } from '@/hooks/useApiEvents'
import { useApiGroups } from '@/hooks/useApiGroups'
import { useApiVendors } from '@/hooks/useApiVendors'
import { rankPeople, rankEvents, rankGroups } from '@/lib/discovery-utils'
import { isUpcomingEvent } from '@/lib/events-page-utils'
import { isMultiDayConventionSpan, type ConventionKind } from '@/lib/convention-utils'
import type { TrendingItemCardModel } from '@/components/home/TrendingItemCard'

export type HomeConventionRow = {
  id: string
  slug: string
  name: string
  anchorEventId: string | null
  startsAt?: string | null
  endsAt?: string | null
  kind?: ConventionKind
}

type TrendingItem = TrendingItemCardModel

type VendorSpotlight = {
  vendorId: string
  vendorSlug: string
  shopName: string
  logoUrl: string | null
  listingTitle: string
  listingImageUrl?: string | null
}

type VendorInPerson = {
  vendorId: string
  slug: string
  displayName: string
  logoUrl: string | null
  eventId: string
  eventTitle: string
  startsAt: string
}

export type HomeSurfaceHeadline = {
  visible: boolean
  text: string
  tone: 'demo' | 'live' | 'loading' | 'muted'
}

export type UseHomeSurfaceParams = {
  activeTab: string
  postsRefreshKey: number
  conventionsTabActive: boolean
}

function resolveApiOrMock<T>(
  apiBacked: boolean,
  apiRows: T[] | null,
  mockRows: T[] | (() => T[]),
): T[] {
  if (apiBacked) {
    if (apiRows === null) return []
    return apiRows
  }
  return typeof mockRows === 'function' ? mockRows() : mockRows
}

function selectCatalogSource<T>(
  useDemoFallback: boolean,
  isAuthenticated: boolean,
  isFallback: boolean,
  apiResult: { status: string; items: T[] },
  mockCatalog: T[],
): T[] {
  if (useDemoFallback) return mockCatalog
  if (apiResult.status === 'ready') return apiResult.items
  if (isAuthenticated && !isFallback) return []
  return []
}

export function useHomeSurface({
  activeTab,
  postsRefreshKey,
  conventionsTabActive,
}: UseHomeSurfaceParams) {
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()

  const demoFallbackEnvEnabled = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = demoFallbackEnvEnabled && !isAuthenticated
  const apiBackedHome = isAuthenticated && !isFallback && !useDemoFallback
  const useDbComposer = isAuthenticated && !isFallback

  const apiEvents = useApiEvents()
  const apiVendors = useApiVendors(apiBackedHome)
  const apiGroups = useApiGroups(apiBackedHome)

  const [coSuggestions, setCoSuggestions] = useState<MockCoSuggestHome[] | null>(null)
  const [nearbyPeople, setNearbyPeople] = useState<MockCoSuggestHome[] | null>(null)
  const [trendingItems, setTrendingItems] = useState<TrendingItem[] | null>(null)
  const [trendingLoadState, setTrendingLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const trendingUsesApi = !useDemoFallback && !isFallback
  const [conventions, setConventions] = useState<HomeConventionRow[] | null>(null)
  const [conventionsLoadState, setConventionsLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [conventionsReloadToken, setConventionsReloadToken] = useState(0)
  const [vendorSpotlight, setVendorSpotlight] = useState<VendorSpotlight[] | null>(null)
  const [vendorInPerson, setVendorInPerson] = useState<VendorInPerson[] | null>(null)
  const [nearbyGroups, setNearbyGroups] = useState<
    {
      id: string
      name: string
      description?: string
      members: number
      coverImageUrl?: string | null
      category?: string | null
    }[] | null
  >(null)
  const [myGroups, setMyGroups] = useState<{ id: string; name: string; slug?: string | null }[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated || isFallback || authStatus !== 'ready') {
      setCoSuggestions(null)
      setNearbyPeople(null)
      return
    }
    let cancelled = false
    setCoSuggestions(null)
    setNearbyPeople(null)
    void (async () => {
      const [rCo, rNear] = await Promise.all([
        fetch('/api/v1/connections/suggested?source=co_attendance&limit=8', { credentials: 'include' }),
        fetch('/api/v1/connections/suggested?source=nearby&limit=24', { credentials: 'include' }),
      ])
      if (cancelled) return
      if (rCo.ok) {
        const d = (await rCo.json()) as { items?: MockCoSuggestHome[] }
        setCoSuggestions(d.items ?? [])
      } else setCoSuggestions([])
      if (rNear.ok) {
        const d = (await rNear.json()) as { items?: MockCoSuggestHome[] }
        setNearbyPeople(d.items ?? [])
      } else setNearbyPeople([])
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isFallback, authStatus])

  useEffect(() => {
    if (!apiBackedHome || authStatus !== 'ready') {
      setNearbyGroups(null)
      return
    }
    let cancelled = false
    void (async () => {
      const meRes = await fetch('/api/profile/me', { credentials: 'include' })
      if (cancelled) return
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          profile?: { geoJson?: unknown; placeId?: string | null; homeZip?: string | null }
        }
        const prof = me.profile
        if (!prof?.geoJson && !prof?.placeId) {
          setNearbyGroups([])
          return
        }
      }
      const r = await fetch('/api/v1/groups/nearby?radius=50&limit=6', { credentials: 'include' })
      if (cancelled) return
      if (!r.ok) {
        setNearbyGroups([])
        return
      }
      const d = (await r.json()) as {
        items?: {
          id: string
          name: string
          descriptionSnippet?: string | null
          memberCount?: number
          coverImageUrl?: string | null
          category?: string | null
        }[]
      }
      setNearbyGroups(
        (d.items ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          description: g.descriptionSnippet ?? undefined,
          members: g.memberCount ?? 0,
          coverImageUrl: g.coverImageUrl ?? null,
          category: g.category ?? null,
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [apiBackedHome, authStatus])

  useEffect(() => {
    if (!apiBackedHome || authStatus !== 'ready') {
      setMyGroups(null)
      return
    }
    let cancelled = false
    void (async () => {
      const r = await fetch('/api/v1/me/groups', { credentials: 'include' })
      if (cancelled) return
      if (!r.ok) {
        setMyGroups([])
        return
      }
      const d = (await r.json()) as { items?: { id: string; name: string; slug?: string | null }[] }
      setMyGroups(d.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [apiBackedHome, authStatus, postsRefreshKey])

  // Prefetch for the home right rail on every tab (Local / Near you / Following / Trending),
  // not only when the Trending tab is selected — otherwise the rail stays empty.
  useEffect(() => {
    if (!trendingUsesApi) {
      setTrendingItems(null)
      setTrendingLoadState('idle')
      return
    }
    let cancelled = false
    setTrendingLoadState((prev) => (prev === 'ready' ? 'ready' : 'loading'))
    void (async () => {
      try {
        const r = await fetch('/api/v1/trending?limit=28', { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setTrendingItems([])
          setTrendingLoadState('error')
          return
        }
        const d = (await r.json()) as { items?: TrendingItem[] }
        setTrendingItems(d.items ?? [])
        setTrendingLoadState('ready')
      } catch {
        if (!cancelled) {
          setTrendingItems([])
          setTrendingLoadState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trendingUsesApi, postsRefreshKey])

  useEffect(() => {
    if (!conventionsTabActive || !isAuthenticated || isFallback) {
      setConventions(null)
      setConventionsLoadState('idle')
      return
    }
    let cancelled = false
    setConventionsLoadState('loading')
    void (async () => {
      try {
        const r = await fetch('/api/v1/conventions', { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setConventions(null)
          setConventionsLoadState('error')
          return
        }
        const d = (await r.json()) as { items?: HomeConventionRow[] }
        setConventions(d.items ?? [])
        setConventionsLoadState('ready')
      } catch {
        if (!cancelled) {
          setConventions(null)
          setConventionsLoadState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conventionsTabActive, isAuthenticated, isFallback, conventionsReloadToken])

  useEffect(() => {
    if (activeTab !== 'Vendors' || !isAuthenticated || isFallback) {
      setVendorSpotlight(null)
      setVendorInPerson(null)
      return
    }
    let cancelled = false
    void (async () => {
      const [a, b] = await Promise.all([
        fetch('/api/v1/vendors/spotlight-listings?n=8', { credentials: 'include' }),
        fetch('/api/v1/vendors/in-person-upcoming', { credentials: 'include' }),
      ])
      if (cancelled) return
      if (a.ok) {
        const d = (await a.json()) as { items?: VendorSpotlight[] }
        setVendorSpotlight(d.items ?? [])
      } else setVendorSpotlight([])
      if (b.ok) {
        const d = (await b.json()) as { items?: VendorInPerson[] }
        setVendorInPerson(d.items ?? [])
      } else setVendorInPerson([])
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, isAuthenticated, isFallback])

  const reloadConventions = useCallback(() => setConventionsReloadToken((n) => n + 1), [])

  const eventSource = useMemo(
    () =>
      selectCatalogSource(useDemoFallback, isAuthenticated, isFallback, apiEvents, mockEvents),
    [apiEvents, useDemoFallback, isAuthenticated, isFallback],
  )

  const vendorSource = useMemo(
    () =>
      selectCatalogSource(useDemoFallback, isAuthenticated, isFallback, apiVendors, mockVendors),
    [apiVendors, useDemoFallback, isAuthenticated, isFallback],
  )

  const rankedEvents = useMemo(
    () => rankEvents(eventSource, { sortBy: 'soon' }).filter((e) => isUpcomingEvent(e)),
    [eventSource],
  )
  const rankedPeople = useMemo(() => (apiBackedHome ? [] : rankPeople(mockPeople, { sortBy: 'diverse' })), [apiBackedHome])

  const rankedGroups = useMemo(() => {
    if (!apiBackedHome) return rankGroups(mockGroups, { sortBy: 'diverse' })
    if (apiGroups.status !== 'ready' && nearbyGroups === null) return []
    const fromApi =
      apiGroups.status === 'ready' ?
        apiGroups.items.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.descriptionSnippet ?? undefined,
          members: g.memberCount ?? 0,
          coverImageUrl: g.coverImageUrl ?? null,
          category: g.category ?? null,
        }))
      : []
    if (nearbyGroups && nearbyGroups.length > 0) {
      const seen = new Set(nearbyGroups.map((g) => g.id))
      const rest = fromApi.filter((g) => !seen.has(g.id))
      return [...nearbyGroups, ...rest]
    }
    return fromApi
  }, [apiBackedHome, apiGroups, nearbyGroups])

  const rankedVendorsHome = useMemo(() => {
    const list = [...vendorSource]
    list.sort((a, b) => {
      const boostA = a.conventionSlot ? 2 : 0
      const boostB = b.conventionSlot ? 2 : 0
      if (boostB !== boostA) return boostB - boostA
      const onlineA = a.onlineOnly ? 1 : 0
      const onlineB = b.onlineOnly ? 1 : 0
      if (onlineA !== onlineB) return onlineA - onlineB
      return (b.rating ?? 0) - (a.rating ?? 0)
    })
    return list
  }, [vendorSource])

  const displayCoSuggestions = useMemo(
    () => resolveApiOrMock(apiBackedHome, coSuggestions, mockCoAttendanceSuggestions),
    [apiBackedHome, coSuggestions],
  )

  /** Co-attendance first, then nearby — matches "shared communities and geography" rail copy. */
  const displayPeopleSuggestions = useMemo(() => {
    const merge = (co: MockCoSuggestHome[], nearby: MockCoSuggestHome[]) => {
      const byId = new Map<string, MockCoSuggestHome>()
      for (const s of co) byId.set(s.userId, s)
      for (const s of nearby) {
        if (!byId.has(s.userId)) byId.set(s.userId, s)
      }
      return [...byId.values()]
    }
    if (useDemoFallback || !apiBackedHome) {
      return merge(mockCoAttendanceSuggestions(), mockNearbyPeopleSuggestions())
    }
    if (coSuggestions === null && nearbyPeople === null) return []
    return merge(coSuggestions ?? [], nearbyPeople ?? [])
  }, [apiBackedHome, useDemoFallback, coSuggestions, nearbyPeople])

  const displayConventions = useMemo(
    () => resolveApiOrMock(apiBackedHome, conventions, mockHomeConventions),
    [apiBackedHome, conventions],
  )

  const multiDayConventions = useMemo(() => {
    return displayConventions.filter((c) => {
      const hotel = c.kind === 'hotel_takeover'
      if (hotel) return true
      if (c.startsAt && c.endsAt && isMultiDayConventionSpan(c.startsAt, c.endsAt)) return true
      if (c.startsAt && c.endsAt) return false
      return true
    })
  }, [displayConventions])

  const displayVendorSpotlight = useMemo(
    () => resolveApiOrMock(apiBackedHome, vendorSpotlight, mockVendorSpotlightListings),
    [apiBackedHome, vendorSpotlight],
  )

  const displayVendorInPerson = useMemo(
    () => resolveApiOrMock(apiBackedHome, vendorInPerson, mockVendorInPersonRows),
    [apiBackedHome, vendorInPerson],
  )

  const displayTrendingItems = useMemo(() => {
    if (useDemoFallback) return mockTrendingMixedFeed()
    if (!trendingUsesApi) return mockTrendingMixedFeed()
    if (trendingLoadState === 'loading' || trendingItems === null) return []
    return trendingItems
  }, [useDemoFallback, trendingUsesApi, trendingLoadState, trendingItems])

  const [apiPresenterRail, setApiPresenterRail] = useState<
    { id: string; username: string; sceneName: string | null; location: string | null; trustScore: number }[]
  >([])

  useEffect(() => {
    if (!apiBackedHome) {
      setApiPresenterRail([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/presenters?limit=6', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as {
          items?: {
            userId: string
            username: string
            displayName: string | null
            headline: string | null
          }[]
        }
        if (cancelled) return
        setApiPresenterRail(
          (data.items ?? []).slice(0, 6).map((row) => ({
            id: row.userId,
            username: row.username,
            sceneName: row.displayName ?? row.headline,
            location: null,
            trustScore: 50,
          })),
        )
      } catch {
        if (!cancelled) setApiPresenterRail([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiBackedHome])

  const presenterRail = useMemo(
    () =>
      apiBackedHome ?
        apiPresenterRail
      : mockPeople.filter((p) => p.roles.some((r) => /educator|presenter/i.test(r))).slice(0, 6),
    [apiBackedHome, apiPresenterRail],
  )

  const groupDiscussionPeek = useMemo(() => (apiBackedHome ? [] : getPublicGroupDiscussionPeek(6)), [apiBackedHome])

  const homeJoinGroups = useMemo(() => {
    if (!apiBackedHome) return mockGroupsForHomeJoin().slice(0, 3)
    return rankedGroups.slice(0, 3)
  }, [apiBackedHome, rankedGroups])

  const vendorCarouselItems = useMemo(
    () => (apiBackedHome ? [] : mockVendorListingCarousel(postsRefreshKey)),
    [apiBackedHome, postsRefreshKey],
  )

  const upcomingClassesRail = useMemo(() => (apiBackedHome ? [] : mockUpcomingClassesRail()), [apiBackedHome])

  const homeEventsApiError = apiBackedHome && apiEvents.status === 'error'
  const homeEventsLoading = apiBackedHome && apiEvents.status === 'loading'
  const homeVendorsApiError = apiBackedHome && apiVendors.status === 'error'
  const homeVendorsLoading = apiBackedHome && apiVendors.status === 'loading'
  const homeGroupsApiError = apiBackedHome && apiGroups.status === 'error'
  const homeGroupsLoading = apiBackedHome && apiGroups.status === 'loading'
  const homeConventionsApiError = apiBackedHome && conventionsLoadState === 'error'
  const homeConventionsLoading = apiBackedHome && conventionsLoadState === 'loading'
  const homeTrendingLoading = trendingUsesApi && trendingLoadState === 'loading'
  const homeTrendingApiError = trendingUsesApi && trendingLoadState === 'error'

  const surfaceHeadline = useMemo((): HomeSurfaceHeadline => {
    if (useDemoFallback) {
      return {
        visible: true,
        text: 'Demo preview (VITE_HOME_DEMO_FALLBACK). Sample cards may appear while API sections load.',
        tone: 'demo',
      }
    }
    if (!isAuthenticated || isFallback) {
      return { visible: false, text: '', tone: 'muted' }
    }
    if (apiBackedHome && import.meta.env.VITE_SHOW_HOME_DEBUG === 'true') {
      return {
        visible: true,
        text: 'Live home. Empty sections mean the API returned no rows (not demo backfill).',
        tone: 'live',
      }
    }
    return {
      visible: true,
      text: 'Loading your home feed from the API…',
      tone: 'loading',
    }
  }, [apiBackedHome, isAuthenticated, isFallback, useDemoFallback])

  return {
    authStatus,
    isAuthenticated,
    isFallback,
    demoFallbackEnvEnabled,
    useDemoFallback,
    apiBackedHome,
    useDbComposer,
    apiEvents,
    apiVendors,
    apiGroups,
    nearbyPeople,
    myGroups,
    displayCoSuggestions,
    displayPeopleSuggestions,
    displayConventions,
    multiDayConventions,
    displayVendorSpotlight,
    displayVendorInPerson,
    displayTrendingItems,
    trendingLoadState,
    trendingUsesApi,
    homeTrendingLoading,
    homeTrendingApiError,
    rankedEvents,
    rankedPeople,
    rankedGroups,
    rankedVendorsHome,
    presenterRail,
    groupDiscussionPeek,
    homeJoinGroups,
    vendorCarouselItems,
    upcomingClassesRail,
    homeEventsApiError,
    homeEventsLoading,
    homeVendorsApiError,
    homeVendorsLoading,
    homeGroupsApiError,
    homeGroupsLoading,
    homeConventionsApiError,
    homeConventionsLoading,
    surfaceHeadline,
    reloadConventions,
  }
}

export type HomeSurfaceResult = ReturnType<typeof useHomeSurface>
