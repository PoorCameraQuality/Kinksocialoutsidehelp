import HomeFeedShellComposer from '@/components/home/HomeFeedShellComposer'
import { useMaxMd } from '@/hooks/useMaxMd'
import { cardSurfaceFeedClass } from '@/lib/card-surface'

type Props = {
  viewerUsername: string
  viewerInitial: string
  useDbComposer: boolean
  composerPlaceholder: string
  composerHint?: string
  onPosted: () => void
  compact?: boolean
}

export default function HomeMobileComposer({
  viewerUsername,
  viewerInitial,
  useDbComposer,
  composerPlaceholder,
  composerHint,
  onPosted,
  compact = false,
}: Props) {
  const isMobile = useMaxMd()

  return (
    <section
      id="home-feed-composer"
      className={`scroll-mt-24 ${cardSurfaceFeedClass} ${compact ? 'mb-2 p-2.5' : 'mb-2.5 p-3'}`}
      aria-label="Share with the community"
    >
      <h2 className={`font-semibold text-dc-text ${compact ? 'sr-only' : 'mb-1 text-sm'}`}>Share with the community</h2>
      {composerHint ?
        <p className={`text-dc-muted ${compact ? 'sr-only' : 'mb-2 text-xs leading-relaxed'}`}>{composerHint}</p>
      : null}
      <HomeFeedShellComposer
        viewerUsername={viewerUsername}
        viewerInitial={viewerInitial}
        useDbComposer={useDbComposer}
        composerPlaceholder={composerPlaceholder}
        onPosted={onPosted}
        shell={isMobile ? 'mobile' : 'desktop'}
      />
    </section>
  )
}
