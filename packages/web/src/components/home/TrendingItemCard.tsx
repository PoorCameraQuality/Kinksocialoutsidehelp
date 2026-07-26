import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/cn'

export type TrendingItemCardModel = {
  kind: string
  id: string
  title: string
  subtitle?: string
  href: string
  imageUrl?: string | null
  /** Shown when there is no image (e.g. voice post). */
  audioPreviewUrl?: string | null
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ')
}

const linkFocusClasses =
  'block min-w-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface-card'

function TrendingCardBody({
  item,
  showAudio,
  titleClassName,
}: {
  item: TrendingItemCardModel
  showAudio: boolean
  titleClassName: string
}) {
  return (
    <>
      <Badge variant="neutral" className="w-fit">
        {kindLabel(item.kind)}
      </Badge>
      <p className={titleClassName}>{item.title}</p>
      {item.subtitle ?
        <p className="text-sm text-dc-text-muted break-words line-clamp-2 leading-snug">{item.subtitle}</p>
      : null}
      {showAudio ?
        <audio
          controls
          preload="metadata"
          src={item.audioPreviewUrl!}
          className="mt-1 h-9 w-full max-w-full rounded-lg sm:h-10"
          onClick={(e) => e.stopPropagation()}
        />
      : null}
    </>
  )
}

export default function TrendingItemCard({ item }: { item: TrendingItemCardModel }) {
  const hasHeroImage = Boolean(item.imageUrl)
  const showAudio = Boolean(item.audioPreviewUrl) && !hasHeroImage

  if (!hasHeroImage) {
    return (
      <Card
        padding="sm"
        className="transition-colors hover:border-dc-accent-border/40 sm:p-4"
      >
        <Link to={item.href} className={cn(linkFocusClasses, 'flex flex-col gap-2')}>
          <TrendingCardBody
            item={item}
            showAudio={showAudio}
            titleClassName="text-base font-semibold leading-snug text-dc-text break-words line-clamp-6"
          />
        </Link>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0 transition-colors hover:border-dc-accent-border/40">
      <Link to={item.href} className={cn(linkFocusClasses, 'flex flex-col')}>
        <div className="aspect-video max-h-36 w-full overflow-hidden border-b border-dc-border bg-dc-elevated-solid sm:max-h-44 md:max-h-56">
          <img
            src={item.imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex flex-col gap-2 p-3 sm:gap-3 sm:p-4">
          <TrendingCardBody
            item={item}
            showAudio={false}
            titleClassName="font-semibold leading-snug text-dc-text break-words line-clamp-3 sm:line-clamp-4"
          />
        </div>
      </Link>
    </Card>
  )
}
