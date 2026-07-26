import { Link } from 'react-router-dom'
import TagLink from '@/components/TagLink'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'

export type EducationCardProps = {
  article: {
    id?: number | string
    title: string
    category?: string
    readTime?: string
    credibilityScore?: number
    slug?: string
    tags?: string[]
    contentType?: 'article' | 'video' | 'presentation'
    durationLabel?: string
    thumbnailUrl?: string | null
  }
}

export default function EducationCard({ article }: EducationCardProps) {
  const { id, title, category, readTime, credibilityScore, slug, tags, contentType, durationLabel, thumbnailUrl } =
    article
  const href = slug ? `/education/${slug}` : id ? `/education/${id}` : '#'

  return (
    <div className={`relative p-4 ${cardSurfaceSolidClass} ${cardSurfaceInteractiveClass}`}>
      <button
        type="button"
        className="dc-premium-btn absolute right-3 top-3 z-10 rounded-lg p-2 text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)]"
        aria-label="Bookmark"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>

      <div className="pr-11 flex flex-col gap-3">
        <Link to={href} className="block min-w-0">
          <h3 className="font-display text-base font-medium text-dc-text break-words">{title}</h3>
        </Link>

        {thumbnailUrl ? (
          <Link
            to={href}
            className="block w-full aspect-video rounded-xl overflow-hidden bg-dc-elevated-solid border border-dc-border"
            aria-label={title ? `Open: ${title}` : 'Open article'}
          >
            <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </Link>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {category && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-dc-accent/20 text-dc-accent rounded-md">
              {category}
            </span>
          )}
          {contentType && contentType !== 'article' ? (
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-dc-elevated-muted text-dc-text-muted rounded-md capitalize">
              {contentType === 'video' ? 'Video' : 'Presentation'}
            </span>
          ) : null}
          {durationLabel ? (
            <span className="inline-block px-2 py-0.5 text-xs text-dc-muted rounded-md">{durationLabel}</span>
          ) : null}
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <TagLink key={t} tag={t} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dc-muted">
          {readTime && <span>{readTime} read</span>}
          {credibilityScore != null && credibilityScore > 0 && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <svg className="w-4 h-4 flex-shrink-0 text-dc-accent" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{credibilityScore} credibility</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
