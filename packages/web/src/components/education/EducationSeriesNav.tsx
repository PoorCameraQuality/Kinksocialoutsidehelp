import { Link } from 'react-router-dom'

import type { EducationSeriesContext } from '@/hooks/useApiEducationSeries'

type Props = {
  context: EducationSeriesContext
  className?: string
}

export default function EducationSeriesNav({ context, className = '' }: Props) {
  const { seriesSlug, seriesTitle, partNumber, totalParts, prevSlug, nextSlug } = context

  return (
    <nav
      aria-label="Article series"
      className={`rounded-xl border border-dc-border bg-dc-elevated/90 px-4 py-3 ${className}`.trim()}
    >
      <p className="text-sm text-dc-text-muted">
        <Link
          to={`/education/series/${encodeURIComponent(seriesSlug)}`}
          className="font-medium text-dc-accent hover:underline"
        >
          {seriesTitle}
        </Link>
        <span className="text-dc-muted">
          {' '}
          · Part {partNumber} of {totalParts}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {prevSlug ?
          <Link
            to={`/education/${encodeURIComponent(prevSlug)}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm text-dc-text hover:border-dc-accent-border/40"
          >
            ← Previous
          </Link>
        : null}
        {nextSlug ?
          <Link
            to={`/education/${encodeURIComponent(nextSlug)}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm text-dc-text hover:border-dc-accent-border/40"
          >
            Next →
          </Link>
        : null}
        <Link
          to={`/education/series/${encodeURIComponent(seriesSlug)}`}
          className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-dc-accent hover:underline"
        >
          View full series
        </Link>
      </div>
    </nav>
  )
}
