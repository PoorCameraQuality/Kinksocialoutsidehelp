import type { ReactNode } from 'react'
import HomeDashboardLeftRail from '@/components/home/HomeDashboardLeftRail'
import { shellFeedClass } from '@/lib/shell-contract'

type Props = {
  children: ReactNode
  /** Optional mobile drawer toggle for My Kink Social (messaging-style). */
  mobileNavLabel?: string
  showMobileNavToggle?: boolean
  onMobileNavToggle?: () => void
  mobileNavOpen?: boolean
}

/**
 * Focused personal pages: My Kink Social left rail on desktop, centered main column.
 */
export default function PersonalUtilityPageShell({
  children,
  mobileNavLabel = 'My Kink Social',
  showMobileNavToggle = false,
  onMobileNavToggle,
  mobileNavOpen,
}: Props) {
  return (
    <div className={`${shellFeedClass} py-4 lg:py-6`}>
      {showMobileNavToggle ?
        <button
          type="button"
          onClick={onMobileNavToggle}
          className="mb-4 inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-accent lg:hidden"
        >
          {mobileNavLabel}
        </button>
      : null}
      {mobileNavOpen ?
        <div className="mb-4 lg:hidden">
          <HomeDashboardLeftRail />
        </div>
      : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,240px)_minmax(0,1fr)] lg:gap-8">
        <div className="hidden lg:block">
          <HomeDashboardLeftRail />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
