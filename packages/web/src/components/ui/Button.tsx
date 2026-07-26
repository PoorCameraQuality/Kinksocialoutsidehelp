import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-dc-accent-border bg-dc-accent text-dc-accent-foreground shadow-[0_1px_0_rgb(255_255_255/0.08)] hover:bg-dc-accent-hover hover:border-[color-mix(in_srgb,var(--dc-accent-border)_85%,white)]',
  secondary:
    'border border-dc-border-strong/80 bg-transparent text-dc-text hover:border-[color-mix(in_srgb,var(--dc-accent)_22%,var(--dc-border-strong))] hover:bg-dc-elevated-muted',
  ghost:
    'border border-transparent bg-transparent text-dc-text-muted hover:border-dc-border/60 hover:bg-dc-elevated-muted hover:text-dc-text',
  danger:
    'border border-dc-danger-border bg-dc-danger text-dc-accent-foreground hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-touch gap-1.5 px-3 py-2 text-sm',
  md: 'min-h-touch gap-2 px-4 py-2.5 text-sm',
}

export default function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'dc-premium-btn inline-flex items-center justify-center rounded-xl font-semibold motion-reduce:transition-none motion-reduce:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring,color-mix(in_srgb,var(--dc-accent)_48%,transparent))] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
