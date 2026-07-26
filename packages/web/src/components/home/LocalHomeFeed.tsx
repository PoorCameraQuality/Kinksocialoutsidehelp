import { Link } from 'react-router-dom'
import { buildLoginHref } from '@/lib/auth-links'
import EventCard from '@/components/cards/EventCard'
import LocalPostCard from '@/components/cards/LocalPostCard'
import ConventionPinsCompact from '@/components/home/ConventionPinsCompact'
import HomeFeedMockComposer from '@/components/home/HomeFeedMockComposer'
import HomeFeedRichComposer from '@/components/home/HomeFeedRichComposer'
import HomeMobileComposer from '@/components/home/HomeMobileComposer'
import FeedTemplate from '@/components/templates/FeedTemplate'
import { Panel } from '@/components/dancecard/ui/Panel'
import FeedScopeTabs from '@/components/home/FeedScopeTabs'
import EmptyState from '@/components/ui/EmptyState'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton, HomeEventGridSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import type { HomeFeedPost } from '@/lib/feed-types'
import type { ComponentProps } from 'react'

type EventItem = ComponentProps<typeof EventCard>['event']

type Props = {
  viewerUsername: string
  isAuthenticated: boolean
  isFallback: boolean
  useDbComposer: boolean
  apiFeedSettled: boolean
  apiFeedOk: boolean
  apiFeedError: string | null
  localFeedPosts: HomeFeedPost[]
  onPosted: () => void
  onRefreshFeed: () => void
  onRepost?: (originalPostId: string) => void
  onEditMock?: (postId: string, text: string) => void
  onDeleteMock?: (postId: string) => void
  rankedEvents: EventItem[]
  homeEventsLoading: boolean
  homeEventsApiError: boolean
  onRetryEvents: () => void
  showConventionPins: boolean
  /** LinkedIn-style feed shell - composer, tabs, posts only. */
  feedShell?: boolean
  /** Smaller composer + feed-before-composer on mobile shell. */
  compactComposer?: boolean
}

