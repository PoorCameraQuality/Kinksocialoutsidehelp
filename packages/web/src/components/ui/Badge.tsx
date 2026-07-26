import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'neutral' | 'accent' | 'danger' | 'success'

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
  /** Pill shape for filter/metadata chips; default rounded-md for status labels */
  shape?: 'pill' | 'rounded'
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral:
    'border border-dc-border/70 bg-dc-elevated-muted/80 text-dc-text-muted',
  accent:
    'border border-dc-accent-border/35 bg-dc-accent/12 text-dc-accent',
  danger:
    'border border-dc-danger-border/50 bg-dc-danger-muted text-dc-danger',
  success:
    'border border-dc-success/35 bg-dc-success-muted text-dc-success',
}

export default function Badge({ className, variant = 'neutral', shape = 'rounded', ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-dc-micro font-medium tracking-normal',
        shape === 'pill' ? 'rounded-full' : 'rounded-md uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
