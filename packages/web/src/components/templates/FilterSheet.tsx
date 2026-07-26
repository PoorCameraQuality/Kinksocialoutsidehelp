import type { ReactNode } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  activeFilterCount?: number
  onApply?: () => void
  onClear?: () => void
  children: ReactNode
  applyLabel?: string
  clearLabel?: string
  /** Live-apply mode hides Apply; Clear still available */
  liveApply?: boolean
}

/**
 * Mobile filter bottom sheet — canonical filter UX for directory routes.
 * Desktop: centered dialog (Dialog sheet variant sm:center).
 */
export default function FilterSheet({
  open,
  onClose,
  title = 'Filters',
  activeFilterCount = 0,
  onApply,
  onClear,
  children,
  applyLabel = 'Apply filters',
  clearLabel = 'Clear all',
  liveApply = false,
}: Props) {
  const heading = activeFilterCount > 0 ? `${title} (${activeFilterCount})` : title

  const footer = (
    <>
      {onClear ?
        <Button type="button" variant="secondary" onClick={onClear}>
          {clearLabel}
        </Button>
      : null}
      {!liveApply && onApply ?
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            onApply()
            onClose()
          }}
        >
          {applyLabel}
        </Button>
      : (
        <Button type="button" variant="primary" onClick={onClose}>
          Done
        </Button>
      )}
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={heading}
      variant="sheet"
      layout="wizard"
      footer={footer}
      maxWidthClass="max-w-lg"
      headerExtra={
        <button
          type="button"
          onClick={onClose}
          className="dc-premium-btn inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)]"
          aria-label="Close filters"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      }
    >
      {children}
    </Dialog>
  )
}
