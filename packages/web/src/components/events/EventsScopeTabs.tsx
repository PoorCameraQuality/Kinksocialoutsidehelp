import TabShell from '@/components/ui/TabShell'
import type { EventsScopeTab } from '@/lib/events-page-utils'

const TABS: { id: EventsScopeTab; label: string; shortLabel?: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'for-you', label: 'For You' },
  { id: 'weekend', label: 'This Weekend', shortLabel: 'Weekend' },
  { id: 'next7', label: 'Next 7 Days', shortLabel: '7 days' },
  { id: 'month', label: 'This Month', shortLabel: 'Month' },
]

type Props = {
  active: EventsScopeTab
  onChange: (tab: EventsScopeTab) => void
  totalCount: number
}

export default function EventsScopeTabs({ active, onChange, totalCount }: Props) {
  return (
    <TabShell aria-label="Event time scope" className="mb-2 w-full max-w-full">
      {TABS.map((tab) => {
        const selected = active === tab.id
        const fullLabel = tab.id === 'all' ? `${tab.label} (${totalCount})` : tab.label
        const compactLabel = tab.id === 'all' ? `All (${totalCount})` : (tab.shortLabel ?? tab.label)
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={fullLabel}
            aria-label={fullLabel}
            onClick={() => onChange(tab.id)}
            className={`min-h-8 shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent sm:px-3 sm:py-1.5 ${
              selected ?
                'border-dc-accent bg-dc-accent text-dc-accent-foreground shadow-[var(--dc-tab-active-shadow)]'
              : 'border-transparent bg-transparent text-dc-text-muted hover:border-dc-border hover:bg-dc-elevated-solid/80 hover:text-dc-text'
            }`}
          >
            <span className="sm:hidden">{compactLabel}</span>
            <span className="hidden sm:inline">{fullLabel}</span>
          </button>
        )
      })}
    </TabShell>
  )
}
