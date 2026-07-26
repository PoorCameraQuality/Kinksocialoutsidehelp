import { useMemo } from 'react'
import LocalPostCard from '@/components/cards/LocalPostCard'

import FollowingNetworkHighlights from '@/components/home/FollowingNetworkHighlights'
import { followingFeedItemReason } from '@/lib/following-feed-present'
import HomeFeedRichComposer from '@/components/home/HomeFeedRichComposer'
import HomeMobileComposer from '@/components/home/HomeMobileComposer'
import FeedScopeTabs from '@/components/home/FeedScopeTabs'

import Button from '@/components/ui/Button'

import { Panel } from '@/components/dancecard/ui/Panel'
import TabShell, { TabShellButton } from '@/components/ui/TabShell'

import EmptyState from '@/components/ui/EmptyState'

import LoadErrorBanner from '@/components/ui/LoadErrorBanner'

import { FeedCardSkeleton } from '@/components/ui/skeleton'


import { useFollowingFeed } from '@/hooks/useFollowingFeed'
import { presentFollowingFeedItems } from '@/lib/following-feed-demo'

import {

  FOLLOWING_FILTERS,

  isFollowingFilterComingSoon,

  useFollowingFeedCounts,

  useFollowingFilterPrefs,

} from '@/hooks/useFollowingFilterPrefs'

import { useAuth, useViewerUsername } from '@/contexts/AuthContext'



type Props = {
  onPosted?: () => void
  onRepost?: (originalPostId: string) => void
  feedShell?: boolean
}

