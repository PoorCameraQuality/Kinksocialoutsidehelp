import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import MobileActionBar, { type MobileActionBarAction } from '@/components/shell/MobileActionBar'

type Props = {
  hero: ReactNode
  tabs?: ReactNode
  sidebar?: ReactNode
  children: ReactNode
  primaryAction?: MobileActionBarAction
  secondaryAction?: MobileActionBarAction
  actionStatus?: ReactNode
  className?: string
}

/** Entity detail pages — profile, event, group, org, vendor, article. */
export default function DetailTemplate({
  hero,
  tabs,
  sidebar,
  children,
  primaryAction,
  secondaryAction,
  actionStatus,
  className,
}: Props) {
  return (
    <div className={cn('dc-panel-enter mx-auto max-w-[1280px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-10', className)}>
      {hero}
      {tabs ? <div className="mt-6">{tabs}</div> : null}
      <div className={cn('mt-6', sidebar ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8 lg:items-start' : '')}>
        <div className="min-w-0">{children}</div>
        {sidebar ?
          <aside className="mt-8 lg:mt-0 lg:sticky lg:top-24">{sidebar}</aside>
        : null}
      </div>
      {primaryAction ?
        <MobileActionBar status={actionStatus} primary={primaryAction} secondary={secondaryAction} />
      : null}
    </div>
  )
}
