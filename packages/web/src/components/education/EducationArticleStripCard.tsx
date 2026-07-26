import { Link } from 'react-router-dom'

import type { EducationStripArticle } from '@/lib/education-discover-data'

type Props = {
  article: EducationStripArticle
}

function StripPlaceholder({ category }: { category: string }) {
  return (
    <div
      className="flex h-full flex-col justify-end bg-gradient-to-br from-dc-accent/20 via-dc-surface-muted to-violet-950/40 p-3"
      aria-hidden
    >
      <span className="inline-flex w-fit rounded-md bg-dc-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
        {category}
      </span>
    </div>
  )
}

export default function EducationArticleStripCard({ article }: Props) {
  const href = `/education/${encodeURIComponent(article.slug)}`

  return (
    <article className="relative flex w-[min(82vw,280px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] sm:w-[280px]">
      <Link to={href} className="block">
        <div className="aspect-[16/10] w-full bg-dc-surface-muted">
          {article.thumbnailUrl ?
            <img src={article.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <StripPlaceholder category={article.category} />}
        </div>
        <div className="p-3">
          <span className="inline-block rounded-md bg-dc-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
            {article.category}
          </span>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-dc-text">{article.title}</h3>
          <p className="mt-1 text-xs text-dc-muted">{article.readLabel}</p>
        </div>
      </Link>
      <button
        type="button"
        className="absolute right-2 top-2 rounded-lg bg-dc-elevated-solid/90 p-1.5 text-dc-muted hover:text-dc-accent"
        aria-label="Bookmark article"
        title="Save (coming soon)"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
    </article>
  )
}
