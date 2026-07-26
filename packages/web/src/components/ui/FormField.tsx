import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { premiumInputClass } from '@/lib/card-surface'

export { premiumInputClass }

type Props = {
  id: string
  label: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}

export default function FormField({ id, label, hint, error, className, children }: Props) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium tracking-tight text-dc-text">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-dc-micro leading-snug text-dc-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-dc-micro font-medium leading-snug text-dc-danger">
          {error}
        </p>
      ) : null}
      {/* Consumer components should pass aria-describedby={describedBy || undefined}. */}
      <span className="sr-only">{describedBy}</span>
    </div>
  )
}
