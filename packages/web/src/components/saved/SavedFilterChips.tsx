import type { SavedFilter } from '@/components/saved/saved-ui'
import { SAVED_FILTERS } from '@/components/saved/saved-ui'

type Props = {
  active: SavedFilter
  counts: Partial<Record<SavedFilter, number>>
  onChange: (filter: SavedFilter) => void
}

export default function SavedFilterChips({ active, counts, onChange }: Props) {
  return (
    <div
      className="mb-6 flex gap-2 overflow-x-auto pb-1 c2k-no-scrollbar"
      role="tablist"
      aria-label="Saved content types"
    >
      {SAVED_FILTERS.map((chip) => {
        const selected = active === chip.id
        const count = counts[chip.id]
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(chip.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selected ?
                'bg-dc-accent text-dc-accent-foreground shadow-[var(--dc-shadow-soft)]'
              : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:border-dc-accent-border hover:text-dc-text'
            }`}
          >
            {chip.label}
            {count != null && count > 0 && chip.id !== 'all' ?
              <span className={selected ? 'opacity-90' : 'text-dc-muted'}> {count}</span>
            : null}
          </button>
        )
      })}
    </div>
  )
}
