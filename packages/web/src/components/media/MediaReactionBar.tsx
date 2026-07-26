import FeedReactionsRow from '@/components/feed/FeedReactionsRow'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMediaReactions } from '@/hooks/useApiMedia'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
import type { FeedReactionId } from '@c2k/shared'
import { useEffect } from 'react'

type Props = {
  mediaItemId: string
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  compact?: boolean
}

export default function MediaReactionBar({
  mediaItemId,
  reactionCounts,
  viewerReaction,
  compact = false,
}: Props) {
  const { isAuthenticated } = useAuth()
  const reactions = useApiMediaReactions(mediaItemId, { reactionCounts, viewerReaction })

  useEffect(() => {
    reactions.setReactionCounts(reactionCounts)
    reactions.setViewerReaction(viewerReaction)
  }, [mediaItemId, reactionCounts, viewerReaction, reactions.setReactionCounts, reactions.setViewerReaction])

  return (
    <FeedReactionsRow
      compact={compact}
      reactionCounts={reactions.reactionCounts}
      viewerReaction={reactions.viewerReaction}
      busy={reactions.busy}
      disabled={!isAuthenticated}
      onReaction={(kind) => void reactions.toggleReaction(kind)}
    />
  )
}
