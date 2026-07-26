import type { ConnTab } from '@/components/connections/connections-ui'
import { CONN_TABS } from '@/components/connections/connections-ui'

type Props = {
  active: ConnTab
  counts: Partial<Record<ConnTab, number>>
  onChange: (tab: ConnTab) => void
}

export default function ConnectionsTabs({ active, counts, onChange }: Props) {
  return (
    <div
      className="sticky z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-dc-border bg-dc-surface-muted/95 px-4 backdrop-blur-sm c2k-no-scrollbar sm:static sm:mx-0 sm:bg-transparent sm:backdrop-blur-none"
      style={{ top: 'var(--c2k-sticky-below-header)' }}
      role="tablist"
      aria-label="Connections sections"
    >
      {CONN_TABS.map((tab) => {
        const selected = active === tab.id
        const count = counts[tab.id]
        const countLabel = count != null && count > 0 && tab.id !== 'ignored' ? ` ${count}` : ''
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-10 ${
              selected ?
                'border-b-2 border-dc-accent text-dc-accent'
              : 'text-dc-text-muted hover:text-dc-text'
            }`}
          >
            {tab.label}
            {countLabel ?
              <span className={selected ? 'text-dc-accent' : 'text-dc-muted'}>{countLabel}</span>
            : null}
          </button>
        )
      })}
    </div>
  )
}
