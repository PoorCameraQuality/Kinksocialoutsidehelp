import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { PLATFORM_SEVERITY_TILE_STYLES } from '@/lib/moderation/platform-labels'
import {
  platformModInsetClass,
  platformModMetricClass,
  platformModPanelClass,
  platformModRowClass,
  platformModSeverityTileClass,
} from '@/lib/moderation/platform-surfaces'

export function PlatformModSection({
  className,
  children,
  id,
}: {
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} className={cn(platformModPanelClass, className)}>
      {children}
    </section>
  )
}

export function PlatformModSectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-dc-text sm:text-lg">{title}</h2>
        {description ?
          <p className="mt-1 text-sm leading-relaxed text-dc-text-muted">{description}</p>
        : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function PlatformModAlert({
  tone,
  children,
}: {
  tone: 'critical' | 'warning'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dc-border/80 bg-dc-elevated-solid px-4 py-3 text-sm leading-relaxed shadow-[var(--dc-shadow-soft)]',
        tone === 'critical' ?
          'border-l-4 border-l-red-500 text-dc-text'
        : 'border-l-4 border-l-amber-500 text-dc-text',
      )}
      role="status"
    >
      {children}
    </div>
  )
}

export type PlatformModMetric = {
  label: string
  value: string | number
  hint: string
  href?: string
  linkLabel?: string
  urgent?: boolean
  healthy?: boolean
}

export function PlatformModMetricGrid({ metrics }: { metrics: PlatformModMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={cn(
            platformModMetricClass,
            metric.urgent && 'border-l-4 border-l-red-500',
            metric.healthy && 'border-l-4 border-l-emerald-500',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted sm:text-[11px]">
            {metric.label}
          </p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums text-dc-text', metric.urgent && 'text-red-300')}>
            {metric.value}
          </p>
          <p className="mt-1 text-xs leading-snug text-dc-muted">{metric.hint}</p>
          {metric.href && metric.linkLabel ?
            <Link
              to={metric.href}
              className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-dc-accent hover:underline"
            >
              {metric.linkLabel}
            </Link>
          : null}
        </div>
      ))}
    </div>
  )
}

export function PlatformModPrinciplesCard() {
  const principles = [
    'Human-in-the-loop only — no autonomous enforcement.',
    'Evidence stays blurred until you explicitly reveal it on a case.',
    'Prioritize NCII and minor-safety queues before general review.',
  ]

  return (
    <PlatformModSection className="dc-rail-card--emphasize border-dc-accent/25">
      <h3 className="text-sm font-semibold text-dc-text">Operator reminders</h3>
      <ul className="mt-3 space-y-2">
        {principles.map((line) => (
          <li key={line} className="flex gap-2 text-sm text-dc-text-muted">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dc-accent" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </PlatformModSection>
  )
}

export function PlatformModEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className={cn(platformModInsetClass, 'border-dashed py-10 text-center')}>
      <p className="text-sm font-medium text-dc-text">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-dc-text-muted">{description}</p>
      {actionHref && actionLabel ?
        <Link
          to={actionHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          {actionLabel}
        </Link>
      : null}
    </div>
  )
}

export function PlatformModListRow({
  href,
  title,
  meta,
  badge,
  badgeClassName,
}: {
  href: string
  title: string
  meta?: string
  badge?: string | number
  badgeClassName?: string
}) {
  return (
    <Link to={href} className={cn(platformModRowClass, 'flex min-h-11 items-center justify-between gap-3 text-sm')}>
      <span className="min-w-0">
        <span className="block font-medium text-dc-text">{title}</span>
        {meta ?
          <span className="mt-0.5 block truncate text-xs text-dc-muted">{meta}</span>
        : null}
      </span>
      {badge != null ?
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
            badgeClassName ?? 'border border-dc-accent/30 bg-dc-surface-muted text-dc-accent',
          )}
        >
          {badge}
        </span>
      : null}
    </Link>
  )
}

export function PlatformModSeverityGrid({
  severities,
  counts,
}: {
  severities: readonly string[]
  counts: Record<string, number>
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {severities.map((severity) => {
        const count = counts[severity] ?? 0
        return (
          <Link
            key={severity}
            to={`/moderation/cases?severity=${encodeURIComponent(severity)}`}
            className={cn(
              platformModSeverityTileClass,
              PLATFORM_SEVERITY_TILE_STYLES[severity] ?? 'text-dc-text-muted',
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-text-muted sm:text-xs">{severity}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-dc-text">{count}</p>
          </Link>
        )
      })}
    </div>
  )
}

export function PlatformModDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(platformModMetricClass, 'h-28')} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className={cn(platformModPanelClass, 'h-64')} />
        <div className="space-y-4">
          <div className={cn(platformModPanelClass, 'h-40')} />
          <div className={cn(platformModPanelClass, 'h-52')} />
        </div>
      </div>
    </div>
  )
}
