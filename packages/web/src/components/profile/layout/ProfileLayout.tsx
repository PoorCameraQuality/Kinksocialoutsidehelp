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
  /** Primary section nav (Overview / Photos / …) under the gallery. */
  nav?: ReactNode
  /** Main column: about, interests, looking for. */
  primary: ReactNode
  /** Right rail (lg+) / stacked under primary (mobile): network, community. */
  secondary?: ReactNode
  /** Full-width deeper content below the grid: recent posts + tabbed sections. */
  more?: ReactNode
  footer?: ReactNode
  /** When true, hide the two-column overview grid (nav is showing another section). */
  hideOverviewGrid?: boolean
}

/**
 * Photo-forward profile layout:
 * - hero + gallery + nav span full width;
 * - mobile stacks primary → secondary → more in a single column;
 * - lg+ shows a wide primary column with secondary below on narrow desktops / sticky on xl.
 */
export default function ProfileLayout({
  className,
  alerts,
  hero,
  gallery,
  nav,
  primary,
  secondary,
  more,
  footer,
  hideOverviewGrid = false,
}: Props) {
  return (
    <div className={cn(shellWideClass, 'py-6 lg:py-8', className)}>
      {alerts}
      {hero}
      {gallery ? <div className="mt-5">{gallery}</div> : null}
      {nav ? <div className="mt-5">{nav}</div> : null}

      {!hideOverviewGrid ?
        <div className="mt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-8">
          <div className="min-w-0 space-y-6">{primary}</div>
          {secondary ?
            <aside className="mt-6 min-w-0 space-y-5 xl:mt-0 xl:sticky xl:top-20">{secondary}</aside>
          : null}
        </div>
      : null}

      {more ? <div className={hideOverviewGrid ? 'mt-6' : 'mt-8'}>{more}</div> : null}
      {footer ? <footer className="mt-8 border-t border-dc-border pt-6">{footer}</footer> : null}
    </div>
  )
}
