import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export type AutosaveBarState = 'saving' | 'saved' | 'error' | 'offline' | 'idle'

type Props = {
  state: AutosaveBarState
  message: string
  onRetry?: () => void
  onDiscard?: () => void
  showDiscard?: boolean
}

export default function ProfileStudioSaveBar({
  state,
  message,
  onRetry,
  onDiscard,
  showDiscard,
}: Props) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t border-dc-border/80 bg-dc-surface/95 backdrop-blur-md safe-area-pb c2k-fixed-above-bottom-nav lg:static lg:z-auto lg:mt-6 lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none',
      )}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 md:py-0">
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-xs sm:text-sm',
            state === 'error' ? 'text-dc-warning'
            : state === 'offline' ? 'text-dc-muted'
            : state === 'saving' ? 'text-dc-muted'
            : 'text-dc-muted',
          )}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {state === 'error' && onRetry ?
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-touch items-center rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Retry
            </button>
          : null}
          {showDiscard && onDiscard ?
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex min-h-touch items-center rounded-lg border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
            >
              Discard
            </button>
          : null}
          <Link
            to="/profile"
            className="inline-flex min-h-touch items-center rounded-lg border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
          >
            Exit Studio
          </Link>
        </div>
      </div>
    </div>
  )
}
