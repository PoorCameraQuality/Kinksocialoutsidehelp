import { ISO_APPROACH, ISO_ROLE_TAGS } from '@c2k/shared'
import type { IsoBoardFilters } from '@/lib/iso-board-view'

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-sm font-medium ${
        selected
          ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
          : 'border-dc-border bg-dc-elevated text-dc-muted'
      }`}
    >
      {selected ? `✓ ${label}` : label}
    </button>
  )
}

export default function IsoBoardFilterSheet({
  open,
  filters,
  commonTags,
  matchCount,
  onChange,
  onClear,
  onClose,
}: {
  open: boolean
  filters: IsoBoardFilters
  commonTags: { id: string; label: string }[]
  matchCount: number
  onChange: (next: IsoBoardFilters) => void
  onClear: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-dc-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Filter ISO board"
    >
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          ‹ Board
        </button>
        <p className="text-sm font-semibold text-dc-text">Filter ISO board</p>
        <button type="button" onClick={onClear} className="min-h-11 px-2 text-sm font-medium text-dc-accent">
          Clear
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-28">
        <div>
          <label className="block text-[13px] font-medium text-dc-text mb-2">Search</label>
          <input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="People or scene ideas"
            className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Role</p>
          <div className="flex flex-wrap gap-2">
            {ISO_ROLE_TAGS.map((r) => (
              <Chip
                key={r.id}
                label={r.label}
                selected={filters.roles.includes(r.id)}
                onClick={() => onChange({ ...filters, roles: toggle(filters.roles, r.id) })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Approach</p>
          <div className="flex flex-wrap gap-2">
            {ISO_APPROACH.map((a) => (
              <Chip
                key={a.id}
                label={a.id === 'dms_open' ? 'DMs open' : a.id === 'ask_first' ? 'Ask first' : a.id === 'in_person' ? 'In person' : 'Visual signal'}
                selected={filters.approaches.includes(a.id)}
                onClick={() => onChange({ ...filters, approaches: toggle(filters.approaches, a.id) })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Scene ideas</p>
          <Chip
            label="Has scene ideas"
            selected={filters.hasSceneIdeas}
            onClick={() => onChange({ ...filters, hasSceneIdeas: !filters.hasSceneIdeas })}
          />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-dc-text">Messages</p>
          <Chip
            label="DMs open"
            selected={filters.dmsOpen}
            onClick={() => onChange({ ...filters, dmsOpen: !filters.dmsOpen })}
          />
        </div>

        {commonTags.length ? (
          <div>
            <p className="mb-2 text-[13px] font-medium text-dc-text">Common interests</p>
            <div className="flex flex-wrap gap-2">
              {commonTags.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  selected={filters.tags.includes(t.id)}
                  onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t.id) })}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-dc-border bg-dc-elevated px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
        >
          Show {matchCount}
        </button>
      </div>
    </div>
  )
}
