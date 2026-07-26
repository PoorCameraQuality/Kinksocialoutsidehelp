'use client'

import { cn } from '@/lib/cn'
import type { PeopleOpsMetric } from '@/components/dancecard/organizer/people/usePeopleOpsSummary'
import type { PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'

const TONE_CLASS: Record<NonNullable<PeopleOpsMetric['tone']>, string> = {
  default: 'border-dc-border bg-dc-elevated-muted',
  success: 'border-emerald-500/30 bg-emerald-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  danger: 'border-red-500/30 bg-red-500/10',
  accent: 'border-dc-accent-border/40 bg-dc-accent-muted/30',
}

const VALUE_TONE: Record<NonNullable<PeopleOpsMetric['tone']>, string> = {
  default: 'text-dc-text',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  accent: 'text-dc-accent',
}

export function PeopleOpsSummaryRow({
  metrics,
  loading,
  onNavigate,
}: {
  metrics: PeopleOpsMetric[]
  loading: boolean
  onNavigate?: (tab: PeopleSubTab) => void
}) {
  if (loading && !metrics.length) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[4.5rem] animate-pulse rounded-xl border border-dc-border bg-dc-elevated-muted" />
        ))}
      </div>
    )
  }

  if (!metrics.length) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metrics.map((m) => {
        const clickable = Boolean(onNavigate && m.tab)
        const tone = m.tone ?? 'default'
        const inner = (
          <>
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{m.label}</p>
            <p className={cn('mt-1 font-serif text-2xl tabular-nums', VALUE_TONE[tone])}>{m.value}</p>
            {m.hint ? <p className="mt-0.5 text-xs text-dc-muted">{m.hint}</p> : null}
          </>
        )
        const cls = cn(
          'rounded-xl border px-3 py-2.5 text-left transition-colors',
          TONE_CLASS[tone],
          clickable && 'cursor-pointer hover:border-dc-accent-border/50',
        )
        if (clickable && onNavigate && m.tab) {
          return (
            <button
              key={m.id}
              type="button"
              className={cls}
              onClick={() => onNavigate(m.tab as PeopleSubTab)}
            >
              {inner}
            </button>
          )
        }
        return (
          <div key={m.id} className={cls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
