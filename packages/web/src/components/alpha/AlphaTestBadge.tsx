'use client'

import type { AlphaContentLabel } from '@c2k/shared'
import { cn } from '@/lib/cn'

type Props = {
  label?: AlphaContentLabel | null
  className?: string
  /** Compact pill for cards; banner for profile headers. */
  variant?: 'pill' | 'banner'
}

export default function AlphaTestBadge({ label, className, variant = 'pill' }: Props) {
  if (!label) return null

  const tooltip = label.note

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-dc-caption text-amber-100/90',
          className,
        )}
        title={tooltip}
        role="note"
        aria-label={`${label.text}. ${tooltip}`}
      >
        <span className="font-semibold uppercase tracking-wide text-amber-200">{label.text} PROFILE</span>
        <span className="mt-0.5 block text-dc-text-muted">{tooltip}</span>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wide text-amber-200',
        className,
      )}
      title={tooltip}
      aria-label={`${label.text}. ${tooltip}`}
    >
      {label.text}
    </span>
  )
}

export type { AlphaContentLabel }
