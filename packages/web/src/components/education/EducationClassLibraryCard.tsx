import { Link } from 'react-router-dom'

import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { CLASS_FORMAT_META, type EducationClassOutline } from '@/lib/education-class-library'

type Props = {
  outline: EducationClassOutline
  layout?: 'grid' | 'featured'
}

export default function EducationClassLibraryCard({ outline, layout = 'grid' }: Props) {
  const formatMeta = CLASS_FORMAT_META[outline.format]
  const educator = outline.educatorName ?? `@${outline.educatorHandle}`
  const featured = layout === 'featured'

  return (
    <article
      className={`edu-class-card group ${featured ? 'edu-class-card--featured' : 'edu-class-card--grid'}`}
    >
      <Link
        to={outline.href}
        className="edu-class-card__media block"
        tabIndex={-1}
        aria-hidden
      >
        {outline.heroImageUrl ?
          <img src={outline.heroImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        : <MediaSurfaceFallback variant="article" label={outline.topic} />}
      </Link>

      <div className="edu-class-card__body">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-dc-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
            <span aria-hidden>{formatMeta.icon}</span>
            {formatMeta.label}
          </span>
          <span className="rounded-full border border-dc-border px-2 py-0.5 text-[10px] font-medium text-dc-text-muted">
            {outline.level}
          </span>
          {outline.featured ?
            <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">
              Popular
            </span>
          : null}
        </div>

        <Link to={outline.href} className="block min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-dc-text transition-colors group-hover:text-dc-accent">
            {outline.title}
          </h3>
        </Link>

        <p className="mt-1 text-xs text-dc-muted">
          {educator} · {outline.durationLabel} · {outline.sectionCount} sections
        </p>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-dc-text-muted">{outline.summary}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {outline.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-dc-border bg-dc-elevated-muted/70 px-2 py-0.5 text-[10px] font-medium text-dc-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="edu-class-card__footer">
          <span className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">{outline.topic}</span>
          <span className="text-xs font-semibold text-dc-accent">View outline →</span>
        </div>
      </div>
    </article>
  )
}
