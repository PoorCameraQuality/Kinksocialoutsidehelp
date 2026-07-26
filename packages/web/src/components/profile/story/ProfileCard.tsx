import type { ReactNode } from 'react'

import { cardSurfaceBaseClass, cardSurfaceElevatedClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type Props = {
  title?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  /** Hero uses a stronger elevated treatment with a soft accent glow. */
  variant?: 'default' | 'hero'
}

export default function ProfileCard({
  title,
  icon,
  action,
  children,
  className,
  id,
  variant = 'default',
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        variant === 'hero' ?
          // Elevated: opaque surface, heavier border, soft inset highlight + accent glow.
          `c2k-profile-hero dc-card-polish ${cardSurfaceElevatedClass} p-6 ring-1 ring-inset ring-white/[0.06] sm:p-7`
          // Base: opaque content card with a readable border — distinct from the page.
        : `${cardSurfaceBaseClass} p-6 sm:p-7`,
        className,
      )}
    >
      {title ?
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ?
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dc-accent/[0.12] text-dc-accent">
                {icon}
              </span>
            : null}
            <h2 className="text-base font-semibold tracking-tight text-dc-text sm:text-[17px]">{title}</h2>
          </div>
          {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
        </div>
      : null}

      {children}
    </section>
  )
}
