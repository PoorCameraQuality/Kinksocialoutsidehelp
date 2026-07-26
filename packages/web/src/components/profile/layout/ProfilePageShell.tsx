import type { ReactNode } from 'react'
import { shellWideClass } from '@/lib/shell-contract'
import { cn } from '@/lib/cn'

type Props = {
  className?: string
  /** Banners, load errors, self-view notice */
  alerts?: ReactNode
  /** Desktop cover + identity row (lg+) */
  cover?: ReactNode
  /** Full story stack for mobile */
  mobileStory?: ReactNode
  /** Sticky left rail: about, snapshot, community (lg+) */
  desktopSidebar?: ReactNode
  /** Tabs + tab panels */
  main: ReactNode
  /** Sticky network rail (xl+); shown below main on lg–xl */
  networkRail?: ReactNode
  footer?: ReactNode
  /** Owner hub etc. below main grid */
  afterGrid?: ReactNode
}

/**
 * Profile layout:
 * - Mobile: single column (story → tabs → network).
 * - lg: story sidebar + main (network stacks under tab panel — main column stays wide enough for content).
 * - xl: three columns (story | tabs | network).
 */
export default function ProfilePageShell({
  className,
  alerts,
  cover,
  mobileStory,
  desktopSidebar,
  main,
  networkRail,
  footer,
  afterGrid,
}: Props) {
  const hasNetwork = Boolean(networkRail)
  const gridClass = hasNetwork
    ? 'lg:grid lg:grid-cols-[minmax(240px,260px)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(260px,280px)_minmax(0,1fr)_minmax(240px,260px)] xl:gap-8'
    : 'lg:grid lg:grid-cols-[minmax(260px,280px)_minmax(0,1fr)] lg:items-start lg:gap-8'

  return (
    <div className={cn(shellWideClass, 'py-6 lg:py-8', className)}>
      {alerts}
      {cover}
      <div className={gridClass}>
        {desktopSidebar ?
          <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:space-y-4">
            {desktopSidebar}
          </aside>
        : null}
        <div className="min-w-0">
          {mobileStory ? <div className="mb-6 lg:hidden">{mobileStory}</div> : null}
          {main}
          {hasNetwork ?
            <div className="mt-8 lg:block xl:hidden">{networkRail}</div>
          : null}
          {afterGrid ? <div className="mt-8">{afterGrid}</div> : null}
        </div>
        {hasNetwork ?
          <aside className="hidden min-w-0 xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:overscroll-contain">
            {networkRail}
          </aside>
        : null}
      </div>
      {footer ? <footer className="mt-8 border-t border-dc-border pt-6">{footer}</footer> : null}
    </div>
  )
}
