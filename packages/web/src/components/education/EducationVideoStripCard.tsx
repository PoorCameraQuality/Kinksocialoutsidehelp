import { Link } from 'react-router-dom'

import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import type { EducationStripVideo } from '@/lib/education-discover-data'

type Props = {
  video: EducationStripVideo
}

export default function EducationVideoStripCard({ video }: Props) {
  const href = video.href ?? `/education/${encodeURIComponent(video.slug)}`

  return (
    <article className="relative w-[min(100%,280px)] shrink-0 overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]">
      <Link to={href} className="block">
        <div className="relative aspect-[16/10] w-full bg-dc-surface-muted">
          {video.thumbnailUrl ?
            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <MediaSurfaceFallback variant="video" label={video.category} />}
          <span className="absolute inset-0 flex items-center justify-center bg-dc-surface/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-dc-accent/90 text-dc-accent-foreground shadow-lg">
              <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          <span className="absolute bottom-2 right-2 rounded-md bg-dc-surface/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-dc-text">
            {video.durationLabel}
          </span>
        </div>
        <div className="p-3">
          <span className="inline-block rounded-md bg-dc-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
            {video.category}
          </span>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-dc-text">{video.title}</h3>
        </div>
      </Link>
    </article>
  )
}
