import { useCallback, useEffect, useId, useMemo, useState } from 'react'

import { useSearchParams } from 'react-router-dom'

import EducationDiscoverShell from '@/components/education/EducationDiscoverShell'

import EducationDiscoverCenter, { buildStripSectionsFromApi } from '@/components/education/EducationDiscoverCenter'

import {
  EducationLibraryPanel,
  EducationPodcastsPanel,
  EducationVideosPanel,
} from '@/components/education/EducationHubTabPanels'
import EducationProgressPanel from '@/components/education/EducationProgressPanel'

import EducationLeftRail from '@/components/education/EducationLeftRail'

import EducationPathsPage from '@/components/education/EducationPathsPage'

import EducationRightRail from '@/components/education/EducationRightRail'

import EducationSectionHeader from '@/components/education/EducationSectionHeader'

import DirectoryTemplate from '@/components/templates/DirectoryTemplate'

import { useAuth } from '@/contexts/AuthContext'

import { BOOKMARK_OBJECT_EDUCATION_ARTICLE, useApiBookmarks } from '@/hooks/useApiBookmarks'

import { useApiEducationArticles } from '@/hooks/useApiEducationArticles'

import { useApiEducationHubSeries } from '@/hooks/useApiEducationSeries'

import { useApiMediaShows } from '@/hooks/useApiMediaShows'

import { useApiPresenters } from '@/hooks/useApiPresenters'

import {

  apiArticleToStrip,

  apiArticleToRecent,

  computeEducationHubStats,

  educatorsFromArticles,

  getMockFeaturedEducators,

  hubSeriesToLearningPaths,

  mediaShowToEducationVideo,

  MOCK_LEARNING_PATHS,

  pickRecentFromMock,

  pickTrendingFromMock,

  pickVideoStripsFromArticles,

  pickVideosFromMock,

  presenterToFeaturedEducator,

  educationTopicFiltersFromArticles,

} from '@/lib/education-discover-data'

import { EDUCATION_VIEW_META, parseEducationHubView } from '@/lib/education-section-mode'

import { buildProgressSnapshot } from '@/lib/education-progress-preview'

import { getMockEducationCatalog } from '@/data/mock-home-surface'

import { cn } from '@/lib/cn'

import { shellOuterClass } from '@/lib/shell-contract'



const ECKE_SLUG_PREFIXES = ['ssc-vs-rack', 'negotiation-101-building', 'aftercare-essentials']



