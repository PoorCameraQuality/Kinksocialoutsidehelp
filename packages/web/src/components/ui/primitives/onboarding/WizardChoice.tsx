import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type WizardChoiceCardProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  selected: boolean
  onSelect: () => void
  /** Checkbox semantics (multi-select) vs radio (single). Controls a11y + indicator shape. */
  multi?: boolean
  disabled?: boolean
  /** Recommended badge shown in the top-right. */
  badge?: ReactNode
  className?: string
}

function SelectionIndicator({ selected, multi }: { selected: boolean; multi?: boolean }) {
  return (
    <span
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors motion-reduce:transition-none',
        multi ? 'rounded-md' : 'rounded-full',
        selected ? 'border-dc-accent-border bg-dc-accent text-dc-accent-foreground' : 'border-dc-border bg-dc-elevated-solid',
      )}
      aria-hidden
    >
      {selected ? (
        multi ? (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="h-2 w-2 rounded-full bg-dc-accent-foreground" />
        )
      ) : null}
    </span>
  )
}

/** A selectable card for single- or multi-select choices (intents, presets, categories, tracks). */
export function WizardChoiceCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  multi = false,
  disabled = false,
  badge,
  className,
}: WizardChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(
        'group relative flex min-h-touch w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface',
        selected
          ? 'border-dc-accent-border bg-dc-accent-muted/40 shadow-[0_0_0_1px_var(--dc-accent-border)]'
          : 'border-dc-border bg-dc-elevated-solid hover:border-dc-border-strong hover:bg-dc-elevated-muted',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <SelectionIndicator selected={selected} multi={multi} />
      {icon ? (
        <span className={cn('mt-0.5 shrink-0', selected ? 'text-dc-accent' : 'text-dc-text-muted')} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-dc-text">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-full border border-dc-accent-border bg-dc-accent-muted px-2 py-0.5 text-[11px] font-medium text-dc-accent">
              {badge}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="mt-1 block text-sm leading-relaxed text-dc-text-muted">{description}</span>
        ) : null}
      </span>
    </button>
  )
}

type WizardChoiceGridProps = {
  children: ReactNode
  /** Single-select uses radiogroup semantics; multi uses group. */
  multi?: boolean
  label?: string
  columns?: 1 | 2
  className?: string
}

/** Layout + a11y wrapper for a set of WizardChoiceCards. */
export function WizardChoiceGrid({ children, multi = false, label, columns = 2, className }: WizardChoiceGridProps) {
  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-label={label}
      className={cn('grid gap-2.5', columns === 2 ? 'sm:grid-cols-2' : '', className)}
    >
      {children}
    </div>
  )
}
