/** Compare / mutual availability — legend + strips share these classes. */

export const compareSlot = {
  mutualFree: 'bg-[var(--dc-compare-mutual)]',
  mutualFreeHover:
    'hover:brightness-110 hover:ring-2 hover:ring-dc-success/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dc-accent',
  hostFreeOnly: 'bg-[var(--dc-compare-host-only)] ring-1 ring-[var(--dc-compare-host-only-ring)]',
  busy: 'bg-[var(--dc-compare-busy)] ring-1 ring-[var(--dc-compare-busy-ring)]',
  outsideWindow: 'bg-[var(--dc-compare-outside)] border border-dc-border',
  selectedGap: 'border-2 border-dashed border-dc-accent bg-[var(--dc-compare-selected)]',
} as const

export const compareLegendSwatch = {
  mutualFree: 'bg-[var(--dc-compare-mutual)] ring-1 ring-dc-success/50',
  hostFreeOnly: 'bg-[var(--dc-compare-host-only)] ring-1 ring-[var(--dc-compare-host-only-ring)]',
  busy: 'bg-[var(--dc-compare-busy)] ring-1 ring-[var(--dc-compare-busy-ring)]',
  outsideWindow: 'bg-[var(--dc-compare-outside)] ring-1 ring-dc-border',
  selectedGap: 'border-2 border-dashed border-dc-accent bg-[var(--dc-compare-selected)]',
} as const

export const compareLegendBusyHatchStyle = {
  backgroundImage:
    'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0.22) 4px)',
} as const
