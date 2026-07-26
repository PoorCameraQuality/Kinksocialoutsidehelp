import { Link, Navigate, useParams } from 'react-router-dom'

import EmptyState from '@/components/ui/EmptyState'
import { useApiEducationSeriesBySlug } from '@/hooks/useApiEducationSeries'

function formatReadTime(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes < 1) return null
  return `${minutes} min read`
}

export default function EducationSeriesPage() {
  const { slug } = useParams()
  const { status, data, error, reload } = useApiEducationSeriesBySlug(slug)

  if (!slug?.trim()) {
    return <Navigate to="/education" replace />
  }

  if (status === 'ready' && !data && !error) {
    return <Navigate to="/education" replace />
  }

  const series = data?.series
  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-dc-text-muted">
        <Link to="/education" className="hover:text-dc-accent hover:underline">
          Education
        </Link>
        <span className="mx-1.5 text-dc-muted">/</span>
        <span className="text-dc-text font-medium">{series?.title ?? 'Series'}</span>
      </nav>

      {error ?
        <EmptyState
          inline
          className="rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
          title="Could not load series"
          message={error}
          actionLabel="Retry"
          onAction={reload}
          secondaryCtaLabel="Education hub"
          secondaryCtaHref="/education"
        />
      : status === 'loading' || status === 'idle' ?
        <div aria-busy="true" role="status" className="space-y-3">
          <div className="h-10 w-2/3 animate-pulse rounded-xl bg-dc-elevated-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        </div>
      : series ?
        <>
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-dc-text sm:text-3xl">{series.title}</h1>
            {series.description ?
              <p className="mt-2 text-sm text-dc-text-muted leading-relaxed">{series.description}</p>
            : null}
            {series.authorUsername ?
              <p className="mt-3 text-sm text-dc-text-muted">
                By{' '}
                <Link
                  to={`/presenters/${encodeURIComponent(series.authorUsername)}`}
                  className="font-medium text-dc-accent hover:underline"
                >
                  {series.authorDisplayName?.trim() || series.authorUsername}
                </Link>
              </p>
            : null}
            <p className="mt-2 text-xs text-dc-muted">
              {items.length} part{items.length === 1 ? '' : 's'} · read in order
            </p>
          </header>

          <ol className="space-y-3">
            {items.map((item, index) => {
              const readLabel = formatReadTime(item.readingMinutes)
              return (
                <li key={item.slug}>
                  <Link
                    to={`/education/${encodeURIComponent(item.slug)}`}
                    className="flex gap-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-sm font-semibold text-dc-accent">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dc-text">{item.title}</p>
                      {item.excerpt ?
                        <p className="mt-1 line-clamp-2 text-sm text-dc-text-muted">{item.excerpt}</p>
                      : null}
                      <p className="mt-2 text-xs text-dc-muted">
                        {[readLabel, item.difficulty].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </>
      : null}
    </div>
  )
}
