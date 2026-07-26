import { useRef, useState } from 'react'
import FeedEngagementSummary from '@/components/feed/FeedEngagementSummary'
import FeedReactionPicker from '@/components/feed/FeedReactionPicker'
import {
  IconDiscuss,
  IconLove,
  IconShare,
} from '@/components/feed/FeedInteractionIcons'
import FeedTapControl from '@/components/feed/FeedTapControl'
import { FEED_ACTION_LABELS, type FeedReactionId } from '@c2k/shared'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
import type { ConnectionLikerPreview } from '@/lib/feed-types'
import { FEED_REACTION_OPTIONS, feedReactionPastLabel } from '@/lib/feed-reaction-ui'
import { cn } from '@/lib/cn'

type Props = {
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  reactionBusy?: boolean
  reactionDisabled?: boolean
  onReaction: (kind: FeedReactionId) => void
  commentCount: number
  commentHref?: string
  commentDisabled?: boolean
  shareHref?: string
  shareDisabled?: boolean
  connectionPreview?: ConnectionLikerPreview[]
}

function ReactActionIcon({
  viewerReaction,
  className,
}: {
  viewerReaction: FeedReactionId | null
  className?: string
}) {
  const active = FEED_REACTION_OPTIONS.find((r) => r.id === viewerReaction)
  const Icon = active?.Icon ?? IconLove
  return <Icon className={className} />
}

export default function FeedPostActionBar({
  reactionCounts,
  viewerReaction,
  reactionBusy,
  reactionDisabled,
  onReaction,
  commentCount,
  commentHref,
  commentDisabled,
  shareHref,
  shareDisabled,
  connectionPreview,
}: Props) {
  const reactAnchorRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const reactLabel = viewerReaction ? feedReactionPastLabel(viewerReaction) : 'React'

  return (
    <>
      <FeedEngagementSummary
        reactionCounts={reactionCounts}
        viewerReaction={viewerReaction}
        commentCount={commentCount}
        connectionPreview={connectionPreview}
      />

      <div className="feed-action-bar" role="group" aria-label="Post interactions">
        <div className="feed-action-bar__track">
          <div ref={reactAnchorRef} className="feed-action-bar__react-anchor">
            <FeedTapControl
              disabled={reactionDisabled || reactionBusy}
              ringOnTap
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              aria-pressed={!!viewerReaction}
              onClick={() => setPickerOpen((v) => !v)}
              className={cn(
                'feed-action-bar__btn feed-action-bar__btn--react',
                viewerReaction && 'feed-action-bar__btn--react-active',
              )}
              aria-label={
                viewerReaction ?
                  `${reactLabel}. Change reaction`
                : 'React to this post'
              }
              title={viewerReaction ? 'Change reaction' : 'React to this post'}
            >
              <ReactActionIcon viewerReaction={viewerReaction} className="h-4 w-4 shrink-0" />
              <span className="feed-action-bar__label">{reactLabel}</span>
            </FeedTapControl>
          </div>

          {commentHref && !commentDisabled ?
            <FeedTapControl
              as="link"
              to={commentHref}
              className="feed-action-bar__btn"
              aria-label="Comment on this post"
              title="View and add comments"
            >
              <IconDiscuss className="h-4 w-4 shrink-0" />
              <span className="feed-action-bar__label">{FEED_ACTION_LABELS.discuss}</span>
            </FeedTapControl>
          : (
            <FeedTapControl
              disabled
              className="feed-action-bar__btn opacity-70"
              aria-label="Comments unavailable"
            >
              <IconDiscuss className="h-4 w-4 shrink-0" />
              <span className="feed-action-bar__label">{FEED_ACTION_LABELS.discuss}</span>
            </FeedTapControl>
          )}

          {shareHref && !shareDisabled ?
            <FeedTapControl as="link" to={shareHref} className="feed-action-bar__btn" aria-label="Share post">
              <IconShare className="h-4 w-4 shrink-0" />
              <span className="feed-action-bar__label">Share</span>
            </FeedTapControl>
          : (
            <FeedTapControl disabled className="feed-action-bar__btn opacity-70" aria-label="Share unavailable">
              <IconShare className="h-4 w-4 shrink-0" />
              <span className="feed-action-bar__label">Share</span>
            </FeedTapControl>
          )}
        </div>
      </div>

      <FeedReactionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        anchorEl={reactAnchorRef.current}
        viewerReaction={viewerReaction}
        busy={reactionBusy}
        onSelect={onReaction}
      />
    </>
  )
}
