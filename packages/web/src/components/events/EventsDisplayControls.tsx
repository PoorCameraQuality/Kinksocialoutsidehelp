export type EventsSortMode = 'upcoming' | 'relevance' | 'new'
export type EventsViewMode = 'list' | 'grid'

type Props = {
  sortMode: EventsSortMode
  onSortModeChange: (mode: EventsSortMode) => void
  viewMode: EventsViewMode
  onViewModeChange: (mode: EventsViewMode) => void
  sortId?: string
  /** Toolbar row vs right-rail stack */
  layout?: 'inline' | 'stacked'
}

const selectClass =
  'min-h-11 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent'

export default function EventsDisplayControls({
  sortMode,
  onSortModeChange,
  viewMode,
  onViewModeChange,
  sortId = 'events-sort',
  layout = 'inline',
}: Props) {
  const sortSelect = (
    <>
      <label className="sr-only" htmlFor={sortId}>
        Sort events
      </label>
      <select
        id={sortId}
        value={sortMode}
        onChange={(e) => onSortModeChange(e.target.value as EventsSortMode)}
        className={layout === 'stacked' ? `${selectClass} w-full` : `${selectClass} w-auto max-w-[10.5rem] shrink-0`}
      >
        <option value="upcoming">Sort: Upcoming</option>
        <option value="relevance">Sort: Popular</option>
        <option value="new">Sort: Newest</option>
      </select>
    </>
  )

  const viewToggle = (
    <div
      className={
        layout === 'stacked' ?
          'inline-flex w-full rounded-xl border border-dc-border bg-dc-elevated-solid p-1'
        : 'inline-flex shrink-0 rounded-xl border border-dc-border bg-dc-elevated-solid p-1'
      }
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        aria-pressed={viewMode === 'grid'}
        onClick={() => onViewModeChange('grid')}
        className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-medium ${viewMode === 'grid' ? 'bg-dc-accent-muted text-dc-accent' : 'text-dc-muted'}`}
      >
        Grid
      </button>
      <button
        type="button"
        aria-pressed={viewMode === 'list'}
        onClick={() => onViewModeChange('list')}
        className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-medium ${viewMode === 'list' ? 'bg-dc-accent-muted text-dc-accent' : 'text-dc-muted'}`}
      >
        List
      </button>
    </div>
  )

  if (layout === 'stacked') {
    return (
      <div className="space-y-2">
        {sortSelect}
        {viewToggle}
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {sortSelect}
      {viewToggle}
    </div>
  )
}
