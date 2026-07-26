import type { ReactNode } from 'react'
import PageHeader from '@/components/shell/PageHeader'
import MobileActionBar, { type MobileActionBarAction } from '@/components/shell/MobileActionBar'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  description?: string
  children: ReactNode
  primaryAction?: MobileActionBarAction
  secondaryAction?: MobileActionBarAction
  status?: ReactNode
  className?: string
}

/** Settings / account / privacy grouped sections. */
export default function SettingsTemplate({
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  status,
  className,
}: Props) {
  return (
    <div className={cn('mx-auto max-w-3xl overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8', className)}>
      <PageHeader title={title} description={description} sticky={false} className="mb-6" />
      <div className="space-y-6">{children}</div>
      {primaryAction ?
        <MobileActionBar status={status} primary={primaryAction} secondary={secondaryAction} />
      : null}
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string
  description?: string
  children: ReactNode
  danger?: boolean
}) {
  return (
    <section
      className={cn(
        cardSurfaceSolidClass,
        'p-4 sm:p-5',
        danger ? 'border-dc-danger/40' : '',
      )}
    >
      <h2 className="text-base font-semibold text-dc-text">{title}</h2>
      {description ?
        <p className="mt-1 text-sm text-dc-muted">{description}</p>
      : null}
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  )
}
