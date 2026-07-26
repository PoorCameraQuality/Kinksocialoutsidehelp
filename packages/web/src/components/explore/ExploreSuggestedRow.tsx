import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { ExploreSuggestedItem } from '@/lib/explore-hub'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  item: ExploreSuggestedItem
}

export default function ExploreSuggestedRow({ item }: Props) {
  const thumb = mediaDisplayUrl(item.imageUrl ?? null)

  return (
    <li>
      <Link
        to={item.href}
        className="xpl-suggest-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-dc-border bg-dc-elevated-solid ring-1 ring-white/[0.06]">
          {thumb ?
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <PlaceholderAvatar size="sm" className="h-11 w-11" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">{item.type}</p>
          <p className="text-sm font-medium text-dc-text truncate">{item.name}</p>
          <p className="text-xs leading-snug text-dc-text-muted line-clamp-2">{item.reason}</p>
        </div>
      </Link>
    </li>
  )
}
