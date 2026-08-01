import { useState } from 'react'
import {
  formatDurationHuman,
  formatSessionTimeRange,
  type ProgramSession,
} from '@/lib/play-space-program'

export default function PlaySpaceProgramSessionCard({
  session,
  timezone,
  variant = 'default',
  busy,
  hideTime = false,
  onAdd,
  onRemove,
}: {
  session: ProgramSession
  timezone: string
  variant?: 'default' | 'now'
  busy?: boolean
  /** When true, time is shown by the parent group heading. */
  hideTime?: boolean
  onAdd?: () => void
  onRemove?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const desc = session.description?.trim() ?? ''
  const longDesc = desc.length > 160
  const duration = formatDurationHuman(session.startsAt, session.endsAt)
  const onPlan = Boolean(session.isOnMyDancecard)
  const isNow = variant === 'now'

  return (
    <article
      className={`rounded-2xl border px-4 py-3 ${
        isNow
          ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_8%,var(--dc-elevated))]'
          : 'border-dc-border bg-dc-elevated'
      }`}
    >
      {isNow ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
          Now · ends {formatSessionTimeRange(session.startsAt, session.endsAt, timezone).split('–')[1]?.trim() ?? ''}
        </p>
      ) : null}

      {!isNow && !hideTime ? (
        <p className="text-[13px] font-medium text-dc-muted">
          {formatSessionTimeRange(session.startsAt, session.endsAt, timezone)}
        </p>
      ) : null}

      <h3 className="mt-1 text-[17px] font-semibold leading-snug text-dc-text">{session.title}</h3>

      {(session.location?.trim() || duration) ? (
        <p className="mt-1 text-[14px] text-dc-text-muted">
          {[session.location?.trim(), duration].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      {desc ? (
        <div className="mt-2">
          <p className={`text-[14px] leading-relaxed text-dc-text-muted ${expanded ? '' : 'line-clamp-3'}`}>
            {desc}
          </p>
          {longDesc ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 min-h-10 text-sm font-medium text-dc-accent"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          ) : null}
        </div>
      ) : null}

      {onAdd || onRemove ? (
        <div className="mt-3">
          {onPlan ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setSheetOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] px-4 text-sm font-semibold text-dc-text disabled:opacity-50"
            >
              ✓ In my plan
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !onAdd}
              onClick={onAdd}
              className="inline-flex min-h-11 items-center rounded-full border border-dc-border bg-dc-elevated-muted px-4 text-sm font-semibold text-dc-text hover:border-[var(--dc-accent-border)] disabled:opacity-50"
            >
              {busy ? 'Adding…' : '+ Add to my plan'}
            </button>
          )}
          <p className="sr-only" aria-live="polite">
            {busy ? (onPlan ? 'Removing…' : 'Adding…') : onPlan ? 'In your plan' : ''}
          </p>
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-dc-modal flex flex-col justify-end" role="dialog" aria-modal="true">
          <button type="button" className="min-h-0 flex-1 bg-black/70" aria-label="Close" onClick={() => setSheetOpen(false)} />
          <div className="rounded-t-2xl border border-dc-border bg-dc-elevated px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-[15px] font-medium text-dc-text">{session.title} is in your plan.</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onRemove?.()
                  setSheetOpen(false)
                }}
                className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--dc-danger-border)] text-sm font-semibold text-[var(--dc-danger)]"
              >
                Remove from my plan
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
