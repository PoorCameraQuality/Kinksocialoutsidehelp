type StatusOption = { value: string; label: string }

type Props = {
  searchId: string
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  statusOptions: StatusOption[]
  dateStart: string
  dateEnd: string
  onDateStartChange: (value: string) => void
  onDateEndChange: (value: string) => void
  showStatus?: boolean
}

export default function EventsPersonalCompactFilters({
  searchId,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
  showStatus = true,
}: Props) {
  return (
    <div
      className={`mb-4 grid gap-3 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 ${
        showStatus ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      <div className={showStatus ? 'sm:col-span-2 lg:col-span-2' : 'sm:col-span-2'}>
        <label htmlFor={searchId} className="mb-1 block text-xs font-medium text-dc-text-muted">
          Search within my events
        </label>
        <input
          id={searchId}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Title or keyword…"
          className="w-full min-h-10 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text placeholder-dc-muted focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent"
        />
      </div>
      {showStatus ?
        <div>
          <label htmlFor={`${searchId}-status`} className="mb-1 block text-xs font-medium text-dc-text-muted">
            Status
          </label>
          <select
            id={`${searchId}-status`}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      : null}
      <div className={`grid grid-cols-2 gap-2 ${showStatus ? 'sm:col-span-2 lg:col-span-1' : 'sm:col-span-2'}`}>
        <div>
          <label htmlFor={`${searchId}-start`} className="mb-1 block text-xs font-medium text-dc-text-muted">
            From
          </label>
          <input
            id={`${searchId}-start`}
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-dc-border bg-[var(--dc-input)] px-2 text-sm text-dc-text"
          />
        </div>
        <div>
          <label htmlFor={`${searchId}-end`} className="mb-1 block text-xs font-medium text-dc-text-muted">
            To
          </label>
          <input
            id={`${searchId}-end`}
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="w-full min-h-10 rounded-xl border border-dc-border bg-[var(--dc-input)] px-2 text-sm text-dc-text"
          />
        </div>
      </div>
    </div>
  )
}
