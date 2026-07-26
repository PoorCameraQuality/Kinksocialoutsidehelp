import { Link } from 'react-router-dom'
import {
  conventionDateRangeLabel,
  enrichConventionForDiscover,
  formatConventionListDateBlock,
} from '@/lib/conventions-page-utils'
import type { HomeConventionRow } from '@/hooks/useHomeSurface'

type Props = {
  convention: HomeConventionRow
}

export default function ConventionsListRow({ convention }: Props) {
  const view = enrichConventionForDiscover(convention)
  const { month, day, year } = formatConventionListDateBlock(convention)
  const href = `/conventions/${encodeURIComponent(convention.slug)}`

  return (
    <article className="flex gap-4 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/40 hover:bg-[var(--dc-elevated-hover)]">
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-3 text-center">
        <span className="text-xs font-bold tracking-wide text-dc-accent">{month}</span>
        <span className="text-xl font-bold leading-none text-dc-text">{day}</span>
        {year ?
          <span className="mt-0.5 text-[10px] font-medium text-dc-muted">{year}</span>
        : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link to={href} className="text-base font-semibold text-dc-text hover:text-dc-accent">
            {convention.name}
          </Link>
          <p className="mt-0.5 text-sm text-dc-accent">{conventionDateRangeLabel(convention)}</p>
          <p className="text-sm text-dc-text-muted">{view.location}</p>
          <p className="mt-1 line-clamp-1 text-xs text-dc-muted">{view.description}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:flex-col sm:items-end">
        <Link
          to={href}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-dc-accent-border px-4 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted"
        >
          View Details
        </Link>
        <Link
          to={`${href}#get-involved`}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-dc-border px-4 text-xs font-semibold text-dc-text-muted hover:text-dc-text"
        >
          Present / apply
        </Link>
        </div>
      </div>
    </article>
  )
}
