import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LocalPostCard from '@/components/cards/LocalPostCard'
import EventCard from '@/components/cards/EventCard'
import EducationArticleCard from '@/components/education/EducationArticleCard'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import PersonalUtilityPageShell from '@/components/layout/PersonalUtilityPageShell'
import SavedBookmarkTip from '@/components/saved/SavedBookmarkTip'
import SavedEmptyPanel from '@/components/saved/SavedEmptyPanel'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import SavedFilterChips from '@/components/saved/SavedFilterChips'
import SavedRemoveMenu from '@/components/saved/SavedRemoveMenu'
import SavedRightRail from '@/components/saved/SavedRightRail'
import type { SavedFilter } from '@/components/saved/saved-ui'
import { SAVED_FILTER_EMPTY_CTA } from '@/components/saved/saved-ui'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import type { ApiMediaShowListItem } from '@/hooks/useApiMediaShows'
import {
  BOOKMARK_OBJECT_EDUCATION_ARTICLE,
  BOOKMARK_OBJECT_EVENT,
  BOOKMARK_OBJECT_FEED_POST,
  BOOKMARK_OBJECT_MEDIA_EPISODE,
  BOOKMARK_OBJECT_MEDIA_SHOW,
  type BookmarkObjectType,
  useApiBookmarks,
} from '@/hooks/useApiBookmarks'
import { apiPostToHomeFeedPost } from '@/lib/feed-mapper'
import { bookmarkEventToMockEvent } from '@/lib/bookmark-event-mapper'
import { useAuth } from '@/contexts/AuthContext'

function SavedItemWrap({
  children,
  objectType,
  objectId,
  onRemove,
  removing,
}: {
  children: React.ReactNode
  objectType: BookmarkObjectType
  objectId: string
  onRemove: (objectType: BookmarkObjectType, objectId: string) => void
  removing: boolean
}) {
  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10">
        <SavedRemoveMenu
          onRemove={() => onRemove(objectType, objectId)}
          busy={removing}
        />
      </div>
      {children}
    </div>
  )
}

