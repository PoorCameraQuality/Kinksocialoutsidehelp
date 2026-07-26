import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'border-dc-accent-border bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover focus-visible:ring-dc-accent',
  secondary:
    'border-dc-border bg-dc-elevated-muted/80 text-dc-text hover:border-dc-border-strong focus-visible:ring-dc-accent',
  ghost:
    'border-transparent bg-transparent text-dc-accent-foreground hover:bg-dc-accent-muted focus-visible:ring-dc-accent',
  danger:
    'border-dc-danger-border bg-dc-danger-muted text-dc-danger hover:bg-dc-danger/20 focus-visible:ring-dc-danger',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
