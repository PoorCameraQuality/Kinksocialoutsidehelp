import type { ExploreActiveFilterPill } from '@/lib/explore-hub'

type Props = {
  pills: ExploreActiveFilterPill[]
  onRemove: (pill: ExploreActiveFilterPill) => void
}

export default function ExploreActiveFilterPills({ pills, onRemove }: Props) {
  if (!pills.length) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-dc-muted">Active filters</p>
      <div className="flex flex-wrap gap-2" role="list" aria-label="Active filters">
        {pills.map((pill) => (
          <span key={pill.id} role="listitem" className="xpl-filter-pill">
            {pill.label}
            <button
              type="button"
              onClick={() => onRemove(pill)}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-dc-muted hover:text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
              aria-label={`Remove ${pill.label} filter`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
