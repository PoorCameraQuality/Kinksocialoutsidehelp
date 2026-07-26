import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type StatusTone = 'error' | 'warning' | 'success' | 'info'

type Props = {
  tone?: StatusTone
  children: ReactNode
  className?: string
}

const toneClasses: Record<StatusTone, string> = {
  error: 'border-dc-danger-border bg-dc-danger-muted text-dc-danger',
  warning: 'border-dc-warning/40 bg-dc-warning-muted text-dc-warning',
  success: 'border-dc-success/40 bg-dc-success-muted text-dc-success',
  info: 'border-dc-border-strong bg-dc-elevated-muted text-dc-text-muted',
}

export default function StatusBanner({ tone = 'info', children, className }: Props) {
  return (
    <div role="status" className={cn('rounded-xl border px-3 py-2 text-sm', toneClasses[tone], className)}>
      {children}
    </div>
  )
}
