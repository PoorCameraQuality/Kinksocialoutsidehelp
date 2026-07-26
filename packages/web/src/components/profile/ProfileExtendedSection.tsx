import type { ReactNode } from 'react'

import ProfileTabBar from '@/components/profile/ProfileTabBar'
import type { PublicProfileTab, PublicProfileTabCounts } from '@/lib/public-profile-tabs'
import { cn } from '@/lib/cn'

type Props = {
  viewerIsOwner: boolean
  visibleTabs: readonly PublicProfileTab[]
  activeTab: PublicProfileTab
  onSelect: (tab: PublicProfileTab) => void
  tabCounts?: PublicProfileTabCounts
  /** @deprecated Legacy inline sidebar — unused; network rail lives in ProfilePageShell */
  sidebar?: ReactNode
  children: ReactNode
}

export default function ProfileExtendedSection({
  viewerIsOwner,
  visibleTabs,
  activeTab,
  onSelect,
  tabCounts,
  children,
}: Props) {
  if (visibleTabs.length === 0) return null

  const singleTab = visibleTabs.length === 1

  return (
    <section className="min-w-0">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-dc-text">
          {viewerIsOwner ? 'Profile' : 'Member profile'}
        </h2>
        <p className="mt-1 text-sm text-dc-text-muted">
          {viewerIsOwner ?
            'Relationships, connections, community feedback, writing, and photos.'
          : 'Relationships, connections, feedback, writing, and photos shared on this profile.'}
        </p>
      </div>

      {!singleTab ?
        <div className="mb-4 sm:mb-5">
          <ProfileTabBar
            tabs={visibleTabs}
            activeTab={activeTab}
            onSelect={onSelect}
            tabCounts={tabCounts}
          />
        </div>
      : null}

      <div
        className={cn(
          'min-w-0 rounded-2xl border border-dc-border bg-dc-elevated/40 p-4 shadow-[var(--dc-shadow-soft)] sm:p-6',
          singleTab && 'mt-0',
        )}
      >
        {children}
      </div>
    </section>
  )
}
