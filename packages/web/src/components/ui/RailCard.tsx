import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { railSurfaceCardClass } from '@/lib/card-surface'

type Props = {
  title: string
  children: ReactNode
  footerHref?: string
  footerLabel?: string
  emphasize?: boolean
  icon?: ReactNode
  className?: string
}

/**
 * Shared right-rail section card (Sprint 3 CP2).
 * Visual only — do not add data or actions here.
 */
export default function RailCard({ title, children, footerHref, footerLabel, emphasize, icon, className }: Props) {
  return (
    <div className={cn(railSurfaceCardClass, emphasize && 'dc-rail-card--emphasize', className)}>
      {icon ?
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dc-accent-muted text-dc-accent"
            aria-hidden
          >
            {icon}
          </span>
          <h3 className={cn('dc-rail-card__title text-sm font-semibold', emphasize ? 'text-dc-accent' : 'text-dc-text')}>
            {title}
          </h3>
        </div>
      : <h3
          className={cn(
            'dc-rail-card__title mb-3 text-sm font-semibold',
            emphasize ? 'text-dc-accent' : 'text-dc-text',
          )}
        >
          {title}
        </h3>
      }
      {children}
      {footerHref && footerLabel ?
        <Link to={footerHref} className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          {footerLabel}
        </Link>
      : null}
    </div>
  )
}
