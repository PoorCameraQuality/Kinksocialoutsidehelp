import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  description?: string
  eyebrow?: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  sticky?: boolean
  className?: string
}

/**
 * Mobile-first page header with optional sticky behavior below site chrome.
 */
export default function PageHeader({
  title,
  description,
  eyebrow,
  backTo,
  backLabel = 'Back',
  actions,
  sticky = true,
  className,
}: Props) {
  return (
    <header
      className={cn(
        'mb-4 space-y-2 border-b border-dc-border-subtle pb-4 md:mb-6',
        sticky && 'sticky top-[var(--c2k-sticky-below-header)] z-20 -mx-4 bg-dc-surface/95 px-4 backdrop-blur-md safe-area-pt sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none',
        className,
      )}
    >
      {backTo ?
        <Link
          to={backTo}
          className="inline-flex min-h-touch min-w-touch items-center gap-1 text-sm font-medium text-dc-accent hover:text-dc-accent-hover"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>
      : null}
      {eyebrow ?
        <p className="text-dc-micro uppercase tracking-wide text-dc-muted">{eyebrow}</p>
      : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-xl font-semibold text-dc-text sm:text-2xl">{title}</h1>
          {description ?
            <p className="max-w-prose text-sm text-dc-muted">{description}</p>
          : null}
        </div>
        {actions ?
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        : null}
      </div>
    </header>
  )
}
