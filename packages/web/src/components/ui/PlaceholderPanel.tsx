import type { ReactNode } from 'react'

/**
 * Reusable empty / coming-soon panel (design audit P2 - consistent placeholder anatomy).
 */
export default function PlaceholderPanel({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-dc-border bg-dc-elevated/80 px-6 py-12 text-center shadow-[var(--dc-shadow-soft)] ${className}`}
      role="status"
    >
      <p className="text-lg font-semibold text-dc-text">{title}</p>
      {description && <p className="mt-2 text-sm text-dc-text-muted">{description}</p>}
      {children}
    </div>
  )
}
