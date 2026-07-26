import { Link } from 'react-router-dom'
import type { FollowingFeedItem } from '@/lib/feed-types'
import { followingFeedActorUsername, followingFeedItemReason } from '@/lib/following-feed-present'

type Props = {
  item: FollowingFeedItem
}

export default function FollowingFeedItemContext({ item }: Props) {
  const actor = followingFeedActorUsername(item)
  const reason = followingFeedItemReason(item)

  return (
    <p className="text-xs leading-relaxed text-dc-muted">
      <span className="font-medium text-dc-text-muted">From your connections</span>
      {' · '}
      <Link to={`/profile/${encodeURIComponent(actor)}`} className="font-medium text-dc-accent hover:underline">
        @{actor}
      </Link>
      {' · '}
      {reason}
    </p>
  )
}
