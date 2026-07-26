import { Link } from 'react-router-dom'
import type { MediaItemSummary } from '@c2k/shared'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type Props = {
  item: MediaItemSummary
  blurred?: boolean
  className?: string
}

export default function MediaCard({ item, blurred = false, className }: Props) {
  const preview = mediaDisplayUrl(
    blurred && item.blurredPreviewUrl ? item.blurredPreviewUrl : item.previewUrl ?? item.blurredPreviewUrl,
  )

  return (
    <Link
      to={`/media/item/${item.id}`}
      className={cn(cardSurfaceSolidClass, cardSurfaceInteractiveClass, 'group block overflow-hidden', className)}
    >
      <div className="relative aspect-square bg-dc-elevated-solid">
        {preview ?
          <img
            src={preview}
            alt={item.caption ?? ''}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-transform group-hover:scale-[1.02] ${blurred ? 'blur-md scale-105' : ''}`}
          />
        : <div className="flex h-full items-center justify-center text-xs text-dc-muted">No preview</div>}
        {item.mediaKind === 'video' ?
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            Video
          </span>
        : null}
        {blurred ?
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-xs font-medium text-white">
            Adult content
          </span>
        : null}
      </div>
      {item.caption ?
        <p className="line-clamp-2 px-3 py-2 text-xs text-dc-text-muted">{item.caption}</p>
      : null}
    </Link>
  )
}
