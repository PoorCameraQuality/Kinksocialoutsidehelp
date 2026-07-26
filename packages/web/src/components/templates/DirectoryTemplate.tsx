import type { ReactNode } from 'react'
import PageHeader from '@/components/shell/PageHeader'
import { cn } from '@/lib/cn'
import { shellDirectoryClass } from '@/lib/shell-contract'

type Props = {
  title: string
  description?: string
  headerActions?: ReactNode
  /** Search row + filter trigger area */
  toolbar?: ReactNode
  resultSummary?: ReactNode
  /** Desktop left rail (filters, nav) */
  desktopSidebar?: ReactNode
  /** Optional right rail on xl+ (or lg+ when desktopAsideFrom is lg) */
  desktopAside?: ReactNode
  /** When to show desktopAside — People uses lg; Events uses xl (default). */
  desktopAsideFrom?: 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Skip default PageHeader when custom header provided */
  header?: ReactNode
}

function directoryGridClass(desktopSidebar?: ReactNode, desktopAside?: ReactNode): string | null {
  const base = 'grid grid-cols-1 gap-6'
  if (desktopSidebar && desktopAside) {
    return `${base} lg:grid-cols-[minmax(240px,260px)_minmax(0,1fr)_minmax(260px,300px)]`
  }
  if (desktopSidebar) {
    return `${base} lg:grid-cols-[minmax(240px,260px)_minmax(0,1fr)]`
  }
  if (desktopAside) {
    return `${base} lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]`
  }
  return null
}

/**
 * Directory / list pages — search, filters, responsive grid or list.
 */
export default function DirectoryTemplate({
  title,
  description,
  headerActions,
  toolbar,
  resultSummary,
  desktopSidebar,
  desktopAside,
  desktopAsideFrom = 'xl',
  children,
  footer,
  className,
  header,
}: Props) {
  const gridClass = directoryGridClass(desktopSidebar, desktopAside)
  const asideVisibility = desktopAsideFrom === 'lg' ? 'hidden lg:block' : 'hidden xl:block'

  return (
    <div className={cn(shellDirectoryClass, 'py-6', className)}>
      {header ?? (
        <PageHeader title={title} description={description} actions={headerActions} sticky={false} className="mb-6" />
      )}

      {toolbar ? <div className="mb-4 space-y-3">{toolbar}</div> : null}
      {resultSummary ? <div className="mb-4 text-sm text-dc-muted">{resultSummary}</div> : null}

      {gridClass ?
        <div className={gridClass}>
          {desktopSidebar ?
            <div className="hidden lg:block">{desktopSidebar}</div>
          : null}
          <main className="min-w-0">{children}</main>
          {desktopAside ?
            <div className={asideVisibility}>{desktopAside}</div>
          : null}
        </div>
      : <main className="min-w-0">{children}</main>}

      {footer}
    </div>
  )
}

export function DirectoryFilterButton({
  onClick,
  activeFilterCount = 0,
  className,
}: {
  onClick: () => void
  activeFilterCount?: number
  className?: string
}) {
  const label = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'dc-premium-btn inline-flex min-h-touch shrink-0 items-center justify-center rounded-xl border border-dc-border-strong/80 bg-dc-elevated-solid px-5 text-sm font-semibold text-dc-text hover:border-[color-mix(in_srgb,var(--dc-accent)_22%,var(--dc-border-strong))] hover:bg-dc-elevated-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface lg:hidden',
        className,
      )}
    >
      {label}
    </button>
  )
}