export default function EducationDiscoverPage() {

  const searchId = useId()

  const [searchParams] = useSearchParams()

  const hubView = parseEducationHubView(searchParams)

  const { isAuthenticated, isFallback } = useAuth()



  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => searchParams.get('category')?.trim() || null,
  )

  const [searchQuery, setSearchQuery] = useState('')

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)



  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'

  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated



  const hubCatalogueApi = useApiEducationArticles({

    limit: 48,

    enabled: true,

  })



  const articlesApi = useApiEducationArticles({

    category: selectedCategory,

    q: searchQuery.trim() || undefined,

    limit: 36,

    enabled: true,

  })



  const hubSeriesApi = useApiEducationHubSeries(true)

  const bookmarksApi = useApiBookmarks(isAuthenticated && !isFallback)

  const videoShowsApi = useApiMediaShows({ format: 'video', limit: 8, enabled: !useDemoFallback })

  const podcastShowsApi = useApiMediaShows({ format: 'podcast', limit: 8, enabled: !useDemoFallback })

  const presentersApi = useApiPresenters(!useDemoFallback, { q: '', tag: '', sort: 'popular' })



  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedCategory !== null



  const clearFilters = () => {

    setSearchQuery('')

    setSelectedCategory(null)

  }



  const scrollToTopics = useCallback(() => {

    const el = document.getElementById('education-all-articles')

    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  }, [])



  useEffect(() => {
    setSelectedCategory(searchParams.get('category')?.trim() || null)
  }, [searchParams])

  useEffect(() => {

    if (hubView === 'articles') {

      scrollToTopics()

    } else if (hubView !== 'overview') {

      window.scrollTo({ top: 0, behavior: 'smooth' })

    }

  }, [hubView, scrollToTopics])



  const hubArticles = hubCatalogueApi.items

  const catalogueArticles = articlesApi.items

  const catalogueLoading = articlesApi.status === 'loading' || articlesApi.status === 'idle'



  const stripFromApi = useMemo(() => {

    if (hubCatalogueApi.status !== 'ready' || hubArticles.length === 0) return null

    return buildStripSectionsFromApi(hubArticles)

  }, [hubCatalogueApi.status, hubArticles])



  const mockCatalog = useMemo(() => getMockEducationCatalog(), [])



  const trending = useMemo(() => {

    if (stripFromApi && stripFromApi.trending.length > 0) return stripFromApi.trending

    if (useDemoFallback) return pickTrendingFromMock(8)

    if (hubArticles.length === 0) return []

    return hubArticles.slice(0, 8).map(apiArticleToStrip)

  }, [stripFromApi, useDemoFallback, hubArticles])



  const workshopVideos = useMemo(() => {

    if (useDemoFallback) return pickVideosFromMock(8)

    const fromArticles = pickVideoStripsFromArticles(hubArticles, 4)

    const fromMedia = videoShowsApi.items.slice(0, 4).map(mediaShowToEducationVideo)

    return [...fromArticles, ...fromMedia].slice(0, 8)

  }, [useDemoFallback, hubArticles, videoShowsApi.items])



  const videos = useMemo(() => {

    if (useDemoFallback) return pickVideosFromMock(8)

    return workshopVideos

  }, [useDemoFallback, workshopVideos])



  const recent = useMemo(() => {

    if (stripFromApi && stripFromApi.recent.length > 0) return stripFromApi.recent

    if (useDemoFallback) return pickRecentFromMock(6)

    if (hubArticles.length === 0) return []

    return hubArticles.slice(0, 6).map((a, i) => apiArticleToRecent(a, i))

  }, [stripFromApi, useDemoFallback, hubArticles])



  const educators = useMemo(() => {

    if (presentersApi.status === 'ready' && presentersApi.items.length > 0) {

      return presentersApi.items.slice(0, 4).map(presenterToFeaturedEducator)

    }

    if (hubCatalogueApi.status === 'ready' && hubArticles.length > 0) {

      return educatorsFromArticles(hubArticles)

    }

    if (useDemoFallback) return getMockFeaturedEducators()

    return []

  }, [presentersApi.status, presentersApi.items, hubCatalogueApi.status, hubArticles, useDemoFallback])



  const learningPaths = useMemo(() => {

    if (hubSeriesApi.status === 'ready' && hubSeriesApi.items.length > 0) {

      return hubSeriesToLearningPaths(hubSeriesApi.items)

    }

    if (useDemoFallback) return MOCK_LEARNING_PATHS

    return []

  }, [hubSeriesApi.status, hubSeriesApi.items, useDemoFallback])



  const progressSnapshot = useMemo(
    () => buildProgressSnapshot(learningPaths, hubArticles),
    [learningPaths, hubArticles],
  )

  const savedArticleCount = useMemo(() => {
    if (!isAuthenticated || isFallback || bookmarksApi.status !== 'ready') return null
    return bookmarksApi.items.filter((item) => item.objectType === BOOKMARK_OBJECT_EDUCATION_ARTICLE).length
  }, [bookmarksApi.items, bookmarksApi.status, isAuthenticated, isFallback])



  const topicFilters = useMemo(() => {
    if (hubCatalogueApi.status === 'ready' && hubArticles.length > 0) {
      return educationTopicFiltersFromArticles(hubArticles)
    }
    if (useDemoFallback) {
      return educationTopicFiltersFromArticles(
        getMockEducationCatalog().map((article) => ({ categories: [article.category] })),
      )
    }
    return []
  }, [hubCatalogueApi.status, hubArticles, useDemoFallback, mockCatalog])



  const eckeSpotlight = useMemo(

    () =>

      hubArticles.filter((article) =>

        ECKE_SLUG_PREFIXES.some((prefix) => article.slug.startsWith(prefix)),

      ),

    [hubArticles],

  )



  const stats = useMemo(

    () =>

      computeEducationHubStats(

        hubCatalogueApi.status === 'ready' ? hubArticles.length : useDemoFallback ? mockCatalog.length : 0,

        workshopVideos.length + videoShowsApi.items.length,

        educators.length,

      ),

    [

      hubCatalogueApi.status,

      hubArticles.length,

      mockCatalog.length,

      educators.length,

      useDemoFallback,

      workshopVideos.length,

      videoShowsApi.items.length,

    ],

  )



  const sharedCatalogueProps = {

    stats,

    learningPaths,

    educators,

    trending,

    videos,

    recent,

    catalogueArticles,

    catalogueLoading,

    catalogueError: articlesApi.error,

    onCatalogueRetry: articlesApi.reload,

    searchQuery,

    onSearchChange: setSearchQuery,

    hasActiveFilters,

    onClearFilters: clearFilters,

    onBrowseTopics: scrollToTopics,

    searchId,

    showDemoLabel: useDemoFallback,

    apiBacked: !useDemoFallback && hubCatalogueApi.status === 'ready',

  }



  const mainContent = () => {

    switch (hubView) {

      case 'paths':

        return <EducationPathsPage />

      case 'videos': {

        const meta = EDUCATION_VIEW_META.videos

        return (

          <>

            <EducationSectionHeader title={meta.title} subtitle={meta.subtitle} />

            <EducationVideosPanel

              workshopVideos={workshopVideos}

              mediaShows={videoShowsApi.items}

              loading={videoShowsApi.status === 'loading' || videoShowsApi.status === 'idle'}

              error={videoShowsApi.error}

              onRetry={videoShowsApi.reload}

            />

          </>

        )

      }

      case 'podcasts': {

        const meta = EDUCATION_VIEW_META.podcasts

        return (

          <>

            <EducationSectionHeader title={meta.title} subtitle={meta.subtitle} />

            <EducationPodcastsPanel

              mediaShows={podcastShowsApi.items}

              loading={podcastShowsApi.status === 'loading' || podcastShowsApi.status === 'idle'}

              error={podcastShowsApi.error}

              onRetry={podcastShowsApi.reload}

            />

          </>

        )

      }

      case 'articles': {

        const meta = EDUCATION_VIEW_META.articles

        return (

          <>

            <EducationSectionHeader title={meta.title} subtitle={meta.subtitle} />

            <div id="education-all-articles">

              <EducationDiscoverCenter {...sharedCatalogueProps} variant="articles-only" />

            </div>

          </>

        )

      }

      case 'library':

        return (

          <>

            <EducationSectionHeader

              title={EDUCATION_VIEW_META.library.title}

              subtitle={EDUCATION_VIEW_META.library.subtitle}

            />

            <EducationLibraryPanel

              articles={hubArticles}

              loading={hubCatalogueApi.status === 'loading' || hubCatalogueApi.status === 'idle'}

            />

          </>

        )

      case 'progress':

        return (

          <>

            <EducationSectionHeader

              title={EDUCATION_VIEW_META.progress.title}

              subtitle={EDUCATION_VIEW_META.progress.subtitle}

            />

            <EducationProgressPanel
              paths={learningPaths}
              articles={hubArticles}
              loading={hubSeriesApi.status === 'loading' || hubSeriesApi.status === 'idle'}
            />

          </>

        )

      default:

        return (

          <div id="education-all-articles">

            <EducationDiscoverCenter {...sharedCatalogueProps} variant="overview" />

          </div>

        )

    }

  }



  return (

    <EducationDiscoverShell>

      <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>

        <DirectoryTemplate

          title="Education"

          className="py-4 sm:py-6"

          desktopAsideFrom="lg"

          toolbar={

            <div className="flex justify-end lg:hidden">

              <button

                type="button"

                onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}

                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-accent"

              >

                Topics

              </button>

            </div>

          }

          desktopSidebar={

            <EducationLeftRail

              selectedCategory={selectedCategory}

              onCategoryChange={setSelectedCategory}

              onBrowseTopics={scrollToTopics}

              topicFilters={topicFilters}

            />

          }

          desktopAside={

            <EducationRightRail

              articleCount={stats.articles}

              pathCount={learningPaths.length}

              learningPaths={progressSnapshot.paths}

              spotlightArticles={eckeSpotlight}

              progressSnapshot={progressSnapshot}

              savedArticleCount={savedArticleCount}

              bookmarksReady={bookmarksApi.status === 'ready'}

              isAuthenticated={isAuthenticated && !isFallback}

            />

          }

        >

          {filterDrawerOpen ?

            <div className="mb-6 lg:hidden">

              <EducationLeftRail

                selectedCategory={selectedCategory}

                onCategoryChange={setSelectedCategory}

                onBrowseTopics={() => {

                  setFilterDrawerOpen(false)

                  scrollToTopics()

                }}

                topicFilters={topicFilters}

              />

            </div>

          : null}



          {mainContent()}

        </DirectoryTemplate>

      </div>

    </EducationDiscoverShell>

  )

}


