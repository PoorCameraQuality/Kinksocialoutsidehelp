import TabButton from '@/components/ui/TabButton'

import type { PublicProfileTab, PublicProfileTabCounts } from '@/lib/public-profile-tabs'
import { getPublicProfileTabLabel } from '@/lib/public-profile-tabs'
import { cn } from '@/lib/cn'

type Props = {
  tabs: readonly PublicProfileTab[]
  activeTab: string
  onSelect: (tab: PublicProfileTab) => void
  tabCounts?: PublicProfileTabCounts
  /** @deprecated Always horizontal — vertical rail removed to preserve main column width */
  layout?: 'horizontal' | 'responsive'
}

export default function ProfileTabBar({ tabs, activeTab, onSelect, tabCounts }: Props) {
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto rounded-xl border border-dc-border bg-dc-elevated/50 p-1',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
      role="tablist"
      aria-label="Profile sections"
    >
      {tabs.map((tab) => (
        <TabButton
          key={tab}
          label={getPublicProfileTabLabel(tab, tabCounts)}
          isActive={activeTab === tab}
          onClick={() => onSelect(tab)}
          size="small"
          className="flex-shrink-0 whitespace-nowrap rounded-lg px-3 sm:px-4"
        />
      ))}
    </div>
  )
}
