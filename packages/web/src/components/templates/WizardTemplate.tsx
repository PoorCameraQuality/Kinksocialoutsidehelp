import type { ReactNode } from 'react'
import MobileActionBar, { type MobileActionBarAction } from '@/components/shell/MobileActionBar'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  description?: string
  stepLabel?: string
  progress?: ReactNode
  children: ReactNode
  primaryAction: MobileActionBarAction
  secondaryAction?: MobileActionBarAction
  status?: ReactNode
  errorSummary?: ReactNode
  className?: string
}

/** Multi-step create/setup flows. */
export default function WizardTemplate({
  title,
  description,
  stepLabel,
  progress,
  children,
  primaryAction,
  secondaryAction,
  status,
  errorSummary,
  className,
}: Props) {
  return (
    <div className={cn('mx-auto max-w-2xl overflow-x-hidden px-4 py-6 pb-[calc(var(--c2k-bottom-nav-total-h)+var(--c2k-mobile-action-bar-h)+1rem)] sm:px-6 md:pb-8', className)}>
      {stepLabel ?
        <p className="text-dc-micro uppercase tracking-wide text-dc-muted">{stepLabel}</p>
      : null}
      <h1 className="mt-1 font-display text-xl font-semibold text-dc-text sm:text-2xl">{title}</h1>
      {description ?
        <p className="mt-2 text-sm text-dc-muted">{description}</p>
      : null}
      {progress ? <div className="mt-4">{progress}</div> : null}
      {errorSummary ? <div className="mt-4">{errorSummary}</div> : null}
      <div className="mt-6 space-y-6">{children}</div>
      <MobileActionBar status={status} primary={primaryAction} secondary={secondaryAction} />
    </div>
  )
}
