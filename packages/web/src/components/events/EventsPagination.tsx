import { cn } from '@/lib/cn'

type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  variant?: 'compact' | 'full'
  className?: string
}

function pageButtonClass(active: boolean): string {
  return active ?
      'border-dc-accent bg-dc-accent-muted text-dc-accent'
    : 'border-dc-border text-dc-text-muted hover:text-dc-text'
}

export default function EventsPagination({
  page,
  totalPages,
  onPageChange,
  variant = 'full',
  className,
}: Props) {
  if (totalPages <= 1) return null

  if (variant === 'compact') {
    return (
      <nav
        className={cn('flex flex-wrap items-center gap-2', className)}
        aria-label="Page controls"
      >
        <span className="text-sm text-dc-text-muted">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="min-h-9 rounded-lg border border-dc-border px-2.5 text-xs font-medium disabled:opacity-40 sm:min-h-10 sm:px-3 sm:text-sm"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="min-h-9 rounded-lg border border-dc-border px-2.5 text-xs font-medium disabled:opacity-40 sm:min-h-10 sm:px-3 sm:text-sm"
          >
            Next
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-center gap-2', className)}
      aria-label="Pagination"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="min-h-11 rounded-lg border border-dc-border px-3 text-sm disabled:opacity-40"
      >
        Previous
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPageChange(n)}
          className={`min-h-11 min-w-11 rounded-lg border text-sm ${pageButtonClass(page === n)}`}
        >
          {n}
        </button>
      ))}
      {totalPages > 7 ? <span className="px-1 text-dc-muted">…</span> : null}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="min-h-11 rounded-lg border border-dc-border px-3 text-sm disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  )
}
