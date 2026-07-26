import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  composer?: ReactNode
  tabs?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Show posts before composer (returning members). */
  feedFirst?: boolean
}

/** Feed surfaces — home, group, org activity. */
export default function FeedTemplate({ composer, tabs, children, footer, className, feedFirst }: Props) {
  const feedBlock = <div className={cn('min-w-0 space-y-3', feedFirst ? '' : 'mt-3')}>{children}</div>
  const tabsBlock = tabs ? <div className={feedFirst ? '' : 'mt-3'}>{tabs}</div> : null
  const composerBlock = composer ? <div className="mt-3">{composer}</div> : null

  const shellClass = cn('dc-panel-enter min-w-0 overflow-x-hidden', className)

  if (feedFirst) {
    return (
      <div className={shellClass}>
        {tabsBlock}
        {feedBlock}
        {composerBlock}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  return (
    <div className={shellClass}>
      {composer}
      {tabsBlock}
      {feedBlock}
      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  )
}