export default function FollowingFeedTab({ onPosted, onRepost, feedShell = false }: Props) {

  const viewerUsername = useViewerUsername()
  const { viewerDisplayName } = useAuth()
  const composerName = viewerDisplayName ?? viewerUsername ?? 'there'

  const { filter, setFilter, loaded: filterLoaded } = useFollowingFilterPrefs(true)

  const filterComingSoon = isFollowingFilterComingSoon(filter)

  const feed = useFollowingFeed(!filterComingSoon, filter)

  const counts = useFollowingFeedCounts(true, feed.items.length)

  const presentedItems = useMemo(
    () => (feed.status === 'ready' ? presentFollowingFeedItems(feed.items) : []),
    [feed.items, feed.status],
  )

  // Following hierarchy: posts are the primary stream; activity is folded into a
  // compact "Network highlights" module so the feed reads social, not like a log.
  const postItems = useMemo(
    () => presentedItems.filter((item) => item.kind === 'post'),
    [presentedItems],
  )
  const activityItems = useMemo(
    () =>
      presentedItems.filter(
        (item): item is Extract<typeof item, { kind: 'activity' }> => item.kind === 'activity',
      ),
    [presentedItems],
  )
  // Highlights only belong on the blended "All activity" view. Content-type filters
  // (Posts only, Photos, Articles) return posts and should stay a pure post stream.
  const showHighlights = filter === 'all' && activityItems.length > 0

  const composerPlaceholder = feedShell
    ? 'Share an update, ask a question, or start a conversation…'
    : `What's on your mind, ${composerName}?`
  const composerHint = feedShell ? 'Share an update, ask a question, or start a conversation.' : undefined

  return (
    <div className="w-full dc-panel-enter">
      {feedShell ?
        <HomeMobileComposer
          viewerUsername={viewerUsername ?? ''}
          viewerInitial={viewerUsername ? viewerUsername.charAt(0).toUpperCase() : '?'}
          useDbComposer
          composerPlaceholder={composerPlaceholder}
          composerHint={composerHint}
          onPosted={() => {
            feed.reload()
            onPosted?.()
          }}
        />
      : <section
        id="home-feed-composer"
        className="scroll-mt-24 mb-4"
        aria-label="Share an update"
      >
        <Panel className="border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]">
            <p className="mb-2 text-xs leading-relaxed text-dc-muted">
              Share an update, ask a question, or start a conversation.
            </p>
            <div className="flex gap-3">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-dc-accent/30 text-base font-semibold text-dc-accent"
                aria-hidden
              >
                {viewerUsername ? viewerUsername.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <HomeFeedRichComposer
                  showQuickActions
                  composerPlaceholder={composerPlaceholder}
                  onPosted={() => {
                    feed.reload()
                    onPosted?.()
                  }}
                />
              </div>
            </div>
          </Panel>
      </section>}

      {!feedShell ? <FeedScopeTabs showHeading /> : null}

      {filterLoaded ?
        <TabShell className="mb-4 w-full max-w-full overflow-x-auto" aria-label="Following feed filters">
          {FOLLOWING_FILTERS.map(({ id, label }) => {
            const badge = counts?.[id]
            const showBadge = typeof badge === 'number' && badge > 0 && id !== 'all'
            return (
              <TabShellButton key={id} selected={filter === id} onClick={() => setFilter(id)}>
                {showBadge ? `${label} (${badge})` : label}
              </TabShellButton>
            )
          })}
        </TabShell>
      : null}

      {filterComingSoon ?
        <EmptyState
          inline
          variant="surface"
          align="center"
          className="rounded-2xl border border-dc-border/80 bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
          title="Video feed coming soon"
          message="A dedicated view for video from your connections is on the way. Browse all activity for now, or explore community media channels."
          actions={[
            { label: 'All activity', onClick: () => setFilter('all'), primary: true },
            { label: 'Browse media', href: '/media' },
          ]}
        />
      : null}

      {!filterComingSoon && feed.status === 'loading' ? (
        <div className="mb-4 dc-panel-enter" aria-busy="true" aria-live="polite">
          <p className="mb-3 text-sm text-dc-muted">Loading your feed…</p>
          <FeedCardSkeleton count={4} />
        </div>
      ) : null}

      {!filterComingSoon && feed.status === 'error' && feed.error ? <LoadErrorBanner className="mb-4" message={feed.error} onRetry={() => feed.reload()} /> : null}



      {!filterComingSoon && feed.status === 'ready' && presentedItems.length === 0 ?
        <EmptyState
          inline
          variant="surface"
          align="center"
          className="rounded-2xl border border-dc-border/80 bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]"
          title="Your following feed is waiting for your people."
          message="Follow members and accept connections to fill this tab with their posts and activity — your own posts stay on My Posts and your profile."
          actions={[
            { label: 'Find people', href: '/people', primary: true },
            { label: 'View connections', href: '/connections' },
            { label: 'My Posts', href: '/my-posts' },
            { label: 'Explore groups', href: '/groups' },
            { label: 'Browse events', href: '/events' },
          ]}
        />
      : null}

      {!filterComingSoon && feed.status === 'ready' && showHighlights ?
        <FollowingNetworkHighlights items={activityItems} />
      : null}

      {!filterComingSoon && feed.status === 'ready' && postItems.length > 0 ?
        <p className="mb-3 mt-1 text-sm leading-relaxed text-dc-text-muted">
          {filter === 'posts' ? 'Posts from people you follow, newest first.'
          : 'Posts and conversations from people you follow, newest first.'}
        </p>
      : null}

      {!filterComingSoon ?
        <div className="feed-stream dc-feed-stagger">

        {postItems.map((item) => (
          <LocalPostCard
            key={`post-${item.post.id}`}
            post={item.post}
            layout="feed"
            feedStreamReason={followingFeedItemReason(item)}
            onRepost={onRepost}
          />
        ))}

      </div>
      : null}



      {!filterComingSoon && feed.nextCursor ?

        <div className="mt-6 flex justify-center">

          <Button

            type="button"

            variant="secondary"

            disabled={feed.loadingMore}

            onClick={() => feed.loadMore()}

            className="rounded-xl"

          >

            {feed.loadingMore ? 'Loading…' : 'Load more'}

          </Button>

        </div>

      : null}

    </div>

  )

}

