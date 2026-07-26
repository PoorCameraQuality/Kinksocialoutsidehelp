import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { WizardProgress, WizardStepper } from './WizardStepper'
import type { WizardStepMeta } from './types'

type WizardShellProps = {
  /** Small brand / context eyebrow shown above the title (e.g. "kink.social", "Vendor setup"). */
  brand?: ReactNode
  title: ReactNode
  description?: ReactNode
  steps: WizardStepMeta[]
  currentStepId: string
  /** Explicit completed step ids (for non-linear flows); defaults to all steps before current. */
  completedStepIds?: string[]
  /** Enables click-to-revisit on completed steps. */
  onStepSelect?: (id: string) => void
  /** Footer navigation (typically a WizardFooter). Rendered inside the content column. */
  footer?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Shared onboarding wizard chrome. Responsive by design:
 * - Desktop: persistent left stepper rail beside the content card.
 * - Mobile: compact top progress; footer becomes a sticky bottom action bar.
 */
export function WizardShell({
  brand,
  title,
  description,
  steps,
  currentStepId,
  completedStepIds,
  onStepSelect,
  footer,
  children,
  className,
}: WizardShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8',
        'pb-[calc(var(--c2k-mobile-action-bar-total-h)+1.5rem)] lg:pb-10',
        className,
      )}
    >
      <header className="mb-6">
        {brand ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">{brand}</p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-dc-text sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">{description}</p> : null}
      </header>

      <div className="mb-6 lg:hidden">
        <WizardProgress steps={steps} currentStepId={currentStepId} />
      </div>

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start" aria-label="Onboarding steps">
          <WizardStepper
            steps={steps}
            currentStepId={currentStepId}
            completedStepIds={completedStepIds}
            onStepSelect={onStepSelect}
          />
        </aside>

        <div className="min-w-0">
          <div
            key={currentStepId}
            className={cn(cardSurfaceSolidClass, 'dc-panel-enter motion-reduce:animate-none p-5 sm:p-6 lg:p-7')}
          >
            {children}
          </div>
          {footer}
        </div>
      </div>
    </div>
  )
}
