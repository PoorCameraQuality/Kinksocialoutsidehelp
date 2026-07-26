import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import HomeFeedMockComposer from '@/components/home/HomeFeedMockComposer'
import HomeFeedRichComposer from '@/components/home/HomeFeedRichComposer'
import FeedComposerQuickActions from '@/components/home/FeedComposerQuickActions'
import ComposerAvatar from '@/components/home/ComposerAvatar'
import { useFeedComposerEngagement } from '@/contexts/FeedComposerUiContext'

type Props = {
  viewerUsername: string
  viewerInitial: string
  useDbComposer: boolean
  composerPlaceholder: string
  onPosted: () => void
  shell: 'mobile' | 'desktop'
}

function CollapsedComposerTrigger({
  placeholder,
  onActivate,
}: {
  placeholder: string
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex min-h-10 min-w-0 flex-1 items-center rounded-full border border-dc-border/70 bg-dc-elevated-muted px-4 text-left text-sm text-dc-muted transition-colors hover:border-dc-accent-border/40 hover:bg-dc-elevated-hover hover:text-dc-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface"
    >
      {placeholder}
    </button>
  )
}

export default function HomeFeedShellComposer({
  viewerUsername,
  viewerInitial,
  useDbComposer,
  composerPlaceholder,
  onPosted,
  shell,
}: Props) {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (location.hash === '#home-feed-composer') {
      setOpen(true)
    }
  }, [location.hash])

  const handlePosted = useCallback(() => {
    setOpen(false)
    onPosted()
  }, [onPosted])

  const collapsed = (shell === 'mobile' || shell === 'desktop') && !open

  useFeedComposerEngagement(shell === 'mobile' || open)

  if (collapsed) {
    return (
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <ComposerAvatar initial={viewerInitial} />
          <CollapsedComposerTrigger placeholder={composerPlaceholder} onActivate={() => setOpen(true)} />
        </div>
        <FeedComposerQuickActions
          variant={shell === 'mobile' ? 'home-mobile' : 'home-desktop'}
          onPhoto={() => setOpen(true)}
        />
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-start gap-2.5">
        <ComposerAvatar initial={viewerInitial} />
        <div className="min-w-0 flex-1">
          {useDbComposer ?
            <HomeFeedRichComposer
              onPosted={handlePosted}
              showQuickActions
              compact
              shellMode={shell}
              composerPlaceholder={composerPlaceholder}
            />
          : <HomeFeedMockComposer
              viewerUsername={viewerUsername}
              onPosted={handlePosted}
              showQuickActions
              compact
              shellMode={shell}
              composerPlaceholder={composerPlaceholder}
            />}
        </div>
      </div>
    </div>
  )
}
