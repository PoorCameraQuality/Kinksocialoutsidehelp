import { Link } from 'react-router-dom'
import LocalPostCard from '@/components/cards/LocalPostCard'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import { apiPostToHomeFeedPost, type ApiFeedPost } from '@/lib/feed-mapper'
import type { GraphStatus } from '@/hooks/useGraphStatus'

type Props = {
  viewerIsOwner: boolean
  viewerUsername: string | null
  profileUsername: string
  items: ApiFeedPost[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  onRetry: () => void
  graphStatus?: GraphStatus | null
  canMessage?: boolean
  onFollow?: () => void
  onConnect?: () => void
  className?: string
}

export default function ProfileRecentPostsSection({
  viewerIsOwner,
  viewerUsername,
  profileUsername,
  items,
  status,
  error,
  onRetry,
  graphStatus,
  canMessage = false,
  onFollow,
  onConnect,
  className = '',
}: Props) {
  const posts = items.map(apiPostToHomeFeedPost)

  const publicActions = [
    onFollow ?
      {
        label: graphStatus?.isFollowing ? 'Following' : 'Follow',
        onClick: onFollow,
        primary: true,
      }
    : { label: 'Find people', href: '/people', primary: true },
    ...(onConnect &&
    graphStatus?.connectionStatus !== 'connected' &&
    graphStatus?.connectionStatus !== 'pending_outgoing' ?
      [{ label: 'Connect', onClick: onConnect }]
    : graphStatus?.connectionStatus !== 'connected' ?
      [{ label: 'Connect', href: '/connections' }]
    : []),
    ...(canMessage ? [{ label: 'Message', href: `/messaging?user=${encodeURIComponent(profileUsername)}` }] : []),
  ]

  return (
    <section
      className={`mb-6 rounded-2xl border border-dc-border bg-dc-elevated/40 p-4 shadow-[var(--dc-shadow-soft)] sm:p-6 ${className}`.trim()}
      aria-label="Recent posts"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-dc-text">Recent posts</h2>
        <p className="mt-1 text-sm text-dc-text-muted">
          {viewerIsOwner ?
            'What you have shared recently with the community.'
          : `What @${profileUsername} has shared recently.`}
        </p>
      </div>

      {status === 'loading' ?
        <FeedCardSkeleton count={2} />
      : status === 'error' && error ?
        <LoadErrorBanner message={error} onRetry={onRetry} />
      : posts.length === 0 ?
        viewerIsOwner ?
          <EmptyState
            inline
            title="Your profile gets richer when you post."
            message="Share an update, ask a question, or start a conversation. Your visible posts can help people understand how you show up in the community."
            actions={[
              {
                label: 'Write a post',
                href: '/home?mode=discover&tab=Local#home-feed-composer',
                primary: true,
              },
              { label: 'Edit profile', href: '/profile/edit' },
              { label: 'Find people', href: '/people' },
            ]}
          />
        : <EmptyState
            inline
            title="No visible posts yet."
            message="This member may not have posted yet, or their posts may only be visible to closer connections."
            actions={publicActions}
          />
      : <div className="feed-stream dc-feed-stagger space-y-3">
          {posts.map((post) => (
            <LocalPostCard
              key={post.id}
              post={post}
              layout="feed"
              isOwnPost={Boolean(viewerUsername && post.authorUsername === viewerUsername)}
            />
          ))}
          {viewerIsOwner ?
            <Link
              to="/my-posts"
              className="inline-flex min-h-10 items-center text-sm font-medium text-dc-accent hover:underline"
            >
              View all your posts
            </Link>
          : null}
        </div>
      }
    </section>
  )
}
