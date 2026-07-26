import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type WizardStepHeaderProps = {
  eyebrow?: string
  icon?: ReactNode
  title: string
  description?: ReactNode
  className?: string
}

/** Consistent step heading: optional icon badge + eyebrow + title + supportive description. */
export function WizardStepHeader({ eyebrow, icon, title, description, className }: WizardStepHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {icon ? (
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent-muted text-dc-accent"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">{eyebrow}</p>
      ) : null}
      <h2 className={cn('font-display text-xl font-semibold tracking-tight text-dc-text sm:text-2xl', eyebrow && 'mt-1')}>
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-dc-text-muted">{description}</p>
      ) : null}
    </div>
  )
}
