import { useState } from 'react'
import {
  displayPlanTitle,
  formatProgramTime,
  formatUntilLabel,
  planSourceLabel,
  type PlanItem,
} from '@/lib/play-space-my-plan'

export default function PlaySpacePlanItemCard({
  item,
  timezone,
  variant = 'default',
  hideTime = false,
  busy,
  onRemoveProgram,
  onEditBlock,
  onDeleteBlock,
  onViewProgram,
  onViewScene,
  onCancelScene,
}: {
  item: PlanItem
  timezone: string
  variant?: 'default' | 'now'
  hideTime?: boolean
  busy?: boolean
  onRemoveProgram?: () => void
  onEditBlock?: () => void
  onDeleteBlock?: () => void
  onViewProgram?: () => void
  onViewScene?: () => void
  onCancelScene?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isNow = variant === 'now'
  const title = displayPlanTitle(item)
  const until = formatUntilLabel(item.endsAt, timezone, item.startsAt)
  const loc = item.location?.trim()

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
          Now · ends {formatProgramTime(item.endsAt, timezone)}
        </p>
      ) : null}

      {!isNow && !hideTime ? (
        <p className="text-[13px] font-medium text-dc-muted">
          {formatProgramTime(item.startsAt, timezone)}
        </p>
      ) : null}

      <h3 className="mt-1 text-[17px] font-semibold leading-snug text-dc-text">{title}</h3>

      <p className="mt-1 text-[14px] text-dc-text-muted">
        {[loc, until].filter(Boolean).join(' · ')}
      </p>

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">
        {planSourceLabel(item.planKind)}
        {item.overlaps ? ' · Overlaps another item' : ''}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.planKind === 'program' ? (
          <>
            {onViewProgram ? (
              <button
                type="button"
                onClick={onViewProgram}
                className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                View session
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-dc-border text-sm text-dc-muted"
              aria-label="Program item actions"
            >
              •••
            </button>
          </>
        ) : null}

        {item.planKind === 'block' ? (
          <>
            {onEditBlock ? (
              <button
                type="button"
                disabled={busy}
                onClick={onEditBlock}
                className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-dc-border text-sm text-dc-muted"
              aria-label="Block actions"
            >
              •••
            </button>
          </>
        ) : null}

        {item.planKind === 'scene' ? (
          <>
            {onViewScene ? (
              <button
                type="button"
                onClick={onViewScene}
                className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                View reservation
              </button>
            ) : null}
            {onCancelScene ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setMenuOpen(true)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-dc-border text-sm text-dc-muted"
                aria-label="Scene actions"
              >
                •••
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-dc-modal flex flex-col justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            className="min-h-0 flex-1 bg-black/70"
            aria-label="Close"
            onClick={() => setMenuOpen(false)}
          />
          <div className="space-y-2 rounded-t-2xl border border-dc-border bg-dc-elevated px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-[15px] font-medium text-dc-text">{title}</p>
            {item.planKind === 'program' ? (
              <>
                {onViewProgram ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text"
                    onClick={() => {
                      setMenuOpen(false)
                      onViewProgram()
                    }}
                  >
                    View in Program
                  </button>
                ) : null}
                {onRemoveProgram ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--dc-danger-border)] text-sm font-semibold text-[var(--dc-danger)] disabled:opacity-50"
                    onClick={() => {
                      setMenuOpen(false)
                      onRemoveProgram()
                    }}
                  >
                    {busy ? 'Removing…' : 'Remove from my plan'}
                  </button>
                ) : null}
              </>
            ) : null}
            {item.planKind === 'block' ? (
              <>
                {onEditBlock ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text"
                    onClick={() => {
                      setMenuOpen(false)
                      onEditBlock()
                    }}
                  >
                    Edit block
                  </button>
                ) : null}
                {onDeleteBlock ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--dc-danger-border)] text-sm font-semibold text-[var(--dc-danger)] disabled:opacity-50"
                    onClick={() => {
                      setMenuOpen(false)
                      onDeleteBlock()
                    }}
                  >
                    {busy ? 'Deleting…' : 'Delete block'}
                  </button>
                ) : null}
              </>
            ) : null}
            {item.planKind === 'scene' && onCancelScene ? (
              <button
                type="button"
                disabled={busy}
                className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--dc-danger-border)] text-sm font-semibold text-[var(--dc-danger)] disabled:opacity-50"
                onClick={() => {
                  setMenuOpen(false)
                  onCancelScene()
                }}
              >
                {busy ? 'Cancelling…' : 'Cancel scene'}
              </button>
            ) : null}
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text-muted"
              onClick={() => setMenuOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
