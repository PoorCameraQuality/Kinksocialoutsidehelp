import { EVENT_CATEGORY_VALUES } from '@c2k/shared'

type Props = {
  selectedCategories: string[]
  categoryCounts: Map<string, number>
  totalCount: number
  onToggleCategory: (cat: string) => void
  onClearCategories: () => void
}

export default function EventsCategoryChips({
  selectedCategories,
  categoryCounts,
  totalCount,
  onToggleCategory,
  onClearCategories,
}: Props) {
  const noneSelected = selectedCategories.length === 0

  return (
    <div
      className="mb-3 flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Event categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={noneSelected}
        onClick={onClearCategories}
        className={`shrink-0 min-h-9 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          noneSelected ?
            'bg-dc-accent text-dc-accent-foreground'
          : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted'
        }`}
      >
        All {totalCount}
      </button>
      {EVENT_CATEGORY_VALUES.map((cat) => {
        const pressed = selectedCategories.includes(cat)
        const count = categoryCounts.get(cat) ?? 0
        if (count === 0 && !pressed) return null
        return (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={pressed}
            onClick={() => onToggleCategory(cat)}
            className={`shrink-0 min-h-9 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              pressed ?
                'bg-dc-accent text-dc-accent-foreground'
              : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted'
            }`}
          >
            {cat} {count}
          </button>
        )
      })}
    </div>
  )
}