function SavedSection({
  title,
  children,
  showHeading,
}: {
  title: string
  children: React.ReactNode
  showHeading: boolean
}) {
  if (!children) return null
  return (
    <section className="mb-8 last:mb-0">
      {showHeading ?
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dc-muted">{title}</h2>
      : null}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const FILTER_PARAM = 'type'

function parseFilter(raw: string | null): SavedFilter {
  if (raw === 'events' || raw === 'articles' || raw === 'media' || raw === 'posts') return raw
  return 'all'
}

export default function SavedPageClient() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get(FILTER_PARAM))
  const setFilter = (f: SavedFilter) => {
    setSearchParams(f === 'all' ? {} : { [FILTER_PARAM]: f }, { replace: true })
  }

  const { status: bookmarkStatus, items, error, reload, toggleBookmark, bookmarkBusy } =
    useApiBookmarks(isAuthenticated)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  const feedPosts = useMemo(
    () =>
      items
        .filter((item) => item.objectType === BOOKMARK_OBJECT_FEED_POST && item.post)
        .map((item) => ({
          objectType: BOOKMARK_OBJECT_FEED_POST,
          objectId: item.objectId,
          createdAt: item.createdAt,
          post: apiPostToHomeFeedPost(item.post!),
        })),
    [items],
  )

  const articles = useMemo(
    () =>
      items
        .filter((item) => item.objectType === BOOKMARK_OBJECT_EDUCATION_ARTICLE && item.article)
        .map((item) => ({
          objectType: BOOKMARK_OBJECT_EDUCATION_ARTICLE,
          objectId: item.objectId,
          createdAt: item.createdAt,
          article: item.article!,
        })),
    [items],
  )

  const mediaShows = useMemo(
    () =>
      items
        .filter((item) => item.objectType === BOOKMARK_OBJECT_MEDIA_SHOW && item.mediaShow)
        .map((item) => ({
          objectType: BOOKMARK_OBJECT_MEDIA_SHOW,
          objectId: item.objectId,
          createdAt: item.createdAt,
          show: {
            id: item.mediaShow!.id,
            slug: item.mediaShow!.slug,
            title: item.mediaShow!.title,
            description: null,
            coverImageUrl: item.mediaShow!.coverImageUrl,
            mediaFormat: item.mediaShow!.mediaFormat as ApiMediaShowListItem['mediaFormat'],
            tags: [],
            contentWarnings: [],
            ownerUsername: '',
            ownerDisplayName: null,
            updatedAt: item.createdAt,
          } satisfies ApiMediaShowListItem,
        })),
    [items],
  )

  const mediaEpisodes = useMemo(
    () =>
      items
        .filter((item) => item.objectType === BOOKMARK_OBJECT_MEDIA_EPISODE && item.mediaEpisode)
        .map((item) => ({
          objectType: BOOKMARK_OBJECT_MEDIA_EPISODE,
          objectId: item.objectId,
          createdAt: item.createdAt,
          episode: item.mediaEpisode!,
        })),
    [items],
  )

  const savedEvents = useMemo(
    () =>
      items
        .filter((item) => item.objectType === BOOKMARK_OBJECT_EVENT && item.event)
        .map((item) => ({
          objectType: BOOKMARK_OBJECT_EVENT,
          objectId: item.objectId,
          createdAt: item.createdAt,
          event: bookmarkEventToMockEvent(item.event!),
        })),
    [items],
  )

  const counts = useMemo(
    () => ({
      all:
        feedPosts.length +
        articles.length +
        mediaShows.length +
        mediaEpisodes.length +
        savedEvents.length,
      events: savedEvents.length,
      articles: articles.length,
      media: mediaShows.length + mediaEpisodes.length,
      posts: feedPosts.length,
    }),
    [feedPosts.length, articles.length, mediaShows.length, mediaEpisodes.length, savedEvents.length],
  )

  const isEmpty = counts.all === 0

  const handleRemove = async (objectType: BookmarkObjectType, objectId: string) => {
    const key = `${objectType}:${objectId}`
    setRemovingKey(key)
    try {
      await toggleBookmark(objectType, objectId)
    } finally {
      setRemovingKey(null)
    }
  }

  const isRemoving = (objectType: BookmarkObjectType, objectId: string) =>
    removingKey === `${objectType}:${objectId}` || bookmarkBusy

  const showEvents = filter === 'all' || filter === 'events'
  const showArticles = filter === 'all' || filter === 'articles'
  const showMedia = filter === 'all' || filter === 'media'
  const showPosts = filter === 'all' || filter === 'posts'
  const groupHeadings = filter === 'all'

  const eventSection =
    showEvents && savedEvents.length > 0 ?
      savedEvents.map((entry) => (
        <SavedItemWrap
          key={`event-${entry.objectId}`}
          objectType={entry.objectType}
          objectId={entry.objectId}
          onRemove={handleRemove}
          removing={isRemoving(entry.objectType, entry.objectId)}
        >
          <EventCard event={entry.event} />
        </SavedItemWrap>
      ))
    : null

  const articleSection =
    showArticles && articles.length > 0 ?
      articles.map((entry) => (
        <SavedItemWrap
          key={`article-${entry.objectId}`}
          objectType={entry.objectType}
          objectId={entry.objectId}
          onRemove={handleRemove}
          removing={isRemoving(entry.objectType, entry.objectId)}
        >
          <EducationArticleCard
            slug={entry.article.slug}
            title={entry.article.title}
            excerpt={entry.article.excerpt}
            heroImageUrl={entry.article.heroImageUrl}
            subtitle={
              <>
                By{' '}
                <Link
                  to={`/presenters/${encodeURIComponent(entry.article.authorUsername)}`}
                  className="text-dc-accent hover:underline"
                >
                  {entry.article.authorUsername}
                </Link>
              </>
            }
          />
        </SavedItemWrap>
      ))
    : null

  const mediaSection =
    showMedia && (mediaShows.length > 0 || mediaEpisodes.length > 0) ?
      <>
        {mediaShows.map((entry) => (
          <SavedItemWrap
            key={`media-${entry.objectId}`}
            objectType={entry.objectType}
            objectId={entry.objectId}
            onRemove={handleRemove}
            removing={isRemoving(entry.objectType, entry.objectId)}
          >
            <MediaChannelCard show={entry.show} layout="compact" />
          </SavedItemWrap>
        ))}
        {mediaEpisodes.map((entry) => (
          <SavedItemWrap
            key={`episode-${entry.objectId}`}
            objectType={entry.objectType}
            objectId={entry.objectId}
            onRemove={handleRemove}
            removing={isRemoving(entry.objectType, entry.objectId)}
          >
            <Link
              to={`/media/${encodeURIComponent(entry.episode.showSlug)}`}
              className={`block p-4 pr-14 ${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass}`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">
                {entry.episode.showTitle}
              </p>
              <h3 className="mt-1 font-semibold text-dc-text">{entry.episode.title}</h3>
              <p className="mt-2 text-sm font-medium text-dc-accent">Open media →</p>
            </Link>
          </SavedItemWrap>
        ))}
      </>
    : null

  const postSection =
    showPosts && feedPosts.length > 0 ?
      feedPosts.map((entry) => (
        <SavedItemWrap
          key={`post-${entry.objectId}`}
          objectType={entry.objectType}
          objectId={entry.objectId}
          onRemove={handleRemove}
          removing={isRemoving(entry.objectType, entry.objectId)}
        >
          <LocalPostCard post={entry.post} />
        </SavedItemWrap>
      ))
    : null

  const hasFilteredContent =
    (showEvents && savedEvents.length > 0) ||
    (showArticles && articles.length > 0) ||
    (showMedia && (mediaShows.length > 0 || mediaEpisodes.length > 0)) ||
    (showPosts && feedPosts.length > 0)

  const filteredEmpty = !isEmpty && !hasFilteredContent && filter !== 'all'

  return (
    <PersonalUtilityPageShell
      showMobileNavToggle
      mobileNavOpen={mobileNavOpen}
      onMobileNavToggle={() => setMobileNavOpen((o) => !o)}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <header className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Saved</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
                Events, articles, media, vendors, and posts you bookmarked for later.
              </p>
            </header>

            <SavedFilterChips active={filter} counts={counts} onChange={setFilter} />

            {error ?
              <LoadErrorBanner className="mb-4" message={error} onRetry={reload} />
            : null}

            {bookmarkStatus === 'loading' ?
              <div className="dc-skeleton-stagger space-y-4">
                <FeedCardSkeleton />
                <FeedCardSkeleton />
              </div>
            : isEmpty && !error ?
              <>
                <SavedEmptyPanel />
                <SavedBookmarkTip />
              </>
            : filteredEmpty ?
              (() => {
                const cta = SAVED_FILTER_EMPTY_CTA[filter]
                return (
                  <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-6 py-10 text-center">
                    <p className="text-sm text-dc-text-muted">Nothing saved in this category yet.</p>
                    <Link to={cta.href} className="mt-4 inline-block text-sm font-semibold text-dc-accent hover:underline">
                      {cta.label}
                    </Link>
                  </div>
                )
              })()
            : <div>
                <SavedSection title="Saved events" showHeading={groupHeadings}>
                  {eventSection}
                </SavedSection>
                <SavedSection title="Saved articles" showHeading={groupHeadings}>
                  {articleSection}
                </SavedSection>
                <SavedSection title="Saved media" showHeading={groupHeadings}>
                  {mediaSection}
                </SavedSection>
                <SavedSection title="Saved posts" showHeading={groupHeadings}>
                  {postSection}
                </SavedSection>
                {!isEmpty ?
                  <SavedBookmarkTip />
                : null}
              </div>
            }

            <div className="mt-8 lg:hidden">
              <SavedRightRail />
            </div>
          </div>

          <div className="hidden lg:block">
            <SavedRightRail />
          </div>
        </div>
      </div>
    </PersonalUtilityPageShell>
  )
}
