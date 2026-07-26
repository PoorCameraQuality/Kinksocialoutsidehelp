import { Link } from 'react-router-dom'
import type { TrendingItemCardModel } from '@/components/home/TrendingItemCard'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { trendingKindLabel } from '@/lib/explore-hub'

type Props = {
  item: TrendingItemCardModel
}

export default function ExploreCompactTrendingRow({ item }: Props) {
  return (
    <li>
      <Link
        to={item.href}
        className="xpl-row-card xpl-row-card--subtle p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-dc-border bg-dc-elevated-solid">
          {item.imageUrl ?
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <MediaSurfaceFallback variant="generic" className="h-full min-h-0 rounded-none" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">{trendingKindLabel(item.kind)}</p>
          <p className="text-sm font-medium text-dc-text line-clamp-2">{item.title}</p>
          {item.subtitle ?
            <p className="text-xs text-dc-text-muted line-clamp-2 mt-0.5">{item.subtitle}</p>
          : null}
        </div>
      </Link>
    </li>
  )
}