export default function LocalHomeFeed({
  viewerUsername,
  isAuthenticated,
  isFallback,
  useDbComposer,
  apiFeedSettled,
  apiFeedOk,
  apiFeedError,
  localFeedPosts,
  onPosted,
  onRefreshFeed,
  onRepost,
  onEditMock,
  onDeleteMock,
  rankedEvents,
  homeEventsLoading,
  homeEventsApiError,
  onRetryEvents,
  showConventionPins,
  feedShell = false,
  compactComposer = false,
}: Props) {
  const { viewerDisplayName } = useAuth()
  const feedLoading = isAuthenticated && !isFallback && !apiFeedSettled
  const composerName = viewerDisplayName ?? viewerUsername ?? 'there'
  const composerPlaceholder = feedShell
    ? 'What do you want your local kink community to know?'
    : `What's on your mind, ${composerName}?`

  const viewerInitial = viewerUsername ? viewerUsername.charAt(0).toUpperCase() : '?'

  const composerBlock = feedShell ?
    <HomeMobileComposer
      viewerUsername={viewerUsername}
      viewerInitial={viewerInitial}
      useDbComposer={useDbComposer}
      composerPlaceholder={composerPlaceholder}
      onPosted={onPosted}
      compact={compactComposer}
    />
  : (
    <Panel id="local-home-feed-composer" className="mb-0 border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]">
      <p className="mb-2 text-xs leading-relaxed text-dc-muted">
        Share an update, ask a question, or start a conversation.
      </p>
      <div className="flex gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-dc-accent/25 text-sm font-semibold text-dc-accent ring-2 ring-dc-accent/40">
          {viewerInitial}
        </div>
        <div className="min-w-0 flex-1">
          {useDbComposer ?
            <HomeFeedRichComposer onPosted={onPosted} showQuickActions composerPlaceholder={composerPlaceholder} />
          : <HomeFeedMockComposer
              viewerUsername={viewerUsername}
              onPosted={onPosted}
              showQuickActions
              composerPlaceholder={composerPlaceholder}
            />}
        </div>
      </div>
    </Panel>
  )

  const feedBody =
    feedLoading ?
      <div aria-busy="true" aria-live="polite">
        <FeedCardSkeleton count={3} />
      </div>
    : localFeedPosts.length === 0 ?
      <EmptyState
        inline
        className={`${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass}`}
        icon={
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        title={
          !isAuthenticated || isFallback ?
            'Sign in to see your feed'
          : apiFeedOk ?
            'Nothing local has been posted yet.'
          : 'Could not load your feed'
        }
        message={
          !isAuthenticated || isFallback ?
            'Sign in to post and follow people, or use Explore to find events and groups.'
          : apiFeedOk ?
            'Be the first to start a conversation, or explore people, groups, and events while the local feed warms up.'
          : 'Try again or browse events and groups.'
        }
        actions={
          !isAuthenticated || isFallback ?
            [
              { label: 'Sign in', href: buildLoginHref('/home'), primary: true },
              { label: 'Browse events', href: '/events' },
            ]
          : apiFeedOk ?
            [
              {
                label: 'Write a post',
                onClick: () => {
                  document.getElementById('local-home-feed-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                },
                primary: true,
              },
              { label: 'Find people', href: '/people' },
              { label: 'Explore groups', href: '/groups' },
              { label: 'Browse events', href: '/events' },
            ]
          : [
              { label: 'Try again', onClick: onRefreshFeed, primary: true },
              { label: 'Browse events', href: '/events' },
            ]
        }
      />
    : <div className="feed-stream dc-feed-stagger">
        {localFeedPosts.slice(0, 12).map((post) => (
          <LocalPostCard
            key={post.id}
            post={post}
            layout="feed"
            isOwnPost={!!viewerUsername && post.authorUsername === viewerUsername}
            onEdit={
              post.source === 'mock' && onEditMock ?
                (text) => onEditMock(post.id, text)
              : undefined
            }
            onDelete={post.source === 'mock' && onDeleteMock ? () => onDeleteMock(post.id) : undefined}
            onRepost={apiFeedOk ? onRepost : undefined}
          />
        ))}
      </div>

  const eventsFooter =
    !feedShell && (homeEventsLoading || rankedEvents.length > 0 || homeEventsApiError) ?
      <section className="border-t border-dc-border pt-6" aria-label="Events near you">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-base font-semibold text-dc-text">Events near you</h2>
          <Link
            to="/events"
            className="inline-flex min-h-touch shrink-0 items-center text-sm font-medium text-dc-accent hover:underline"
          >
            See all
          </Link>
        </div>
        {homeEventsLoading ?
          <HomeEventGridSkeleton count={2} />
        : homeEventsApiError ?
          <EmptyState
            inline
            title="Could not load events"
            message="Try again or open the events directory."
            actionLabel="Retry"
            onAction={onRetryEvents}
            secondaryCtaLabel="Events"
            secondaryCtaHref="/events"
          />
        : <div className="grid grid-cols-1 gap-3 sm:max-w-md [&>*]:min-w-0">
            {rankedEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        }
      </section>
    : null

  return (
    <FeedTemplate
      composer={composerBlock}
      tabs={
        <>
          {!feedShell ?
            <FeedScopeTabs showHeading={!compactComposer} />
          : null}
          {!feedShell && showConventionPins ? <ConventionPinsCompact /> : null}
          {apiFeedSettled && !apiFeedOk && isAuthenticated && !isFallback && apiFeedError ?
            <LoadErrorBanner className="mb-4" message={apiFeedError} onRetry={onRefreshFeed} />
          : null}
        </>
      }
      footer={eventsFooter}
      feedFirst={false}
    >
      {feedBody}
    </FeedTemplate>
  )
}
