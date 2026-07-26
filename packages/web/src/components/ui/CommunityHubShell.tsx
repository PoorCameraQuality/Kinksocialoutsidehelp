import type { ReactNode } from 'react'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import TabShell, { TabShellButton } from '@/components/ui/TabShell'

export interface CommunityHubShellProps {
  /** Accessible name for the sticky section tab bar (e.g. "Group sections"). */
  tabsAriaLabel: string
  tabs: readonly string[]
  activeTab: string
  onTabChange: (tab: string) => void
  /** Cover + identity header card rendered above the tab row. */
  header: ReactNode
  /** Between header card and tabs (e.g. election banners). */
  beforeTabs?: ReactNode
  /** Directly below the tab bar (e.g. status messages). */
  tabFooter?: ReactNode
  /** Tab pill styling - org hubs use gold accent. */
  tabVariant?: 'default' | 'gold'
  children: ReactNode
  className?: string
}

export default function CommunityHubShell({
  tabsAriaLabel,
  tabs,
  activeTab,
  onTabChange,
  header,
  beforeTabs,
  tabFooter,
  tabVariant = 'default',
  children,
  className = '',
}: CommunityHubShellProps) {
  const selectedTabClass =
    tabVariant === 'gold'
      ? '!border-amber-500/45 !bg-amber-500/15 !text-amber-100'
      : undefined

  return (
    <div className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${className}`.trim()}>
      {header}
      {beforeTabs}
      <nav
        className="sticky z-20 -mx-4 mb-4 bg-dc-surface/95 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-dc-surface/80 sm:mx-0 sm:px-0"
        style={{ top: 'var(--c2k-sticky-below-community-nav)' }}
        aria-label={tabsAriaLabel}
      >
        <div className="relative">
          <TabShell className="w-full max-w-full overflow-x-auto c2k-no-scrollbar flex-nowrap scroll-smooth" aria-label={tabsAriaLabel}>
            {tabs.map((tab) => (
              <TabShellButton
                key={tab}
                selected={activeTab === tab}
                onClick={() => onTabChange(tab)}
                className={`flex-shrink-0 rounded-xl whitespace-nowrap ${selectedTabClass ?? ''}`.trim()}
              >
                {tab}
              </TabShellButton>
            ))}
          </TabShell>
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-dc-surface to-transparent md:hidden"
            aria-hidden
          />
        </div>
      </nav>
      {tabFooter}
      <TabContentTransition tabKey={activeTab}>{children}</TabContentTransition>
    </div>
  )
}
