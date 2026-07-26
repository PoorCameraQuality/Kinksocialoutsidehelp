import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import EducationArticleCard from '@/components/education/EducationArticleCard'
import EducationArticleStripCard from '@/components/education/EducationArticleStripCard'
import EducationDiscoverHero from '@/components/education/EducationDiscoverHero'
import EducationDiscoverSection from '@/components/education/EducationDiscoverSection'
import EducationFeaturedEducators from '@/components/education/EducationFeaturedEducators'
import EducationLearningPaths from '@/components/education/EducationLearningPaths'
import EducationRecentTextCard from '@/components/education/EducationRecentTextCard'
import EducationVideoStripCard from '@/components/education/EducationVideoStripCard'
import EmptyState from '@/components/ui/EmptyState'
import type { ApiEducationArticle } from '@/hooks/useApiEducationArticles'
import {
  MOCK_LEARNING_PATHS,
  apiArticleToRecent,
  apiArticleToStrip,
  type EducationFeaturedEducator,
  type EducationHubStats,
  type EducationRecentTextItem,
  type EducationStripArticle,
  type EducationStripVideo,
} from '@/lib/education-discover-data'

type Props = {
  stats: EducationHubStats
  learningPaths?: typeof MOCK_LEARNING_PATHS
  educators: EducationFeaturedEducator[]
  trending: EducationStripArticle[]
  videos: EducationStripVideo[]
  recent: EducationRecentTextItem[]
  catalogueArticles: ApiEducationArticle[]
  catalogueLoading: boolean
  catalogueError: string | null
  onCatalogueRetry: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  onBrowseTopics: () => void
  searchId: string
  showDemoLabel?: boolean
  /** Signed-in article catalogue - hides mock-only overview strips. */
  apiBacked?: boolean
  /** Overview hub vs articles-only section (sidebar “Articles”). */
  variant?: 'overview' | 'articles-only'
}

