import type { ReactNode } from 'react'

import { shellWideClass } from '@/lib/shell-contract'
import { cn } from '@/lib/cn'

type Props = {
  className?: string
  /** Banners / self-view notice above the hero. */
  alerts?: ReactNode
  /** Full-width profile hero. */
  hero: ReactNode
  /** Photo strip directly under the hero. */
  gallery?: ReactNode
  /** Main column: about, interests, looking for. */
  primary: ReactNode
  /** Right rail (lg+) / stacked under primary (mobile): network, community. */
  secondary?: ReactNode
  /** Full-width deeper content below the grid: recent posts + tabbed sections. */
  more?: ReactNode
  footer?: ReactNode
}

/**
 * Photo-forward profile layout:
 * - hero + gallery strip span full width;
 * - mobile stacks primary → secondary → more in a single column;
 * - lg+ shows a wide primary column with a sticky secondary rail, then full-width "more".
 */
export default function ProfileLayout({
  className,
  alerts,
  hero,
  gallery,
  primary,
  secondary,
  more,
  footer,
}: Props) {
  return (
    <div className={cn(shellWideClass, 'py-6 lg:py-8', className)}>
      {alerts}
      {hero}
      {gallery ? <div className="mt-5">{gallery}</div> : null}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">{primary}</div>
        {secondary ?
          <aside className="mt-6 min-w-0 space-y-5 lg:mt-0">{secondary}</aside>
        : null}
      </div>

      {more ? <div className="mt-8">{more}</div> : null}
      {footer ? <footer className="mt-8 border-t border-dc-border pt-6">{footer}</footer> : null}
    </div>
  )
}
