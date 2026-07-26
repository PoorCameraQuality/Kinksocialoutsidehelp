import { Link } from 'react-router-dom'

type MediaItem = {
  url: string
  alt?: string
}

type Props = {
  items: MediaItem[]
  /** Max thumbnails in the strip. */
  limit?: number
  /** When set, each thumbnail links to this destination. */
  href?: string
  className?: string
}

/** Horizontal thumbnail strip for aggregated media activity. */
export default function FeedMediaStrip({ items, limit = 6, href, className = '' }: Props) {
  const visible = items.slice(0, limit)
  if (visible.length === 0) return null
  const overflow = items.length - visible.length

  const thumbClass = 'feed-media-strip__thumb'

  return (
    <div className={`feed-media-strip ${className}`.trim()} aria-label="Media preview">
      {visible.map((item) =>
        href ?
          <Link key={item.url} to={href} className={thumbClass} aria-label="View post">
            <img src={item.url} alt={item.alt ?? ''} loading="lazy" decoding="async" />
          </Link>
        : <div key={item.url} className={thumbClass}>
            <img src={item.url} alt={item.alt ?? ''} loading="lazy" decoding="async" />
          </div>,
      )}
      {overflow > 0 ?
        href ?
          <Link to={href} className="feed-media-strip__more" aria-label={`View post and ${overflow} more`}>
            +{overflow}
          </Link>
        : <div className="feed-media-strip__more" aria-hidden>
            +{overflow}
          </div>
      : null}
    </div>
  )
}
