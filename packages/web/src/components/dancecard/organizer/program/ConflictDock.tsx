'use client'

import type { DancecardConflict } from '@/lib/dancecard/conflictScanner'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { cn } from '@/lib/cn'

type Props = {
  conflicts: DancecardConflict[]
  slots: ProgramSlotRow[]
  loading?: boolean
  lastScannedAt?: Date | null
  onScan?: () => void
  onOpenSlot: (slotId: string, opts?: { editTab?: 'edit' | 'privacy' }) => void
  onOpenBoth: (a: string, b: string) => void
  onOpenScheduleCredits?: () => void
  onLaunchConflictGuide?: () => void
}

function conflictCategory(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('room') || t.includes('location') || t.includes('double')) return 'Room'
  if (t.includes('capacity')) return 'Capacity'
  if (t.includes('presenter') || t.includes('person')) return 'Presenter'
  if (t.includes('photo')) return 'Photo policy'
  return 'Schedule'
}

function formatScannedAt(d: Date | null | undefined): string | null {
  if (!d) return null
  const sec = Math.round((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function ConflictDock({
  conflicts,
  slots,
  loading = false,
  lastScannedAt,
  onScan,
  onOpenSlot,
  onOpenBoth,
  onOpenScheduleCredits,
  onLaunchConflictGuide,
}: Props) {
  const scannedLabel = formatScannedAt(lastScannedAt)
  const warnings = conflicts.filter((c) => c.severity === 'warning')
  const hasIssues = conflicts.length > 0

  if (loading) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dc-border-subtle bg-dc-surface-muted/50 px-3 py-2.5 text-sm text-dc-muted"
        aria-busy="true"
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dc-accent-border border-t-dc-accent animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          Scanning schedule for conflicts…
        </span>
      </div>
    )
  }

  if (!hasIssues) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-300">No schedule conflicts detected</p>
          <p className="text-xs text-dc-muted">
            Rooms, presenters, and photo policy. Scanned on load and when you run Scan.
            {scannedLabel ? ` Last scan ${scannedLabel}.` : ' Run Scan after major schedule changes.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onScan ? (
            <button
              type="button"
              className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-text hover:bg-dc-elevated-muted/80"
              onClick={onScan}
            >
              Scan conflicts
            </button>
          ) : null}
          {onLaunchConflictGuide ? (
            <button type="button" className="text-xs text-dc-muted hover:text-dc-text" onClick={onLaunchConflictGuide}>
              Walkthrough
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const tone =
    warnings.length > 0 && conflicts.some((c) => c.severity !== 'warning')
      ? 'urgent'
      : warnings.length > 0
        ? 'warn'
        : 'info'

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5',
        tone === 'urgent' ? 'border-red-500/30 bg-red-950/20' : 'border-dc-warning/30 bg-dc-warning-muted/20',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-dc-text">
            {warnings.length === conflicts.length ? 'Warnings found' : 'Conflicts found'} · {conflicts.length}
          </p>
          <p className="text-xs text-dc-muted">
            Server scan. Not live on every edit.{scannedLabel ? ` Last scan ${scannedLabel}.` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onScan ? (
            <button
              type="button"
              className="rounded-lg border border-dc-border px-2.5 py-1 text-xs hover:bg-dc-elevated-muted/80"
              onClick={onScan}
            >
              Re-scan
            </button>
          ) : null}
          {onOpenScheduleCredits ? (
            <button type="button" className="text-xs text-dc-accent hover:underline" onClick={onOpenScheduleCredits}>
              Schedule credits
            </button>
          ) : null}
        </div>
      </div>
      <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
        {conflicts.map((c) => {
          const related = c.relatedSlotIds
          const a = related[0]
          const b = related[1]
          const slotA = slots.find((s) => s.id === a)
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border-subtle bg-dc-elevated-muted/40 px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded bg-dc-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-dc-muted">
                  {conflictCategory(c.title)}
                </span>
                <span className="font-medium text-dc-text">{c.title}</span>
                {c.detail ? <span className="ml-1 text-dc-muted">, {c.detail}</span> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                {a && slotA ? (
                  <button
                    type="button"
                    className="rounded border border-dc-border px-2 py-0.5 hover:bg-dc-surface-muted"
                    onClick={() => onOpenSlot(a)}
                  >
                    Open
                  </button>
                ) : null}
                {a && b ? (
                  <button
                    type="button"
                    className="rounded border border-dc-border px-2 py-0.5 hover:bg-dc-surface-muted"
                    onClick={() => onOpenBoth(a, b)}
                  >
                    Both
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
