import { GROUP_PURPOSE_FILTERS, type GroupPurposeFilter } from '@/lib/groups-page-utils'
import { GROUP_CATEGORIES } from '@c2k/shared'

const PRIMARY: { label: string; purpose?: GroupPurposeFilter }[] = [
  { label: 'Education', purpose: GROUP_CATEGORIES.education },
  { label: 'Social', purpose: GROUP_CATEGORIES.social },
  { label: 'Support', purpose: 'Support' },
]

const MORE: GroupPurposeFilter[] = GROUP_PURPOSE_FILTERS.filter(
  (p) => p !== GROUP_CATEGORIES.education && p !== GROUP_CATEGORIES.social && p !== 'Support',
)

type Props = {
  selected: GroupPurposeFilter[]
  onToggle: (p: GroupPurposeFilter) => void
  moreOpen: boolean
  onMoreToggle: () => void
}

export default function GroupsPurposeChips({ selected, onToggle, moreOpen, onMoreToggle }: Props) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRIMARY.map((chip) => {
          const p = chip.purpose!
          const on = selected.includes(p)
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onToggle(p)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent ${
                on ?
                  'border border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:border-dc-accent-border/40 hover:text-dc-text'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onMoreToggle}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent ${
            moreOpen ?
              'border border-dc-accent-border bg-dc-accent-muted/60 text-dc-accent'
            : 'border border-dc-border text-dc-text-muted hover:border-dc-accent-border/40 hover:text-dc-text'
          }`}
          aria-expanded={moreOpen}
        >
          More filters
        </button>
      </div>
      {moreOpen ?
        <div className="flex flex-wrap gap-2 rounded-xl border border-dc-border bg-dc-surface-muted/40 p-3">
          {MORE.map((p) => {
            const on = selected.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() => onToggle(p)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent ${
                  on ?
                    'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                  : 'border-transparent text-dc-text-muted hover:border-dc-border hover:text-dc-text'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>
      : null}
    </div>
  )
}
