import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'

export const CREATE_FLOW_STEPS = ['Basics', 'Details', 'Host', 'Publish'] as const

export const fieldSelectClass = 'cf-field'

export const fieldTextareaClass = 'cf-field'

export const fieldDatetimeClass = cn('cf-field', '[color-scheme:dark]')

export function CreateFlowStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav className="cf-stepper" aria-label="Create event steps">
      <ol className="cf-stepper__list">
        {CREATE_FLOW_STEPS.map((label, i) => {
          const stepNum = i + 1
          const active = currentStep === stepNum
          const done = currentStep > stepNum
          return (
            <li key={label} className="cf-stepper__item">
              <div
                className={cn(
                  'cf-stepper__track',
                  active && 'cf-stepper__track--active',
                  done && 'cf-stepper__track--done',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'cf-stepper__label',
                  active && 'cf-stepper__label--active',
                  done && 'cf-stepper__label--done',
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function SectionCard({
  title,
  badge,
  children,
  variant = 'default',
}: {
  title: string
  badge?: string
  children: ReactNode
  variant?: 'default' | 'highlight'
}) {
  return (
    <section className={cn('cf-section', variant === 'highlight' && 'cf-section--highlight')}>
      <div className="cf-section__head">
        <h3 className="cf-section__title">{title}</h3>
        {badge ?
          <span className="cf-section__badge">{badge}</span>
        : null}
      </div>
      <div className="cf-section__body">{children}</div>
    </section>
  )
}

export function FormatToggle({
  value,
  onChange,
}: {
  value: 'in-person' | 'virtual'
  onChange: (v: 'in-person' | 'virtual') => void
}) {
  return (
    <div className="cf-format-toggle" role="group" aria-label="Event format">
      {(
        [
          { id: 'in-person' as const, label: 'In person' },
          { id: 'virtual' as const, label: 'Virtual' },
        ] as const
      ).map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className="cf-format-toggle__btn focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)]"
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function WizardCheckbox({
  id,
  label,
  checked,
  onChange,
  description,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={cn('cf-check-row', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-dc-border-strong bg-dc-elevated-solid text-dc-accent focus:ring-[var(--ecke-focus-ring)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-dc-text">{label}</span>
        {description ?
          <span className="cf-section__hint mt-0.5 block">{description}</span>
        : null}
      </span>
    </label>
  )
}

export function StickyWizardFooter({
  leftLabel,
  onLeft,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  primaryTestId,
}: {
  leftLabel: string
  onLeft: () => void
  onPrimary: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  primaryLoading?: boolean
  primaryTestId?: string
}) {
  return (
    <div className="cf-footer-actions">
      <Button type="button" variant="ghost" size="md" onClick={onLeft} className="min-h-touch min-w-[5.5rem]">
        {leftLabel}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={onPrimary}
        disabled={primaryDisabled || primaryLoading}
        data-testid={primaryTestId}
        className="min-h-touch min-w-[5.5rem]"
      >
        {primaryLoading ? 'Publishing…' : primaryLabel}
      </Button>
    </div>
  )
}

export const GROUP_CREATE_STEPS = ['Basics', 'Community', 'Review'] as const

export function GroupCreateStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav className="cf-stepper" aria-label="Create group steps">
      <ol className="cf-stepper__list">
        {GROUP_CREATE_STEPS.map((label, i) => {
          const stepNum = i + 1
          const active = currentStep === stepNum
          const done = currentStep > stepNum
          return (
            <li key={label} className="cf-stepper__item">
              <div
                className={cn(
                  'cf-stepper__track',
                  active && 'cf-stepper__track--active',
                  done && 'cf-stepper__track--done',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'cf-stepper__label',
                  active && 'cf-stepper__label--active',
                  done && 'cf-stepper__label--done',
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PreviewRow({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-dc-micro font-medium uppercase tracking-wide text-dc-text-muted sm:w-36">
        {label}
      </dt>
      <dd className={cn('text-sm', missing ? 'text-dc-danger' : 'text-dc-text')}>{value}</dd>
    </div>
  )
}

export function PreviewSummary({ children }: { children: ReactNode }) {
  return <dl className="cf-preview">{children}</dl>
}
