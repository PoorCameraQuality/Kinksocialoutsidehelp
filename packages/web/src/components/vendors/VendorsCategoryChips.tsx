import { VENDOR_CATEGORY_DESCRIPTIONS } from '@c2k/shared'

import { VENDOR_CATEGORY_VALUES } from '@/lib/vendor-filters'



type Props = {

  selectedCategory: string | null

  categoryCounts: Record<string, number>

  totalCount: number

  onCategoryChange: (cat: string | null) => void

}



export default function VendorsCategoryChips({

  selectedCategory,

  categoryCounts,

  totalCount,

  onCategoryChange,

}: Props) {

  return (

    <div

      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin lg:hidden"

      role="tablist"

      aria-label="Vendor categories"

    >

      <button

        type="button"

        role="tab"

        aria-selected={selectedCategory === null}

        onClick={() => onCategoryChange(null)}

        className={`shrink-0 min-h-9 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${

          selectedCategory === null ?

            'bg-dc-accent text-dc-accent-foreground'

          : 'border border-dc-border bg-dc-elevated-solid text-dc-text-muted'

        }`}

      >

        All {totalCount}

      </button>

      {VENDOR_CATEGORY_VALUES.map((cat) => {

        const pressed = selectedCategory === cat

        const count = categoryCounts[cat] ?? 0

        return (

          <button

            key={cat}

            type="button"

            role="tab"

            aria-selected={pressed}

            title={VENDOR_CATEGORY_DESCRIPTIONS[cat]}

            onClick={() => onCategoryChange(pressed ? null : cat)}

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


