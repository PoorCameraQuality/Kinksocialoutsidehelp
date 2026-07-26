import type { ReactNode } from 'react'
import PageHeader from '@/components/shell/PageHeader'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  description?: string
  summary?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** Organizer / mod / admin dashboards — stacked cards on mobile. */
export default function DashboardTemplate({
  title,
  description,
  summary,
  actions,
  children,
  className,
}: Props) {
  return (
    <div className={cn('mx-auto max-w-7xl overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8', className)}>
      {title ?
        <PageHeader title={title} description={description} actions={actions} sticky={false} className="mb-6" />
      : null}
      {summary ? <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{summary}</div> : null}
      <div className="space-y-6 pb-1 md:pb-0">{children}</div>
    </div>
  )
}

export function DashboardCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'dc-card-polish rounded-2xl border border-white/[0.07] bg-gradient-to-br from-dc-elevated-solid to-dc-elevated/85 p-4 shadow-[var(--dc-shadow-soft)]',
        className,
      )}
    >
      {title ?
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-dc-text">{title}</h3>
      : null}
      {children}
    </div>
  )
}
