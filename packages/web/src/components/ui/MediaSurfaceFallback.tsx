import { cn } from '@/lib/cn'

type Variant = 'event' | 'article' | 'video' | 'generic'

type Props = {
  variant?: Variant
  label?: string
  className?: string
  compact?: boolean
}

function FallbackIcon({ variant, compact }: { variant: Variant; compact?: boolean }) {
  const size = compact ? 'h-5 w-5' : 'h-10 w-10'
  const stroke = compact ? 1.75 : 1.5

  if (variant === 'video') {
    return (
      <svg className={size} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    )
  }

  if (variant === 'article') {
    return (
      <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={stroke}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    )
  }

  return (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={stroke}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

/** Gradient + icon placeholder when listing media is missing (Sprint 1 CP7). */
export default function MediaSurfaceFallback({ variant = 'generic', label, className, compact }: Props) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-dc-accent/15 via-dc-surface-muted to-dc-elevated-solid text-dc-muted/80',
        className,
      )}
      aria-hidden
    >
      {label && !compact ?
        <span className="mb-2 max-w-[85%] truncate text-center text-[10px] font-semibold uppercase tracking-wide text-dc-accent/80">
          {label}
        </span>
      : null}
      <FallbackIcon variant={variant} compact={compact} />
    </div>
  )
}
