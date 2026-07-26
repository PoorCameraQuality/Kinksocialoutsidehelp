import type { ReactNode } from 'react'

export { PillTab as TabShellButton, handlePillTabListKeyDown } from '@/components/dancecard/ui/PillTab'

type TabShellProps = {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

/** ECKE-style rounded tab shell - children should be `TabShellButton` / `PillTab`. */
export default function TabShell({ children, className = '', 'aria-label': ariaLabel }: TabShellProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap gap-1 rounded-2xl border border-dc-border bg-dc-elevated-muted/80 p-1 shadow-[var(--dc-tab-shell-shadow)] ${className}`.trim()}
    >
      {children}
    </div>
  )
}
