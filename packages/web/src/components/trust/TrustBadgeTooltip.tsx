import type { ReactNode } from 'react'

type Props = {
  description: string
  children: ReactNode
}

export default function TrustBadgeTooltip({ description, children }: Props) {
  return (
    <span className="group relative inline-flex" title={description}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-[11px] leading-snug text-dc-text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        {description}
      </span>
    </span>
  )
}
