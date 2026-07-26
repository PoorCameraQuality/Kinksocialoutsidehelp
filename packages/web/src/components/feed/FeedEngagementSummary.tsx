import { Link } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
import type { ConnectionLikerPreview } from '@/lib/feed-types'
import { formatFeedEngagementSummary } from '@/lib/feed-reaction-ui'
import type { FeedReactionId } from '@c2k/shared'

type Props = {
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  commentCount: number
  connectionPreview?: ConnectionLikerPreview[]
}

export default function FeedEngagementSummary({
  reactionCounts,
  viewerReaction,
  commentCount,
  connectionPreview = [],
}: Props) {
  const text = formatFeedEngagementSummary({
    reactionCounts,
    viewerReaction,
    commentCount,
    connectionPreview,
  })
  if (!text) return null

  const avatars =
    !viewerReaction && connectionPreview.length > 0 && (reactionCounts.love ?? 0) > 0 ?
      connectionPreview.slice(0, 3)
    : []

  return (
    <div className="feed-stream-post__summary">
      {avatars.length > 0 ?
        <span className="feed-stream-post__summary-avatars" aria-hidden>
          {avatars.map((person, i) => (
            <Link
              key={person.username}
              to={`/profile/${encodeURIComponent(person.username)}`}
              style={{ zIndex: i + 1 }}
              title={person.username}
              className="relative inline-flex rounded-full ring-2 ring-[var(--dc-surface-card)]"
            >
              {person.avatarUrl ?
                <img
                  src={person.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  className="h-5 w-5 rounded-full object-cover"
                />
              : <UserAvatar size="sm" className="!h-5 !w-5 !min-h-5 !min-w-5 [&>svg]:!h-2.5 [&>svg]:!w-2.5" />}
            </Link>
          ))}
        </span>
      : null}
      <span>{text}</span>
    </div>
  )
}