export default function EducationDiscoverCenter({
  stats,
  learningPaths = MOCK_LEARNING_PATHS,
  educators,
  trending,
  videos,
  recent,
  catalogueArticles,
  catalogueLoading,
  catalogueError,
  onCatalogueRetry,
  searchQuery,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  onBrowseTopics,
  searchId,
  showDemoLabel,
  apiBacked = false,
  variant = 'overview',
}: Props) {
  const articlesOnly = variant === 'articles-only'
  const showMockOverview = !apiBacked && !articlesOnly
  const showLearningPaths = learningPaths.length > 0 && (apiBacked || showMockOverview)
  const sortedCatalogue = useMemo(() => {
    return [...catalogueArticles].sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })
  }, [catalogueArticles])

  return (
    <div className="min-w-0 c2k-mobile-scroll-pad">
      {!articlesOnly ?
        <>
          <EducationDiscoverHero stats={stats} onBrowseTopics={onBrowseTopics} apiBacked={apiBacked} />

          {showMockOverview ?
            <>
              <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                Learning paths, featured educators, and video strips below use preview content. Article catalogue is live when
                signed in.
              </p>
              {showLearningPaths ?
                <EducationLearningPaths paths={learningPaths} />
              : null}
              <EducationFeaturedEducators educators={educators} />
            </>
          : <>
              {showLearningPaths ?
                <EducationLearningPaths paths={learningPaths} />
              : null}
              {educators.length > 0 ?
                <EducationFeaturedEducators educators={educators} />
              : null}
            </>}

          <EducationDiscoverSection title="Trending Articles" viewAllHref="/education?view=articles">
            {trending.length > 0 ?
              <div className="c2k-snap-carousel">
                <div className="c2k-snap-carousel__track">
                  {trending.map((article) => (
                    <EducationArticleStripCard key={article.slug} article={article} />
                  ))}
                </div>
                <div className="c2k-snap-carousel__fade" aria-hidden />
              </div>
            : <p className="text-sm text-dc-text-muted">No articles match this filter yet.</p>}
          </EducationDiscoverSection>

          {videos.length > 0 ?
            <EducationDiscoverSection title="Popular Videos" viewAllHref="/education?view=videos">
              <div className="c2k-snap-carousel">
                <div className="c2k-snap-carousel__track">
                  {videos.map((video) => (
                    <EducationVideoStripCard key={video.slug} video={video} />
                  ))}
                </div>
                <div className="c2k-snap-carousel__fade" aria-hidden />
              </div>
            </EducationDiscoverSection>
          : null}

          {recent.length > 0 ?
            <EducationDiscoverSection title="Recently Added" viewAllHref="/education?view=articles">
              <div className="c2k-snap-carousel">
                <div className="c2k-snap-carousel__track">
                  {recent.map((item) => (
                    <EducationRecentTextCard key={item.slug} item={item} />
                  ))}
                </div>
                <div className="c2k-snap-carousel__fade" aria-hidden />
              </div>
            </EducationDiscoverSection>
          : null}
        </>
      : null}

      <div className={articlesOnly ? 'scroll-mt-24' : 'scroll-mt-24 border-t border-dc-border pt-8'}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {!articlesOnly ?
              <>
                <h2 className="text-lg font-semibold text-dc-text">All articles</h2>
                <p className="text-sm text-dc-text-muted">Filter by topic or search the full catalogue.</p>
              </>
            : null}
          </div>
          {showDemoLabel ?
            <span className="text-xs text-dc-muted">Demo catalogue</span>
          : null}
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search articles by title or topic
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
              id={searchId}
              type="search"
              name="education-search"
              placeholder="Search articles by title or topic…"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-dc-border bg-[var(--dc-input)] py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
            />
          </div>
          {hasActiveFilters ?
            <button
              type="button"
              onClick={onClearFilters}
              className="min-h-11 shrink-0 rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text sm:self-start"
            >
              Clear
            </button>
          : null}
        </div>

        {catalogueError ?
          <EmptyState
            inline
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title="Could not load articles"
            message={catalogueError}
            actionLabel="Retry"
            onAction={onCatalogueRetry}
          />
        : catalogueLoading ?
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" aria-busy="true" role="status">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid">
                <div className="aspect-[16/10] animate-pulse bg-dc-elevated-muted" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-dc-elevated-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-dc-elevated-muted" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-dc-elevated-muted" />
                </div>
              </div>
            ))}
          </div>
        : sortedCatalogue.length === 0 ?
          <div
            className="rounded-2xl border border-dc-border bg-dc-elevated/80 px-6 py-12 text-center shadow-[var(--dc-shadow-soft)]"
            role="status"
          >
            <p className="text-lg font-semibold text-dc-text">No articles found</p>
            <p className="mt-2 text-sm text-dc-text-muted">
              {hasActiveFilters ?
                'Try another category or search with different keywords.'
              : catalogueError ?
                'The article catalogue could not be loaded.'
              : 'Nothing is listed on the education hub yet. Published articles with “List in education hub” appear here.'}
            </p>
            {hasActiveFilters ?
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Clear search and category
              </button>
            : null}
          </div>
        : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {sortedCatalogue.map((a) => (
              <EducationArticleCard key={a.id} article={a} />
            ))}
          </div>
        }
      </div>

      <p className="mt-10 border-t border-dc-border pt-6 text-center text-sm text-dc-text-muted">
        Prefer podcasts and video?{' '}
        <Link to="/media" className="font-medium text-dc-accent hover:underline">
          Browse Media
        </Link>
      </p>
    </div>
  )
}

/** Build strip sections from API articles when live data is available. */
export function buildStripSectionsFromApi(items: ApiEducationArticle[]): {
  trending: EducationStripArticle[]
  videos: EducationStripVideo[]
  recent: EducationRecentTextItem[]
} {
  const strips = items.map(apiArticleToStrip)
  const recent = items.slice(0, 6).map((a, i) => apiArticleToRecent(a, i))
  return {
    trending: strips.slice(0, 8),
    videos: [],
    recent,
  }
}
