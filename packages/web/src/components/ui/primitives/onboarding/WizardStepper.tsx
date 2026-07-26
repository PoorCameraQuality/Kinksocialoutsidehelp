import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { WizardStepMeta } from './types'

type StepState = 'complete' | 'current' | 'upcoming'

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function stepStateFor(index: number, currentIndex: number, completedIds: Set<string> | null, step: WizardStepMeta): StepState {
  if (completedIds) {
    if (index === currentIndex) return 'current'
    return completedIds.has(step.id) ? 'complete' : 'upcoming'
  }
  if (index < currentIndex) return 'complete'
  if (index === currentIndex) return 'current'
  return 'upcoming'
}

function StepBadge({ state, index, icon }: { state: StepState; index: number; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors motion-reduce:transition-none [&_svg]:h-4 [&_svg]:w-4',
        state === 'current' && 'border-dc-accent-border bg-dc-accent text-dc-accent-foreground shadow-[0_0_0_4px_var(--dc-accent-muted)]',
        state === 'complete' && 'border-dc-accent-border bg-dc-accent-muted text-dc-accent',
        state === 'upcoming' && 'border-dc-border bg-dc-elevated-solid text-dc-text-muted',
      )}
      aria-hidden
    >
      {state === 'complete' ? <CheckIcon className="h-4 w-4" /> : icon ?? index + 1}
    </span>
  )
}

type WizardStepperProps = {
  steps: WizardStepMeta[]
  currentStepId: string
  /** Explicit set of completed step ids; when omitted, all steps before current are complete. */
  completedStepIds?: string[]
  /** When provided, completed/past steps become clickable for revisiting. */
  onStepSelect?: (id: string) => void
}

/** Vertical labeled stepper for the desktop rail. */
export function WizardStepper({ steps, currentStepId, completedStepIds, onStepSelect }: WizardStepperProps) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId))
  const completedSet = completedStepIds ? new Set(completedStepIds) : null

  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const state = stepStateFor(index, currentIndex, completedSet, step)
        const isLast = index === steps.length - 1
        const clickable = Boolean(onStepSelect) && state === 'complete'
        const labelClass = cn(
          'truncate text-sm font-medium',
          state === 'current' ? 'text-dc-text' : state === 'complete' ? 'text-dc-text' : 'text-dc-text-muted',
        )

        const body = (
          <>
            {!isLast ? (
              <span
                className={cn(
                  'absolute left-4 top-9 -ml-px h-[calc(100%-1.25rem)] w-px',
                  state === 'complete' ? 'bg-dc-accent-border' : 'bg-dc-border',
                )}
                aria-hidden
              />
            ) : null}
            <StepBadge state={state} index={index} icon={step.icon} />
            <span className="min-w-0 pt-1.5 text-left">
              <span className={labelClass}>{step.label}</span>
              {step.optional ? (
                <span className="block text-[11px] font-normal uppercase tracking-wide text-dc-text-muted">Optional</span>
              ) : null}
            </span>
          </>
        )

        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(step.id)}
                className="flex w-full gap-3 rounded-lg text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
              >
                {body}
              </button>
            ) : (
              <span aria-current={state === 'current' ? 'step' : undefined} className="flex w-full gap-3">
                {body}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

type WizardProgressProps = {
  steps: WizardStepMeta[]
  currentStepId: string
}

/** Compact progress bar + label for mobile / narrow widths. */
export function WizardProgress({ steps, currentStepId }: WizardProgressProps) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId))
  const total = steps.length
  const step = currentIndex + 1
  const current = steps[currentIndex]
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((step / total) * 100))) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">
          Step {step} of {total}
        </p>
        {current ? <p className="truncate text-xs font-medium text-dc-text-muted">{current.label}</p> : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-dc-border"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}${current ? `: ${current.label}` : ''}`}
      >
        <div
          className="h-full rounded-full bg-dc-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
