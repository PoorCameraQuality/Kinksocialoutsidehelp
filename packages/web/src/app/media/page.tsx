import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import EducationLeftRail from '@/components/education/EducationLeftRail'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import MediaEmptyPanel from '@/components/media/MediaEmptyPanel'
import MediaFilterLeftRail from '@/components/media/MediaFilterLeftRail'
import MediaRightRail from '@/components/media/MediaRightRail'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import TabButton from '@/components/ui/TabButton'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import DirectoryTemplate from '@/components/templates/DirectoryTemplate'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { useApiEducationArticles } from '@/hooks/useApiEducationArticles'
import { useApiMyMediaShows } from '@/hooks/useApiMyMediaShows'
import { useApiMediaShows, type MediaFormat } from '@/hooks/useApiMediaShows'
import { educationTopicFiltersFromArticles } from '@/lib/education-discover-data'
import { cn } from '@/lib/cn'
import { MEDIA_FORMAT_TABS, MEDIA_TOPIC_META, MEDIA_TOPIC_TAGS, type MediaTopicTag } from '@/lib/media-page-utils'
import { shellOuterClass } from '@/lib/shell-contract'

function parseFormatParam(raw: string | null): MediaFormat | '' {
  if (raw === 'podcast' || raw === 'video' || raw === 'hybrid') return raw
  return ''
}

export default function MediaPage() {
  const searchId = useId()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, isFallback, viewerUsername } = useAuth()
  const showApi = isAuthenticated && !isFallback

  const [format, setFormat] = useState<MediaFormat | ''>(() => parseFormatParam(searchParams.get('format')))
  const [tag, setTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false)

  const hubArticlesApi = useApiEducationArticles({ limit: 48, enabled: true })
  const topicFilters = useMemo(() => {
    if (hubArticlesApi.status !== 'ready' || hubArticlesApi.items.length === 0) return []
    return educationTopicFiltersFromArticles(hubArticlesApi.items)
  }, [hubArticlesApi.status, hubArticlesApi.items])

  useEffect(() => {
    setFormat(parseFormatParam(searchParams.get('format')))
  }, [searchParams])

  const { status, items, error, reload } = useApiMediaShows({
    format,
    tag: tag ?? undefined,
    q: searchQuery.trim() || undefined,
    enabled: true,
  })

  const myShows = useApiMyMediaShows(showApi)

  const loading = status === 'loading' || status === 'idle'
  const hasActiveFilters = format !== '' || Boolean(searchQuery.trim()) || tag !== null

  const setFormatFilter = (next: MediaFormat | '') => {
    setFormat(next)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('format', next)
    else params.delete('format')
    setSearchParams(params, { replace: true })
  }

  const clearFilters = () => {
    setFormatFilter('')
    setSearchQuery('')
    setTag(null)
  }

  const submitHref = isAuthenticated ? '/media/submit' : buildLoginHref('/media/submit')

  const leftRail = (
    <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <EducationLeftRail
        embedded
        selectedCategory={null}
        onCategoryChange={() => {}}
        onBrowseTopics={() => navigate('/education?view=articles')}
        topicFilters={topicFilters}
      />
      <MediaFilterLeftRail
        format={format}
        tag={tag}
        onFormatChange={setFormatFilter}
        onTagChange={setTag}
      />
    </div>
  )

  const rightRail = (
    <MediaRightRail
      myShows={myShows.items}
      myShowsLoading={myShows.status === 'loading'}
      viewerUsername={viewerUsername}
    />
  )

  const tagChips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
      <button
        type="button"
        onClick={() => setTag(null)}
        className={`min-h-9 rounded-full px-3 text-xs font-medium transition-colors ${
          tag === null ?
            'bg-dc-accent text-dc-accent-foreground'
          : 'border border-dc-border text-dc-text-muted hover:text-dc-text'
        }`}
      >
        All topics
      </button>
      {MEDIA_TOPIC_TAGS.map((t) => {
        const meta = MEDIA_TOPIC_META[t as MediaTopicTag]
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTag(tag === t ? null : t)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
              tag === t ?
                'bg-dc-accent-muted text-dc-accent ring-1 ring-dc-accent-border/40'
              : 'border border-dc-border text-dc-text-muted hover:border-dc-accent-border/30 hover:text-dc-text'
            }`}
          >
            <span aria-hidden>{meta.icon}</span>
            {meta.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>
      <DirectoryTemplate
        title="Media"
        className="py-4 sm:py-6"
        desktopAsideFrom="lg"
        header={
          <header className="mb-4 max-w-3xl md:mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Media</h1>
                <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
                  Kink podcasts, YouTube channels, and hybrid shows curated by the Kink Social community.
                </p>
                <p className="mt-1 hidden text-xs text-dc-muted sm:block">
                  Kink Social does not host episodes. Channels link out to the platforms creators already use.
                </p>
              </div>
              <Link
                to={submitHref}
                className="hidden min-h-11 shrink-0 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover md:inline-flex"
              >
                Submit a channel
              </Link>
            </div>
          </header>
        }
        toolbar={
          <>
            <div className="relative">
              <label htmlFor={searchId} className="sr-only">
                Search media channels
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
                placeholder="Search by title, creator, topic, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated-solid py-2.5 pl-10 pr-4 text-sm text-dc-text placeholder-dc-muted outline-none focus:border-dc-accent focus:ring-1 focus:ring-dc-accent"
              />
            </div>

            <nav
              className="-mx-1 mt-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 c2k-no-scrollbar lg:hidden"
              aria-label="Media format"
            >
              {MEDIA_FORMAT_TABS.map((tab) => (
                <TabButton
                  key={tab.id || 'all'}
                  label={tab.label}
                  isActive={format === tab.id}
                  onClick={() => setFormatFilter(tab.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => setTagDrawerOpen((o) => !o)}
                className="ml-auto inline-flex min-h-9 shrink-0 items-center rounded-full border border-dc-border bg-dc-elevated-solid px-3 text-xs font-medium text-dc-accent lg:hidden"
                aria-expanded={tagDrawerOpen}
              >
                Topics{tag ? `: ${tag}` : ''}
              </button>
            </nav>

            {tagDrawerOpen ?
              <div className="mt-2 rounded-2xl border border-dc-border bg-dc-elevated-solid p-3 lg:hidden">{tagChips}</div>
            : null}

            {hasActiveFilters ?
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-dc-accent hover:underline"
                >
                  Clear filters
                </button>
              </div>
            : null}
          </>
        }
        desktopSidebar={leftRail}
        desktopAside={rightRail}
      >
        {error ?
          <LoadErrorBanner message={error} onRetry={() => void reload()} />
        : null}

        {loading ?
          <div className="dc-skeleton-stagger mt-6 space-y-4">
            <FeedCardSkeleton />
            <FeedCardSkeleton />
          </div>
        : items.length === 0 && !error ?
          <MediaEmptyPanel
            isAuthenticated={isAuthenticated}
            filtered={hasActiveFilters}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        : <div className="space-y-4">
            {!loading && items.length > 0 ?
              <p className="text-sm text-dc-muted" role="status">
                {items.length} channel{items.length === 1 ? '' : 's'}
              </p>
            : null}
            {items.map((show) => (
              <MediaChannelCard key={show.id} show={show} />
            ))}
          </div>
        }

        <div className="mt-8 lg:hidden">{rightRail}</div>
      </DirectoryTemplate>
    </div>
  )
}
