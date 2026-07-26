import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const controlClass =
  'mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-base text-dc-text placeholder:text-dc-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent sm:text-sm'

type FieldShellProps = {
  id: string
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  children: ReactNode
  className?: string
}

function FieldShell({ id, label, hint, optional, children, className }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-dc-text">
        {label}
        {optional ? <span className="ml-1 font-normal text-dc-text-muted">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed text-dc-text-muted">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  )
}

type WizardFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  wrapClassName?: string
}

export function WizardField({ label, hint, optional, wrapClassName, className, ...props }: WizardFieldProps) {
  const generatedId = useId()
  const id = props.name ? `wf-${props.name}` : generatedId
  return (
    <FieldShell id={id} label={label} hint={hint} optional={optional} className={wrapClassName}>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cn(controlClass, className)} {...props} />
    </FieldShell>
  )
}

type WizardTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  wrapClassName?: string
}

export function WizardTextarea({ label, hint, optional, wrapClassName, className, rows = 3, ...props }: WizardTextareaProps) {
  const generatedId = useId()
  const id = props.name ? `wf-${props.name}` : generatedId
  return (
    <FieldShell id={id} label={label} hint={hint} optional={optional} className={wrapClassName}>
      <textarea
        id={id}
        rows={rows}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(controlClass, className)}
        {...props}
      />
    </FieldShell>
  )
}

type WizardSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  optional?: boolean
  wrapClassName?: string
  children: ReactNode
}

export function WizardSelect({ label, hint, optional, wrapClassName, className, children, ...props }: WizardSelectProps) {
  const generatedId = useId()
  const id = props.name ? `wf-${props.name}` : generatedId
  return (
    <FieldShell id={id} label={label} hint={hint} optional={optional} className={wrapClassName}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cn(controlClass, className)} {...props}>
        {children}
      </select>
    </FieldShell>
  )
}
