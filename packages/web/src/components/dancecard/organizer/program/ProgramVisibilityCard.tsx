'use client'

import { useMemo } from 'react'
import type { ProgramSlotStats } from '@/lib/dancecard/programSlotStats'
import { cn } from '@/lib/cn'

type Props = {
  stats: ProgramSlotStats
  eventPublished: boolean
  readOnly?: boolean
  publishFilterDraft?: boolean
  onShowDrafts?: () => void
  onClearDraftFilter?: () => void
  onOpenListView?: () => void
  onPreviewAttendeeSchedule?: () => void
}

export function ProgramVisibilityCard({
  stats,
  eventPublished,
  readOnly,
  publishFilterDraft,
  onShowDrafts,
  onClearDraftFilter,
  onOpenListView,
  onPreviewAttendeeSchedule,
}: Props) {
  const attendeeStatus = useMemo(() => {
    if (!eventPublished) return { label: 'Attendee schedule draft', tone: 'warn' as const }
    if (stats.draft > 0) return { label: 'Partially published', tone: 'warn' as const }
    if (stats.published === 0) return { label: 'Nothing published yet', tone: 'warn' as const }
    return { label: 'Published sessions visible', tone: 'good' as const }
  }, [eventPublished, stats.draft, stats.published])

  return (
    <section
      className="rounded-xl border border-dc-border-subtle bg-dc-surface-muted/50 px-3 py-2.5 sm:px-4"
      aria-labelledby="program-visibility-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="program-visibility-heading" className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Program visibility
          </h2>
          <p className="mt-1 text-sm text-dc-text">
            Publishing is per session. Use bulk selection, the session drawer Visibility tab, or import batch publish.
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-dc-muted">Published</dt>
              <dd className="font-semibold text-emerald-400">{stats.published}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Draft</dt>
              <dd className={cn('font-semibold', stats.draft > 0 ? 'text-amber-400' : 'text-dc-text')}>{stats.draft}</dd>
            </div>
            {stats.hidden > 0 ? (
              <div>
                <dt className="text-dc-muted">Hidden / staff</dt>
                <dd className="font-semibold text-dc-muted">{stats.hidden}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-dc-muted">Attendee schedule</dt>
              <dd
                className={cn(
                  'font-semibold',
                  attendeeStatus.tone === 'good' ? 'text-emerald-400' : 'text-amber-400',
                )}
              >
                {attendeeStatus.label}
              </dd>
            </div>
          </dl>
          {stats.draft > 0 ? (
            <p className="mt-2 text-xs text-dc-muted">
              Draft sessions stay hidden from the public Schedule tab and Dancecard until published.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {stats.draft > 0 && onShowDrafts ? (
            <button
              type="button"
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium',
                publishFilterDraft
                  ? 'border-dc-accent bg-dc-accent-muted text-dc-accent'
                  : 'border-dc-border text-dc-text hover:bg-dc-elevated-muted/80',
              )}
              onClick={() => (publishFilterDraft ? onClearDraftFilter?.() : onShowDrafts())}
            >
              {publishFilterDraft ? 'Show all sessions' : 'Show draft sessions'}
            </button>
          ) : null}
          {onOpenListView ? (
            <button
              type="button"
              className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-text hover:bg-dc-elevated-muted/80"
              onClick={onOpenListView}
            >
              Open list view
            </button>
          ) : null}
          {onPreviewAttendeeSchedule ? (
            <button
              type="button"
              className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-accent hover:bg-dc-elevated-muted/80"
              onClick={onPreviewAttendeeSchedule}
            >
              Preview attendee schedule ↗
            </button>
          ) : null}
        </div>
      </div>
      {!readOnly && stats.draft > 0 ? (
        <p className="mt-2 rounded-lg border border-dc-border-subtle bg-dc-elevated-muted/40 px-2.5 py-1.5 text-xs text-dc-muted">
          Select sessions on the grid (checkboxes), then use <span className="font-medium text-dc-text">Publish</span> in
          the bulk bar. ECKE / Dancecard attendee publish runs from Integrations when the program is ready.
        </p>
      ) : null}
    </section>
  )
}
