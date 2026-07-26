import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { isHomeFeedPresentation } from '@/lib/home-feed-layout'
import { shellFeedWideClass, shellWideClass } from '@/lib/shell-contract'
import { cn } from '@/lib/cn'
import EventCard from '@/components/cards/EventCard'
import ConventionCard from '@/components/cards/ConventionCard'
import PersonCard from '@/components/cards/PersonCard'
import VendorCard from '@/components/cards/VendorCard'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import GroupCard from '@/components/cards/GroupCard'
import EmptyState from '@/components/ui/EmptyState'
import { CardSkeleton, HomeEventGridSkeleton } from '@/components/ui/skeleton'
import TabShell, { TabShellButton } from '@/components/ui/TabShell'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import FollowingFeedTab from '@/app/home/FollowingFeedTab'
import HomeWelcomePanel from '@/components/home/HomeWelcomePanel'
import HomeFirstSessionDashboard from '@/components/home/HomeFirstSessionDashboard'
import LocalHomeFeed from '@/components/home/LocalHomeFeed'
import HomeDashboardLeftRail from '@/components/home/HomeDashboardLeftRail'
import HomeFeedScopeNav from '@/components/home/HomeFeedScopeNav'
import HomeSocialGuidance from '@/components/home/HomeSocialGuidance'
import HomeFeedDiscoverRail from '@/components/home/HomeFeedDiscoverRail'
import TrendingItemCard from '@/components/home/TrendingItemCard'
import VendorListingMiniCard from '@/components/home/VendorListingMiniCard'
import AutoScrollRow from '@/components/home/AutoScrollRow'
import {
  mockGroups,
  mockGroupChannels,
  getMockLocalPostsVisible,
  editMockLocalPost,
  deleteMockLocalPost,
  mockRichLocalFeedPosts,
} from '@/data/mock-data'
import { presentHomeFeedPosts } from '@/lib/following-feed-demo'
import { useAuth, useViewerUsername } from '@/contexts/AuthContext'
import { useHomeSocialGuidancePrefs } from '@/hooks/useHomeSocialGuidancePrefs'
import { useHomeSurface } from '@/hooks/useHomeSurface'
import { useApiEducationArticles } from '@/hooks/useApiEducationArticles'
import { useApiMediaShows } from '@/hooks/useApiMediaShows'
import { apiPostToHomeFeedPost, mockLocalPostToHome } from '@/lib/feed-mapper'
import type { HomeFeedPost } from '@/lib/feed-types'
import { HOME_TABS, HOME_TAB_LABELS, normalizeHomeTab, type HomeTab } from '@/lib/community-nav'
import { isStandaloneDirectoryTab, standaloneDirectoryHref } from '@/lib/home-directory-tabs'
import { isOnboardingComplete } from '@c2k/shared'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'

const HOME_MODES = ['Following', 'Discover'] as const
type HomeMode = (typeof HOME_MODES)[number]

function normalizeHomeMode(raw: string | null): HomeMode | null {
  if (!raw) return null
  if (raw.toLowerCase() === 'following') return 'Following'
  if (raw.toLowerCase() === 'discover') return 'Discover'
  return null
}

function groupIdForChannel(channelId: string): string {
  return mockGroupChannels.find((c) => c.id === channelId)?.groupId ?? mockGroups[0]?.id ?? 'g1'
}

function formatEducationReadMinutes(readingMinutes: number | null | undefined): string {
  if (readingMinutes == null || readingMinutes < 1) return ''
  return `${readingMinutes} min read`
}

const HOME_DISCOVER_TAB_BLURB: Partial<Record<HomeTab, string>> = {
  Events: 'Events that can turn online connections into real-world community.',
  Conventions: 'Multi-day gatherings and conference-style events in the community.',
  Groups: 'Groups to start finding your people and ongoing conversations.',
  Vendors: 'Vendors your community may want to know.',
  Education: 'Guides and perspectives from community educators and writers.',
  Media: 'Podcasts, shows, and channels from community creators.',
  Trending: 'Explore posts, events, and conversations across the network.',
}

