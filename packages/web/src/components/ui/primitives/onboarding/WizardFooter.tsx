import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'
import { LoadingButton } from '../layout'
import type { WizardFooterAction } from './types'

type WizardFooterProps = {
  /** Primary forward action (Continue / Finish). */
  next: WizardFooterAction & { label?: string }
  /** Back action — rendered as a low-emphasis control. */
  back?: WizardFooterAction
  /** Optional skip action for skippable steps. */
  skip?: WizardFooterAction
  /** Optional status / hint line. */
  status?: ReactNode
  className?: string
}

function BackControl({ action }: { action: WizardFooterAction }) {
  if (action.href) {
    return (
      <Link
        to={action.href}
        className="inline-flex min-h-touch items-center rounded-xl border border-transparent px-4 text-sm font-semibold text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text"
      >
        {action.label}
      </Link>
    )
  }
  return (
    <Button variant="ghost" onClick={action.onClick} disabled={action.disabled || action.loading}>
      {action.label}
    </Button>
  )
}

/**
 * Wizard navigation footer. Sticky bottom bar on mobile (sits above the bottom nav),
 * inline at the end of the content column on desktop. Present on every step.
 */
export function WizardFooter({ next, back, skip, status, className }: WizardFooterProps) {
  const nextLabel = next.label ?? 'Continue'
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t border-dc-border/80 bg-dc-surface/95 backdrop-blur-md safe-area-pb c2k-fixed-above-bottom-nav',
        'lg:static lg:z-auto lg:mt-8 lg:border-t lg:bg-transparent lg:backdrop-blur-none lg:pt-6',
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-0 lg:py-0">
        {status ? (
          <p className="w-full min-w-0 truncate text-xs text-dc-text-muted sm:flex-1" role="status">
            {status}
          </p>
        ) : null}
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          {back ? <BackControl action={back} /> : null}
          {skip ? (
            skip.href ? (
              <Link
                to={skip.href}
                className="inline-flex min-h-touch items-center rounded-xl px-3 text-sm font-medium text-dc-text-muted hover:text-dc-text"
              >
                {skip.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={skip.onClick}
                disabled={skip.disabled || skip.loading}
                className="inline-flex min-h-touch items-center rounded-xl px-3 text-sm font-medium text-dc-text-muted hover:text-dc-text disabled:opacity-50"
              >
                {skip.label}
              </button>
            )
          ) : null}
        </div>
        <div className="ml-auto flex items-center">
          {next.href ? (
            <Link
              to={next.href}
              className="dc-premium-btn inline-flex min-h-touch min-w-[8rem] items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent px-4 py-2.5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              {nextLabel}
            </Link>
          ) : (
            <LoadingButton
              loading={next.loading}
              disabled={next.disabled}
              onClick={next.onClick}
              className="min-w-[8rem]"
            >
              {nextLabel}
            </LoadingButton>
          )}
        </div>
      </div>
    </div>
  )
}
