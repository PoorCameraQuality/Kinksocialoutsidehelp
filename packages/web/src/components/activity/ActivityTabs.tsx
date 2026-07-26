import type { ActivityTab } from '@/components/activity/activity-ui'
import { ACTIVITY_TABS } from '@/components/activity/activity-ui'

type Props = {
  active: ActivityTab
  onChange: (tab: ActivityTab) => void
}

export default function ActivityTabs({ active, onChange }: Props) {
  return (
    <div
      className="mb-4 flex gap-1 overflow-x-auto border-b border-dc-border pb-0 c2k-no-scrollbar"
      role="tablist"
      aria-label="Activity filters"
    >
      {ACTIVITY_TABS.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              selected ?
                'border-b-2 border-dc-accent text-dc-accent'
              : 'text-dc-text-muted hover:text-dc-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
