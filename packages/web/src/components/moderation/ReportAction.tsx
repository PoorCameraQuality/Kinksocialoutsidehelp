import { useState } from 'react'
import TsReportModal, { type TsReportTarget } from '@/components/moderation/TsReportModal'
import { labelReportTarget } from '@/lib/moderation/report-labels'

export type ReportActionVariant = 'button' | 'menu-item' | 'icon'

export type ReportActionProps = {
  targetType: string
  targetId: string
  /** Short label for modal title, e.g. "feed post", "message". */
  targetLabel?: string
  /** Route or surface hint for analytics/docs (optional). */
  surface?: string
  variant?: ReportActionVariant
  disabledReason?: string
  /** Optional intake context forwarded to the API when supported. */
  context?: Record<string, unknown>
  className?: string
  /** Hide when viewer owns content (default true). */
  hideForOwnContent?: boolean
  viewerUserId?: string | null
  contentAuthorId?: string | null
  onSubmitted?: () => void
  /** Called when the user activates the report control (e.g. close parent menu). */
  onTrigger?: () => void
}

function defaultContentLabel(targetType: string): string {
  return labelReportTarget(targetType).toLowerCase()
}

export default function ReportAction({
  targetType,
  targetId,
  targetLabel,
  surface: _surface,
  variant = 'menu-item',
  disabledReason,
  context: _context,
  className = '',
  hideForOwnContent = true,
  viewerUserId,
  contentAuthorId,
  onSubmitted,
  onTrigger,
}: ReportActionProps) {
  const [open, setOpen] = useState<TsReportTarget | null>(null)

  if (hideForOwnContent && viewerUserId && contentAuthorId && viewerUserId === contentAuthorId) {
    return null
  }

  if (disabledReason) {
    if (variant === 'icon') {
      return (
        <button
          type="button"
          disabled
          title={disabledReason}
          className={`opacity-40 cursor-not-allowed ${className}`}
          aria-label="Report unavailable"
        >
          Report
        </button>
      )
    }
    return null
  }

  const label = targetLabel ?? defaultContentLabel(targetType)

  const openModal = () => {
    onTrigger?.()
    setOpen({ targetType, targetId, label, context: _context } as TsReportTarget & {
      context?: Record<string, unknown>
    })
  }

  const trigger =
    variant === 'button' ?
      <button
        type="button"
        onClick={openModal}
        className={`min-h-10 px-3 text-sm text-dc-muted hover:text-dc-text ${className}`}
      >
        Report
      </button>
    : variant === 'icon' ?
      <button
        type="button"
        onClick={openModal}
        className={`min-h-8 min-w-8 rounded-lg text-dc-muted hover:text-dc-text hover:bg-dc-elevated-muted ${className}`}
        aria-label={`Report ${label}`}
        title="Report"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
      </button>
    : <button
        type="button"
        role="menuitem"
        onClick={openModal}
        className={`block w-full text-left px-3 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted ${className}`}
      >
        Report
      </button>

  return (
    <>
      {trigger}
      <TsReportModal
        open={open}
        onClose={() => setOpen(null)}
        onSubmitted={onSubmitted}
      />
    </>
  )
}
