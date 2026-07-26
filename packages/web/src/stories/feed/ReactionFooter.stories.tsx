import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import FeedPostActionBar from '@/components/feed/FeedPostActionBar'
import FeedReactionPicker from '@/components/feed/FeedReactionPicker'
import { emptyFeedReactionCounts, type FeedReactionId } from '@c2k/shared'
import { storyReactionCounts } from '@/stories/mocks/feed'

const meta = {
  title: 'Feed/Reaction Footer',
  component: FeedPostActionBar,
  parameters: { providers: { maxWidth: '640px' } },
} satisfies Meta<typeof FeedPostActionBar>

export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  commentCount: 0,
  commentHref: '/share/post/story-post-1#discuss',
  shareHref: '/share/post/story-post-1',
  onReaction: () => {},
}

export const NoEngagement: Story = {
  args: {
    ...baseArgs,
    reactionCounts: emptyFeedReactionCounts(),
    viewerReaction: null,
  },
}

export const ReactionsSummary: Story = {
  args: {
    ...baseArgs,
    reactionCounts: storyReactionCounts(null),
    viewerReaction: null,
    commentCount: 5,
  },
}

export const ViewerLove: Story = {
  args: { ...baseArgs, reactionCounts: storyReactionCounts('love'), viewerReaction: 'love' },
}

export const ViewerRespect: Story = {
  args: { ...baseArgs, reactionCounts: storyReactionCounts('respect'), viewerReaction: 'respect' },
}

export const ViewerSympathize: Story = {
  args: { ...baseArgs, reactionCounts: storyReactionCounts('sympathize'), viewerReaction: 'sympathize' },
}

export const ViewerHelpful: Story = {
  args: { ...baseArgs, reactionCounts: storyReactionCounts('helpful'), viewerReaction: 'helpful' },
}

export const PickerOpenDesktop: Story = {
  args: {
    ...baseArgs,
    reactionCounts: storyReactionCounts(null),
    viewerReaction: null,
  },
  render: function Render() {
    const anchorRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(true)
    const [viewerReaction, setViewerReaction] = useState<FeedReactionId | null>(null)
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4">
        <FeedPostActionBar
          reactionCounts={storyReactionCounts(viewerReaction)}
          viewerReaction={viewerReaction}
          onReaction={(kind) => {
            setViewerReaction(kind)
            setOpen(false)
          }}
          commentCount={2}
          commentHref="/share/post/story-post-1#discuss"
          shareHref="/share/post/story-post-1"
        />
        <div ref={anchorRef} className="hidden" />
        <FeedReactionPicker
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={anchorRef.current}
          viewerReaction={viewerReaction}
          onSelect={(kind) => {
            setViewerReaction(kind)
            setOpen(false)
          }}
        />
        <p className="mt-3 text-xs text-dc-muted">Use the React button in the action bar to toggle the picker in dev.</p>
      </div>
    )
  },
}

export const PickerOpenMobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  args: {
    ...baseArgs,
    reactionCounts: storyReactionCounts(null),
    viewerReaction: null,
  },
  render: function Render() {
    const anchorRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(true)
    const [viewerReaction, setViewerReaction] = useState<FeedReactionId | null>(null)
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4">
        <FeedPostActionBar
          reactionCounts={storyReactionCounts(viewerReaction)}
          viewerReaction={viewerReaction}
          onReaction={(kind) => {
            setViewerReaction(kind)
            setOpen(false)
          }}
          commentCount={2}
          commentHref="/share/post/story-post-1#discuss"
          shareHref="/share/post/story-post-1"
        />
        <div ref={anchorRef} className="hidden" />
        <FeedReactionPicker
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={anchorRef.current}
          viewerReaction={viewerReaction}
          onSelect={(kind) => {
            setViewerReaction(kind)
            setOpen(false)
          }}
        />
        <p className="mt-3 text-xs text-dc-muted">
          Below 768px the picker uses a bottom sheet (not the desktop popover). Tap React to toggle.
        </p>
      </div>
    )
  },
}

export const Mobile390: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
  args: {
    ...baseArgs,
    reactionCounts: storyReactionCounts('love'),
    viewerReaction: 'love',
    commentCount: 3,
  },
}