export default function HomePageClient() {
  const navigate = useNavigate()
  const location = useLocation()
  const viewerUsername = useViewerUsername()
  const { isAuthenticated, isFallback } = useAuth()
  const socialGuidance = useHomeSocialGuidancePrefs(viewerUsername)
  const { feed: memberFeed } = useOnboardingState(isAuthenticated && !isFallback)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const modeParam = searchParams.get('mode')

  useEffect(() => {
    if (tabParam?.toLowerCase() === 'people') {
      const p = new URLSearchParams(searchParams)
      p.delete('tab')
      p.delete('mode')
      const rest = p.toString()
      navigate(rest ? `${PEOPLE_DIRECTORY_PATH}?${rest}` : PEOPLE_DIRECTORY_PATH, { replace: true })
    }
  }, [tabParam, searchParams, navigate])

  const [activeTab, setActiveTab] = useState<HomeTab>(normalizeHomeTab(tabParam) ?? HOME_TABS[0])
  const [homeMode, setHomeMode] = useState<HomeMode>(normalizeHomeMode(modeParam) ?? 'Discover')
  const [homeModeResolved, setHomeModeResolved] = useState(Boolean(normalizeHomeMode(modeParam)))
  const [postsRefreshKey, setPostsRefreshKey] = useState(0)

  const returningMember =
    isAuthenticated && !isFallback && isOnboardingComplete(memberFeed) && homeMode !== 'Discover'

  const conventionsTabActive = activeTab === 'Events' || activeTab === 'Conventions' || activeTab === 'Trending'

  const surface = useHomeSurface({
    activeTab,
    postsRefreshKey,
    conventionsTabActive,
  })

  const {
    apiBackedHome,
    useDemoFallback,
    useDbComposer,
    apiEvents,
    apiVendors,
    apiGroups,
    displayPeopleSuggestions,
    myGroups,
    displayConventions,
    multiDayConventions,
    displayVendorSpotlight,
    displayVendorInPerson,
    displayTrendingItems,
    homeTrendingLoading,
    homeTrendingApiError,
    rankedEvents,
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
  } = surface

  const eduCategory = searchParams.get('category') ?? ''
  const eduContent = searchParams.get('content') ?? ''

  const [apiFeedPosts, setApiFeedPosts] = useState<HomeFeedPost[] | null>(null)
  const [apiFeedOk, setApiFeedOk] = useState(false)
  const [apiFeedSettled, setApiFeedSettled] = useState(false)
  const [apiFeedError, setApiFeedError] = useState<string | null>(null)

  useEffect(() => {
    const n = normalizeHomeTab(tabParam)
    if (n && isStandaloneDirectoryTab(n)) {
      navigate(standaloneDirectoryHref(n), { replace: true })
      return
    }
    if (n) setActiveTab(n)
    if (n === 'Local' && normalizeHomeMode(modeParam) !== 'Discover') {
      setHomeMode('Discover')
      const p = new URLSearchParams(searchParams)
      p.set('mode', 'discover')
      p.set('tab', 'Local')
      setSearchParams(p, { replace: true })
    }
  }, [tabParam, modeParam, navigate, searchParams, setSearchParams])

  useEffect(() => {
    const m = normalizeHomeMode(modeParam)
    if (m) {
      setHomeMode(m)
      setHomeModeResolved(true)
    }
  }, [modeParam])

  useEffect(() => {
    if (!apiBackedHome || homeModeResolved) return
    let cancelled = false
    void (async () => {
      try {
        const [feedRes, settingsRes] = await Promise.all([
          fetch('/api/v1/feed/home?limit=1', { credentials: 'include' }),
          fetch('/api/settings/me', { credentials: 'include' }),
        ])
        if (cancelled) return
        let nextMode: HomeMode = 'Discover'
        if (settingsRes.ok) {
          const settings = (await settingsRes.json()) as { feed?: { homeMode?: string } }
          if (settings.feed?.homeMode === 'following') nextMode = 'Following'
          else if (settings.feed?.homeMode === 'discover') nextMode = 'Discover'
          else if (feedRes.ok) {
            const data = (await feedRes.json()) as { connectionCount?: number }
            if ((data.connectionCount ?? 0) >= 1) nextMode = 'Following'
          }
        } else if (feedRes.ok) {
          const data = (await feedRes.json()) as { connectionCount?: number }
          if ((data.connectionCount ?? 0) >= 1) nextMode = 'Following'
        }
        setHomeMode(nextMode)
        setHomeModeResolved(true)
      } catch {
        if (!cancelled) setHomeModeResolved(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiBackedHome, homeModeResolved])

  useEffect(() => {
    if (!homeModeResolved || homeMode !== 'Following') return
    if (normalizeHomeMode(modeParam) === 'Following') return
    const p = new URLSearchParams(searchParams)
    p.set('mode', 'following')
    setSearchParams(p, { replace: true })
  }, [homeMode, homeModeResolved, modeParam, searchParams, setSearchParams])

  const selectTab = useCallback(
    (tab: HomeTab) => {
      if (isStandaloneDirectoryTab(tab)) {
        navigate(standaloneDirectoryHref(tab))
        return
      }
      setActiveTab(tab)
      const p = new URLSearchParams(searchParams)
      p.set('tab', tab)
      p.set('mode', 'discover')
      setSearchParams(p, { replace: true })
      setHomeMode('Discover')
    },
    [navigate, searchParams, setSearchParams],
  )

  const setEduFilters = useCallback(
    (next: { category?: string; content?: string }) => {
      const p = new URLSearchParams(searchParams)
      p.set('tab', 'Education')
      if (next.category !== undefined) {
        if (next.category) p.set('category', next.category)
        else p.delete('category')
      }
      if (next.content !== undefined) {
        if (next.content) p.set('content', next.content)
        else p.delete('content')
      }
      setSearchParams(p, { replace: true })
      setActiveTab('Education')
    },
    [searchParams, setSearchParams]
  )

  const refreshApiFeed = useCallback(async () => {
    if (!isAuthenticated || isFallback) {
      setApiFeedPosts(null)
      setApiFeedOk(false)
      setApiFeedSettled(true)
      return
    }
    setApiFeedSettled(false)
    setApiFeedError(null)
    try {
      const r = await fetch('/api/v1/feed', { credentials: 'include' })
      if (r.status === 503) {
        setApiFeedOk(false)
        setApiFeedPosts(null)
        setApiFeedError('Your feed is temporarily unavailable. Try again in a moment.')
        setApiFeedSettled(true)
        return
      }
      if (!r.ok) {
        setApiFeedOk(false)
        setApiFeedPosts(null)
        setApiFeedError(
          r.status === 401
            ? 'Your session expired. Sign out and sign in again.'
            : 'Could not load your feed. Check your connection and try again.',
        )
        setApiFeedSettled(true)
        return
      }
      const data = (await r.json()) as { items?: unknown[] }
      const items = (data.items ?? []).map((row) => apiPostToHomeFeedPost(row as Parameters<typeof apiPostToHomeFeedPost>[0]))
      setApiFeedPosts(items)
      setApiFeedOk(true)
      setApiFeedSettled(true)
    } catch {
      setApiFeedOk(false)
      setApiFeedPosts(null)
      setApiFeedError('Could not load your feed.')
      setApiFeedSettled(true)
    }
  }, [isAuthenticated, isFallback])

  useEffect(() => {
    void refreshApiFeed()
  }, [refreshApiFeed, postsRefreshKey])

  const localPostsMock = useMemo(() => {
    void postsRefreshKey
    return getMockLocalPostsVisible().map(mockLocalPostToHome)
  }, [postsRefreshKey])

  const localFeedPosts = useMemo(() => {
    if (!isAuthenticated || isFallback) {
      if (useDemoFallback) return [...mockRichLocalFeedPosts(), ...localPostsMock]
      return []
    }
    if (!apiFeedSettled) return []
    if (apiFeedOk) return presentHomeFeedPosts(apiFeedPosts ?? [])
    return []
  }, [apiFeedOk, apiFeedPosts, apiFeedSettled, useDemoFallback, isAuthenticated, isFallback, localPostsMock])

  const handleRepost = useCallback(
    async (originalPostId: string) => {
      if (!isAuthenticated || isFallback) return
      try {
        const r = await fetch(`/api/v1/feed/posts/${encodeURIComponent(originalPostId)}/repost`, {
          method: 'POST',
          credentials: 'include',
        })
        if (r.ok) setPostsRefreshKey((k) => k + 1)
      } catch {
        /* ignore */
      }
    },
    [isAuthenticated, isFallback]
  )

  const eduArticlesApi = useApiEducationArticles({ limit: 48, enabled: true })
  const rankedArticles = eduArticlesApi.items

  const educationArticlesFiltered = useMemo(() => {
    return rankedArticles.filter((a) => {
      if (
        eduCategory &&
        !(a.categories ?? []).some((c) => c.toLowerCase() === eduCategory.toLowerCase())
      ) {
        return false
      }
      const mediaOnlyTab = eduContent === 'video' || eduContent === 'presentation'
      if (mediaOnlyTab) return false
      return true
    })
  }, [rankedArticles, eduCategory, eduContent])

  const educationCategoryChips = useMemo(() => {
    const set = new Map<string, string>()
    for (const row of rankedArticles) {
      for (const cat of row.categories ?? []) {
        const key = cat.toLowerCase()
        if (!set.has(key)) set.set(key, cat)
      }
    }
    return [...set.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([, original]) => original)
  }, [rankedArticles])

  const headlineToneClass =
    surfaceHeadline.tone === 'demo' ? 'text-dc-warning'
    : surfaceHeadline.tone === 'live' ? 'text-dc-muted'
    : 'text-dc-muted'

  const sidebarReputationTips = (
    <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <h3 className="text-sm font-semibold text-dc-text mb-2">Reputation tips</h3>
      <p className="text-xs text-dc-muted">
        Attend events and get checked in to build your Event Reliability score. Endorsements from trusted members boost your visibility.
      </p>
    </div>
  )

  const sidebarSuggestedCo = (
    <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <h3 className="text-sm font-semibold text-dc-text mb-3">People you may meet soon</h3>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {displayPeopleSuggestions.map((p) => (
          <PersonCard
            key={p.userId}
            person={{
              id: p.userId,
              username: p.username,
              sceneName: p.displayName,
              age: p.age ?? undefined,
              location: p.location ?? undefined,
              avatarUrl: p.avatarUrl ?? undefined,
              verified: p.verified,
              lastActiveAt: p.lastActiveAt ?? undefined,
              sharedEventsCount: p.sharedCount ?? 0,
            }}
          />
        ))}
      </div>
    </div>
  )

  const sidebarEventsConventions = displayConventions.length > 0 && (
    <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <h3 className="text-sm font-semibold text-dc-text mb-1">Conventions in your region</h3>
      <Link to="/events" className="text-xs text-dc-accent hover:underline mb-3 inline-block">
        See all nationwide →
      </Link>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {displayConventions.slice(0, 6).map((c) => (
          <li key={c.id}>
            <Link to={`/conventions/${encodeURIComponent(c.slug)}`} className="block text-sm text-dc-text-muted hover:text-dc-text">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  const sidebarEventsEducation = (
    <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <h3 className="text-sm font-semibold text-dc-text mb-3">Educational opportunities</h3>
      <ul className="space-y-2">
        {rankedArticles.slice(0, 4).map((a) => (
          <li key={a.id}>
            <Link to={`/education/${a.slug}`} className="block text-sm text-dc-text-muted hover:text-dc-text">
              <span className="text-dc-accent">Read</span> · {a.title}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/education" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
        Browse all education →
      </Link>
    </div>
  )

  const sidebarGroups = (
    <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)] space-y-6">
      {groupDiscussionPeek.length > 0 ?
        <div>
          <h3 className="text-sm font-semibold text-dc-text mb-3">Recent group discussions</h3>
          <ul className="space-y-3 max-h-72 overflow-y-auto">
            {groupDiscussionPeek.map(({ gp, groupName }) => (
              <li key={gp.id}>
                <Link to={`/groups/${encodeURIComponent(groupIdForChannel(gp.channelId))}`} className="block text-sm">
                  <span className="text-dc-muted text-xs">{groupName}</span>
                  <span className="block font-medium text-dc-text hover:text-dc-accent">{gp.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      : null}
      <div className="border-t border-dc-border pt-6">
        <h3 className="text-sm font-semibold text-dc-text mb-2">Groups to start finding your people</h3>
        <p className="text-xs text-dc-muted mb-3">
          Join a group to find ongoing conversations and people who share your interests.
        </p>
        <div className="space-y-2">
          {homeJoinGroups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
          {apiBackedHome && homeJoinGroups.length === 0 ?
            <p className="text-xs text-dc-muted">
              <Link to="/groups" className="text-dc-accent hover:underline">
                Browse groups
              </Link>{' '}
              to find communities to join.
            </p>
          : null}
        </div>
      </div>
    </div>
  )

  const sidebarVendors = (
    <>
      <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text mb-3">Visit in person</h3>
        <ul className="space-y-2 text-sm">
          {displayVendorInPerson.slice(0, 6).map((row) => (
            <li key={`${row.vendorId}-${row.eventId}`}>
              <Link to={`/vendors/${row.slug}`} className="text-dc-text-muted hover:text-dc-text">
                {row.displayName}
              </Link>
              <span className="text-dc-muted"> · </span>
              <Link to={`/events/${row.eventId}`} className="text-dc-accent hover:underline">
                {row.eventTitle}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {vendorCarouselItems.length > 0 ?
        <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
          <h3 className="text-sm font-semibold text-dc-text mb-3">Vendors your community may want to know</h3>
          <p className="text-xs text-dc-muted mb-2">One listing per shop. Refreshes as you interact with the feed.</p>
          <AutoScrollRow aria-label="Suggested vendor picks">
            {vendorCarouselItems.map((v) => (
              <VendorListingMiniCard
                key={`${v.vendorId}-${v.listingTitle}`}
                className="w-[148px] shrink-0 snap-start sm:w-[156px]"
                vendorSlug={v.vendorSlug}
                shopName={v.shopName}
                listingTitle={v.listingTitle}
                listingImageUrl={v.listingImageUrl}
                logoUrl={v.logoUrl}
              />
            ))}
          </AutoScrollRow>
        </div>
      : null}
      <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text mb-3">Spotlight listings</h3>
        <AutoScrollRow aria-label="Spotlight vendor listings">
          {displayVendorSpotlight.map((v) => (
            <VendorListingMiniCard
              key={v.vendorId}
              className="w-[148px] shrink-0 snap-start sm:w-[156px]"
              vendorSlug={v.vendorSlug}
              shopName={v.shopName}
              listingTitle={v.listingTitle}
              listingImageUrl={v.listingImageUrl}
              logoUrl={v.logoUrl}
            />
          ))}
        </AutoScrollRow>
      </div>
    </>
  )

  const sidebarEducation = (
    <>
      <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text mb-3">Recent articles</h3>
        <ul className="space-y-2">
          {rankedArticles.slice(0, 5).map((a) => (
            <li key={a.id}>
              <Link to={`/education/${a.slug}`} className="text-sm text-dc-text-muted hover:text-dc-text">
                {a.title}
              </Link>
              <span className="block text-xs text-dc-muted">{formatEducationReadMinutes(a.readingMinutes)}</span>
            </li>
          ))}
        </ul>
      </div>
      {presenterRail.length > 0 || !apiBackedHome ?
        <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
          <h3 className="text-sm font-semibold text-dc-text mb-3">Educators & presenters</h3>
          {presenterRail.length > 0 ?
            <div className="space-y-2">
              {presenterRail.map((p) => (
                <PersonCard key={String(p.id ?? p.username)} person={p} />
              ))}
            </div>
          : null}
          <Link to="/presenters" className="mt-2 inline-block text-xs text-dc-accent hover:underline">
            Presenter directory →
          </Link>
        </div>
      : null}
      {upcomingClassesRail.length > 0 ?
        <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
          <h3 className="text-sm font-semibold text-dc-text mb-3">Upcoming classes</h3>
          <ul className="space-y-2">
            {upcomingClassesRail.map((row) => (
              <li key={row.id}>
                <Link to={row.href} className="text-sm text-dc-text-muted hover:text-dc-text">
                  {row.title}
                </Link>
                <span className="mt-0.5 block text-xs text-dc-muted">{row.formatLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      : null}
      {sidebarReputationTips}
    </>
  )

  const sidebarTrending = (
    <>
      <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text mb-2">How Trending works</h3>
        <p className="text-xs text-dc-muted">
          Ranked by recent activity and engagement. Collars, boosts, RSVPs, and freshness with 48-hour decay. Feed posts,
          events, education, groups, and vendors can all appear here.
        </p>
      </div>
      {sidebarEventsConventions}
      {sidebarEventsEducation}
    </>
  )

  const sidebarConventionsTab = (
    <>
      <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text mb-2">Multi-day gatherings</h3>
        <p className="text-xs text-dc-muted">
          Conventions and hotel takeovers use the same calendar model as other events: one anchor event, optional full program on the convention page.
        </p>
        <Link to="/events" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          Browse all events →
        </Link>
      </div>
      {sidebarEventsEducation}
    </>
  )

  const rightRail = (() => {
    if (activeTab === 'Local') {
      return <>{sidebarSuggestedCo}</>
    }
    if (activeTab === 'Events') {
      return (
        <>
          {sidebarEventsConventions}
          {sidebarEventsEducation}
        </>
      )
    }
    if (activeTab === 'Groups') return <>{sidebarGroups}</>
    if (activeTab === 'Vendors') return <>{sidebarVendors}</>
    if (activeTab === 'Education') return <>{sidebarEducation}</>
    if (activeTab === 'Media') {
      return (
        <div className="bg-dc-elevated-solid rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
          <h3 className="text-sm font-semibold text-dc-text mb-2">Media directory</h3>
          <p className="text-xs text-dc-muted mb-3">Podcasts and video channels. Link-out only.</p>
          <Link to="/media" className="text-sm text-dc-accent hover:underline">
            Open full Media hub →
          </Link>
        </div>
      )
    }
    if (activeTab === 'Trending') return <>{sidebarTrending}</>
    if (activeTab === 'Conventions') return <>{sidebarConventionsTab}</>
    return null
  })()

  const showDiscoverContent = !(apiBackedHome && homeMode === 'Following')
  const showFeedShell = isHomeFeedPresentation(location.pathname, location.search)
  const showFeedThreeColumn =
    showFeedShell && (homeMode === 'Following' || (showDiscoverContent && activeTab === 'Local'))
  const mediaShowsApi = useApiMediaShows({
    limit: 12,
    enabled: showDiscoverContent && activeTab === 'Media',
  })

  const anchorEventById = useMemo(
    () => new Map(rankedEvents.map((e) => [String(e.id), e])),
    [rankedEvents],
  )

  const showDevHeadline =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_HOME_DEBUG === 'true' && surfaceHeadline.visible

  const sparseLocalFeed = apiFeedSettled && localFeedPosts.length <= 2
  const showSocialGuidance =
    isAuthenticated &&
    !isFallback &&
    showFeedThreeColumn &&
    socialGuidance.visible &&
    (!returningMember || sparseLocalFeed)

  const discoverTabBlurb = HOME_DISCOVER_TAB_BLURB[activeTab] ?? null

  const discoverRailProps = useMemo(
    () => ({
      suggestions: displayPeopleSuggestions.map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        subtitle:
          p.sharedCount && p.sharedCount > 0 ?
            `${p.sharedCount} mutual event${p.sharedCount === 1 ? '' : 's'}`
          : (p.location ?? undefined),
        avatarUrl: p.avatarUrl ?? undefined,
      })),
      upcomingNearYou: rankedEvents.slice(0, 4).map((e) => ({
        id: String(e.id),
        title: e.title,
        href: `/events/${e.id}`,
        meta: [e.date, e.location].filter(Boolean).join(' · ') || undefined,
      })),
      trendingEvents: displayTrendingItems.slice(0, 3).map((item) => ({
        id: `${item.kind}-${item.id}`,
        title: item.title,
        href: item.href,
        mentions: item.subtitle,
      })),
      myGroups: (myGroups ?? []).slice(0, 6).map((g) => ({
        id: g.id,
        name: g.name,
        href: g.slug ? `/groups/${encodeURIComponent(g.slug)}` : `/groups/${encodeURIComponent(g.id)}`,
      })),
    }),
    [displayPeopleSuggestions, rankedEvents, displayTrendingItems, myGroups],
  )

  return (
    <div
      className={cn(showFeedThreeColumn ? shellFeedWideClass : shellWideClass, 'py-4 sm:py-6 md:py-6 lg:pt-7')}
    >
      {showDevHeadline && !showFeedThreeColumn ?
        <p className={`mb-2 text-xs font-medium leading-snug ${headlineToneClass}`} role="status">
          {surfaceHeadline.text}
        </p>
      : null}

      {!showFeedThreeColumn ?
        <>
          {!(isAuthenticated && !isFallback && homeMode === 'Discover') && !returningMember ?
            <HomeWelcomePanel className="mb-4" dashboard={isAuthenticated && !isFallback} />
          : null}
          {isAuthenticated && !isFallback && homeMode === 'Discover' ?
            <HomeFirstSessionDashboard
              className="mb-4"
              events={rankedEvents.slice(0, 4).map((e) => ({
                id: String(e.id),
                title: e.title,
                startsAt: e.startsAt ?? null,
                locationLabel: e.location ?? null,
              }))}
              groups={(apiGroups.items ?? []).slice(0, 4).map((g) => ({
                id: String(g.id),
                name: g.name,
                slug: g.slug,
              }))}
            />
          : null}
        </>
      : null}

      {!apiBackedHome && !showFeedThreeColumn ?
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TabShell className="w-full max-w-full overflow-x-auto sm:w-auto" aria-label="Home">
            {HOME_TABS.map((tab) => (
              <TabShellButton key={tab} selected={activeTab === tab} onClick={() => selectTab(tab)}>
                {HOME_TAB_LABELS[tab]}
              </TabShellButton>
            ))}
          </TabShell>
          <Link
            to={PEOPLE_DIRECTORY_PATH}
            className="shrink-0 text-sm font-medium text-dc-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent rounded"
          >
            Search people
          </Link>
        </div>
      : null}

      <div
        className={
          showFeedThreeColumn ?
            'mt-2 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,244px)_minmax(0,1fr)_minmax(272px,312px)] lg:items-start lg:gap-x-6 lg:gap-y-5 xl:grid-cols-[minmax(244px,264px)_minmax(0,1fr)_minmax(320px,360px)] xl:gap-x-8'
          : 'mt-4 flex flex-col gap-8 lg:flex-row'
        }
      >
        {showFeedThreeColumn ?
          <div className="hidden lg:block">
            <HomeDashboardLeftRail omitHomeLink />
          </div>
        : null}

        <div
          className={
            showFeedThreeColumn ?
              'flex min-w-0 flex-col gap-4 lg:gap-5'
            : 'min-w-0 w-full flex-1 mx-auto'
          }
        >
        <main
          className={
            showFeedThreeColumn ?
              'dc-feed-well mx-auto w-full max-w-[780px] xl:max-w-[840px]'
            : `min-w-0 w-full ${
                homeMode === 'Following' || activeTab === 'Local' ? 'max-w-2xl lg:max-w-3xl'
                : 'max-w-6xl'
              }`
          }
        >
          {showFeedThreeColumn ?
            <div className="mb-4 hidden lg:block">
              <HomeFeedScopeNav />
            </div>
          : null}
          {showSocialGuidance ?
            <HomeSocialGuidance className="mb-3" onDismiss={socialGuidance.dismiss} />
          : null}
          {apiBackedHome && homeMode === 'Following' ?
            <>
              <FollowingFeedTab
                feedShell={showFeedThreeColumn}
                onRepost={handleRepost}
                onPosted={() => {
                  setPostsRefreshKey((k) => k + 1)
                  void refreshApiFeed()
                }}
              />
            </>
          : null}
          <TabContentTransition tabKey={`${homeMode}-${activeTab}`}>
          {showDiscoverContent && activeTab !== 'Local' ?
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-dc-text">{HOME_TAB_LABELS[activeTab]}</h2>
              {discoverTabBlurb ?
                <p className="mt-1 hidden text-sm text-dc-text-muted lg:block">{discoverTabBlurb}</p>
              : null}
            </div>
          : null}
          {showDiscoverContent && activeTab === 'Local' && (
            <>
              <LocalHomeFeed
                viewerUsername={viewerUsername}
                isAuthenticated={isAuthenticated}
                isFallback={isFallback}
                useDbComposer={useDbComposer}
                apiFeedSettled={apiFeedSettled}
                apiFeedOk={apiFeedOk}
                apiFeedError={apiFeedError}
                localFeedPosts={localFeedPosts}
                onPosted={() => {
                  setPostsRefreshKey((k) => k + 1)
                  void refreshApiFeed()
                }}
                onRefreshFeed={() => void refreshApiFeed()}
                onRepost={handleRepost}
                onEditMock={(postId, text) => {
                  editMockLocalPost(postId, text)
                  setPostsRefreshKey((k) => k + 1)
                }}
                onDeleteMock={(postId) => {
                  deleteMockLocalPost(postId)
                  setPostsRefreshKey((k) => k + 1)
                }}
                rankedEvents={rankedEvents}
                homeEventsLoading={homeEventsLoading}
                homeEventsApiError={homeEventsApiError}
                onRetryEvents={apiEvents.reload}
                showConventionPins={false}
                feedShell={showFeedThreeColumn}
                compactComposer={returningMember}
              />
            </>
          )}

          {showDiscoverContent && activeTab === 'Events' &&
            (homeEventsLoading ?
              <HomeEventGridSkeleton count={6} />
            : homeEventsApiError ?
              <EmptyState
                inline
                className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                title="Could not load events"
                message="The events feed did not load. Check your connection and try again."
                actionLabel="Retry"
                onAction={apiEvents.reload}
                secondaryCtaLabel="Events directory"
                secondaryCtaHref="/events"
              />
            : rankedEvents.length === 0 ?
              <EmptyState
                inline
                message="No events from the API yet."
                ctaLabel="Events directory"
                ctaHref="/events"
                secondaryCtaLabel="Discovery"
                secondaryCtaHref="/explore"
              />
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:min-w-0">
                {rankedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>)}

          {showDiscoverContent && activeTab === 'Conventions' && (
            <div>
              <p className="text-sm text-dc-muted mb-6 max-w-2xl">
                Multi-day conventions and hotel takeovers. Full schedules live on each convention page when a program is published.
              </p>
              {homeConventionsLoading ?
                <CardSkeleton count={3} />
              : homeConventionsApiError ?
                <EmptyState
                  inline
                  className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                  title="Could not load conventions"
                  message="The conventions feed did not load. Check your connection and try again."
                  actionLabel="Retry"
                  onAction={reloadConventions}
                  secondaryCtaLabel="Browse events"
                  secondaryCtaHref="/events"
                />
              : multiDayConventions.length === 0 ?
                <EmptyState
                  inline
                  className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                  title="No conventions yet"
                  message="Multi-day conventions and hotel takeovers will appear here when published. Browse events or Discovery in the meantime."
                  ctaLabel="Browse events"
                  ctaHref="/events"
                  secondaryCtaLabel="Discovery"
                  secondaryCtaHref="/explore"
                />
              : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                  {multiDayConventions.map((c) => (
                    <ConventionCard
                      key={c.id}
                      convention={c}
                      anchorEvent={
                        c.anchorEventId ? anchorEventById.get(String(c.anchorEventId)) : undefined
                      }
                    />
                  ))}
                </div>
              }
            </div>
          )}

          {showDiscoverContent && activeTab === 'Groups' &&
            (homeGroupsLoading ?
              <CardSkeleton count={3} />
            : homeGroupsApiError ?
              <EmptyState
                inline
                className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                title="Could not load groups"
                message="The groups feed did not load. Check your connection and try again."
                actionLabel="Retry"
                onAction={apiGroups.reload}
                secondaryCtaLabel="Browse groups"
                secondaryCtaHref="/groups"
              />
            : rankedGroups.length === 0 ?
              <EmptyState
                inline
                message="No groups from the API yet."
                ctaLabel="Browse groups"
                ctaHref="/groups"
              />
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:min-w-0">
                {rankedGroups.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>)}

          {showDiscoverContent && activeTab === 'Vendors' &&
            (homeVendorsLoading ?
              <CardSkeleton count={4} />
            : homeVendorsApiError ?
              <EmptyState
                inline
                className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                title="Could not load vendors"
                message="The vendor feed did not load. Check your connection and try again."
                actionLabel="Retry"
                onAction={apiVendors.reload}
                secondaryCtaLabel="Vendor marketplace"
                secondaryCtaHref="/vendors"
              />
            : rankedVendorsHome.length === 0 ?
              <EmptyState
                inline
                message="No vendors from the API yet."
                ctaLabel="Vendor marketplace"
                ctaHref="/vendors"
                secondaryCtaLabel="Discovery"
                secondaryCtaHref="/explore"
              />
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 [&>*]:min-w-0">
                {rankedVendorsHome.map((v) => (
                  <VendorCard key={v.id} vendor={v} />
                ))}
              </div>)}

          {showDiscoverContent && activeTab === 'Education' && (
            <>
              {eduArticlesApi.error ?
                <EmptyState
                  inline
                  className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                  title="Could not load education"
                  message={eduArticlesApi.error}
                  actionLabel="Retry"
                  onAction={() => eduArticlesApi.reload()}
                  secondaryCtaLabel="Education hub"
                  secondaryCtaHref="/education"
                />
              : eduArticlesApi.status === 'loading' || eduArticlesApi.status === 'idle' ?
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" role="status">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="dc-skeleton-bone h-52 rounded-2xl" />
                  ))}
                </div>
              : <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEduFilters({ category: '', content: '' })}
                      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                        !eduCategory && !eduContent
                          ? 'bg-dc-accent text-dc-accent-foreground'
                          : 'border border-dc-border text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                      }`}
                    >
                      All
                    </button>
                    {educationCategoryChips.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEduFilters({ category: cat })}
                        className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                          eduCategory.toLowerCase() === cat.toLowerCase()
                            ? 'bg-dc-accent text-dc-accent-foreground'
                            : 'border border-dc-border text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEduFilters({ content: 'article' })}
                      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                        eduContent === 'article'
                          ? 'bg-dc-accent text-dc-accent-foreground'
                          : 'border border-dc-border text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                      }`}
                    >
                      Articles
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/media?format=video')}
                      className="rounded-full border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
                    >
                      Video channels
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/media?format=hybrid')}
                      className="rounded-full border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
                    >
                      Podcast + video
                    </button>
                  </div>
                  {educationArticlesFiltered.length === 0 ?
                    <EmptyState
                      inline
                      className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                      title="Nothing here yet"
                      message="No education articles matched these filters yet. Try resetting filters or open the hub for the full catalogue."
                      ctaLabel="Open Education hub"
                      ctaHref="/education"
                      actionLabel={
                        eduCategory || eduContent
                          ? `Clear filters (${[eduCategory, eduContent].filter(Boolean).join(' · ')})`
                          : undefined
                      }
                      onAction={
                        eduCategory || eduContent ? () => setEduFilters({ category: '', content: '' }) : undefined
                      }
                    />
                  : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                      {educationArticlesFiltered.map((a) => (
                        <EducationArticleCard key={a.id} article={a} />
                      ))}
                    </div>
                  }
                </>
              }
            </>
          )}

          {showDiscoverContent && activeTab === 'Media' && (
            <>
              {mediaShowsApi.error ?
                <EmptyState
                  inline
                  title="Could not load media"
                  message={mediaShowsApi.error}
                  actionLabel="Retry"
                  onAction={() => mediaShowsApi.reload()}
                  secondaryCtaLabel="Media hub"
                  secondaryCtaHref="/media"
                />
              : mediaShowsApi.status === 'loading' || mediaShowsApi.status === 'idle' ?
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="dc-skeleton-bone h-44 rounded-2xl" />
                  ))}
                </div>
              : mediaShowsApi.items.length === 0 ?
                <EmptyState
                  inline
                  ctaLabel="Open Media hub"
                  ctaHref="/media"
                  message="No channels listed yet."
                  title="Nothing here yet"
                />
              : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                  {mediaShowsApi.items.map((show) => (
                    <MediaChannelCard key={show.id} show={show} layout="compact" />
                  ))}
                </div>
              }
              <p className="mt-4 text-sm">
                <Link to="/media" className="text-dc-accent hover:underline">
                  Browse all media channels →
                </Link>
              </p>
            </>
          )}

          {showDiscoverContent && activeTab === 'Trending' &&
            (homeTrendingLoading ?
              <HomeEventGridSkeleton count={3} />
            : homeTrendingApiError ?
              <EmptyState
                inline
                className="rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
                title="Trending unavailable"
                message="We could not load trending right now. Try again in a moment or browse Discovery."
                ctaLabel="Browse Discovery"
                ctaHref="/explore"
              />
            : displayTrendingItems.length === 0 ?
              <EmptyState
                inline
                title="Nothing trending yet"
                message="Check back as the community posts, RSVPs, and publishes education."
                ctaLabel="Browse Discovery"
                ctaHref="/explore"
              />
            : <div className="space-y-3 sm:space-y-4">
                {displayTrendingItems.map((item) => (
                  <TrendingItemCard key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </div>)}
          </TabContentTransition>
        </main>

        {showFeedThreeColumn ?
          <HomeFeedDiscoverRail
            {...discoverRailProps}
            variant="mobile-supplement"
            className="mx-auto w-full max-w-[780px] lg:hidden"
          />
        : null}
        </div>

        {showFeedThreeColumn ?
          <div className="hidden lg:block">
            <HomeFeedDiscoverRail {...discoverRailProps} variant="desktop" />
          </div>
        : <aside className="hidden w-72 flex-shrink-0 space-y-4 lg:block">{rightRail}</aside>}
      </div>
    </div>
  )
}
