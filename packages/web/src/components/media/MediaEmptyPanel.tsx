import { Link } from 'react-router-dom'
import { buildLoginHref } from '@/lib/auth-links'

type Props = {
  isAuthenticated: boolean
  filtered?: boolean
  onClearFilters?: () => void
}

function Sparkle({ className }: { className?: string }) {
  return (
    <span className={`text-dc-accent/80 ${className ?? ''}`} aria-hidden>
      ✦
    </span>
  )
}

export default function MediaEmptyPanel({ isAuthenticated, filtered, onClearFilters }: Props) {
  if (filtered) {
    return (
      <div
        className="c2k-empty-state-compact rounded-2xl border border-dc-border bg-dc-elevated-solid px-4 py-8 text-center shadow-[var(--dc-shadow-soft)] sm:px-6"
        role="status"
      >
        <p className="text-base font-semibold text-dc-text">No channels match your filters</p>
        <p className="mt-2 text-sm text-dc-text-muted">Try another format, topic, or search with different keywords.</p>
        {onClearFilters ?
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Clear filters
          </button>
        : null}
      </div>
    )
  }

  const submitHref = isAuthenticated ? '/media/submit' : buildLoginHref('/media/submit')

  return (
    <div
      className="c2k-empty-state-compact rounded-2xl border border-dc-border bg-dc-elevated-solid px-4 py-6 text-center shadow-[var(--dc-shadow-soft)] sm:px-6 sm:py-8"
      role="status"
    >
      <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center">
        <Sparkle className="absolute -left-1 top-1 text-sm" />
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-dc-accent-muted ring-1 ring-dc-accent-border/40"
          aria-hidden
        >
          <svg className="h-6 w-6 text-dc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
      </div>
      <p className="text-base font-semibold text-dc-text sm:text-lg">No channels listed yet</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-dc-text-muted">
        Submit a podcast, YouTube channel, or hybrid show for the community directory.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          to={submitHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Submit a channel
        </Link>
        <Link
          to="/education"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-muted px-5 text-sm font-semibold text-dc-text hover:border-dc-accent-border hover:text-dc-accent"
        >
          Browse education
        </Link>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-dc-muted">
        Submissions are reviewed before appearing in the directory.
      </p>
    </div>
  )
}
