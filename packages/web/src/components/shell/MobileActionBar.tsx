import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'

export type MobileActionBarAction = {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary' | 'destructive'
  loading?: boolean
  disabled?: boolean
}

type Props = {
  /** Status or hint line above actions on mobile */
  status?: ReactNode
  primary: MobileActionBarAction
  secondary?: MobileActionBarAction
  /** Extra trailing control (e.g. Done link) */
  trailing?: ReactNode
  className?: string
}

function actionVariantClasses(variant: MobileActionBarAction['variant']) {
  if (variant === 'destructive') {
    return 'bg-dc-danger text-dc-accent-foreground border border-dc-danger-border hover:opacity-90'
  }
  if (variant === 'secondary') {
    return 'bg-transparent text-dc-text border border-dc-border-strong hover:bg-dc-elevated-muted'
  }
  return ''
}

function ActionControl({ action, className }: { action: MobileActionBarAction; className?: string }) {
  const variant = action.variant ?? 'primary'
  const shared = cn(
    'min-h-touch min-w-[5.5rem] inline-flex items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50',
    variant !== 'primary' ? actionVariantClasses(variant) : '',
    className,
  )

  if (action.href) {
    return (
      <Link to={action.href} className={shared} aria-disabled={action.disabled}>
        {action.loading ? 'Loading…' : action.label}
      </Link>
    )
  }

  if (variant === 'primary') {
    return (
      <Button
        type="button"
        variant="primary"
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
        className={className}
      >
        {action.loading ? 'Loading…' : action.label}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={shared}
    >
      {action.loading ? 'Loading…' : action.label}
    </button>
  )
}

/**
 * Sticky primary actions for mobile — sits above bottom nav when present.
 * Desktop: inline flex row (no fixed positioning).
 */
export default function MobileActionBar({ status, primary, secondary, trailing, className }: Props) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t border-dc-border/80 bg-dc-surface/95 backdrop-blur-md safe-area-pb c2k-fixed-above-bottom-nav lg:static lg:z-auto lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none lg:mt-6',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6 md:px-0 md:py-0">
        {status ?
          <p className="w-full min-w-0 truncate text-xs text-dc-muted sm:w-auto sm:flex-1" role="status">
            {status}
          </p>
        : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {secondary ?
            <ActionControl action={{ ...secondary, variant: secondary.variant ?? 'secondary' }} />
          : null}
          <ActionControl action={primary} />
          {trailing}
        </div>
      </div>
    </div>
  )
}
