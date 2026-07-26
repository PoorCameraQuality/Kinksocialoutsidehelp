import { useEffect, useId, useState, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  description?: string
  footer?: ReactNode
  className?: string
  /** Centered modal (default) or bottom sheet on small screens. */
  variant?: 'centered' | 'sheet'
  maxWidthClass?: string
  /** Scrollable body + sticky footer (sheet variant). */
  layout?: 'default' | 'wizard'
  panelRef?: Ref<HTMLDivElement>
  /** Rendered beside the title (e.g. close control). */
  headerExtra?: ReactNode
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className = '',
  variant = 'centered',
  maxWidthClass = 'max-w-md',
  layout = 'default',
  panelRef,
  headerExtra,
}: Props) {
  const titleId = useId()
  const descId = useId()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !mounted) return null

  const panelClass =
    variant === 'sheet' ?
      layout === 'wizard' ?
        `dc-premium-sheet dc-sheet-enter relative z-10 flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border sm:h-auto sm:max-h-[min(88vh,40rem)] sm:rounded-2xl ${maxWidthClass}`
      : `dc-premium-sheet dc-sheet-enter relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl ${maxWidthClass}`
    : `dc-dialog-enter relative z-10 w-full ${maxWidthClass} rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-panel)]`

  const alignClass =
    variant === 'sheet' ?
      layout === 'wizard' ?
        'items-stretch justify-center p-0 sm:items-end sm:p-4 sm:items-center'
      : 'items-end justify-center p-0 sm:items-center sm:p-4'
    : 'items-end justify-center p-4 sm:items-center'

  return createPortal(
    <div className={`fixed inset-0 z-dc-modal flex ${alignClass}`} role="presentation">
      <button
        type="button"
        className="dc-premium-backdrop absolute inset-0"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`${panelClass} ${variant === 'sheet' ? 'p-0' : ''} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {variant === 'sheet' ?
          layout === 'wizard' ?
            <>
              <div className="cf-wizard-header flex shrink-0 items-start justify-between gap-3 border-b border-dc-border px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-lg font-semibold text-dc-text">
                    {title}
                  </h2>
                  {description ?
                    <p id={descId} className="mt-1 text-sm text-dc-text-muted">
                      {description}
                    </p>
                  : null}
                </div>
                {headerExtra}
              </div>
              <div className="cf-wizard-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm text-dc-text">
                {children}
              </div>
              {footer ?
                <div className="cf-wizard-footer flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-dc-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              : null}
            </>
          : <>
              <div className="border-b border-dc-border px-5 py-4">
                <h2 id={titleId} className="text-lg font-semibold text-dc-text">
                  {title}
                </h2>
                {description ?
                  <p id={descId} className="mt-1 text-sm text-dc-muted">
                    {description}
                  </p>
                : null}
              </div>
              <div className="px-5 py-4 text-sm text-dc-text-muted">{children}</div>
              {footer ?
                <div className="flex flex-wrap justify-end gap-2 border-t border-dc-border px-5 py-4">{footer}</div>
              : null}
            </>
        : <>
            <h2 id={titleId} className="text-lg font-semibold text-dc-text">
              {title}
            </h2>
            {description ?
              <p id={descId} className="mt-1 text-sm text-dc-muted">
                {description}
              </p>
            : null}
            <div className="mt-3 text-sm text-dc-text-muted">{children}</div>
            {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          </>
        }
      </div>
    </div>,
    document.body,
  )
}
