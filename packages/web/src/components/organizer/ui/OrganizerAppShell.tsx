import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import OrganizerBreadcrumbs, { type BreadcrumbItem } from '@/components/organizer/ui/OrganizerBreadcrumbs'
import OrganizerSidebarNav from '@/components/organizer/ui/OrganizerSidebarNav'
import OrganizerStatusBar from '@/components/organizer/ui/OrganizerStatusBar'
import OrganizerCommandPalette, { type CommandAction } from '@/components/organizer/ui/OrganizerCommandPalette'
import { type OrganizerTab } from '@/lib/organizer/types'

type Props = {
  scopeKind: 'hub' | 'org' | 'group' | 'convention'
  title: string
  subtitle?: string
  eyebrow?: string
  roleBadge?: string | null
  breadcrumbs?: BreadcrumbItem[]
  publicHubHref?: string
  activeTab?: OrganizerTab
  onTabChange?: (tab: OrganizerTab) => void
  showSettings?: boolean
  showModeration?: boolean
  showPayments?: boolean
  commandActions?: CommandAction[]
  statusBarLeft?: ReactNode
  statusBarRight?: ReactNode
  contextRail?: ReactNode
  headerActions?: ReactNode
  sidebarBrand?: ReactNode
  children: ReactNode
}

export default function OrganizerAppShell({
  scopeKind,
  title,
  subtitle,
  eyebrow = 'Organizer dashboard',
  roleBadge,
  breadcrumbs,
  publicHubHref,
  activeTab,
  onTabChange,
  showSettings = true,
  showModeration = true,
  showPayments = false,
  commandActions = [],
  statusBarLeft,
  statusBarRight,
  contextRail,
  headerActions,
  sidebarBrand,
  children,
}: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  const defaultCommands = useMemo<CommandAction[]>(() => {
    const cmds: CommandAction[] = [{ id: 'hub', label: 'Organizer hub', href: '/organizer' }]
    if (publicHubHref) cmds.push({ id: 'public', label: 'Open public community hub', href: publicHubHref })
    return cmds
  }, [publicHubHref])

  const allCommands = useMemo(() => [...commandActions, ...defaultCommands], [commandActions, defaultCommands])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    },
    [],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const showSidebar = scopeKind !== 'hub' && activeTab && onTabChange

  return (
    <div className="organizer-shell mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
      <header className="mb-5 space-y-3">
        {breadcrumbs && breadcrumbs.length > 0 ?
          <OrganizerBreadcrumbs items={breadcrumbs} />
        : scopeKind !== 'hub' ?
          <Link
            to="/organizer"
            className="inline-flex min-h-10 items-center text-xs text-dc-muted transition-colors hover:text-dc-accent"
          >
            ← Organizer hub
          </Link>
        : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">{eyebrow}</p>
            <h1 className="text-xl font-semibold text-dc-text sm:text-2xl">{title}</h1>
            {subtitle ?
              <p className="max-w-2xl text-sm leading-snug text-dc-text-muted">{subtitle}</p>
            : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            {publicHubHref ?
              <Link
                to={publicHubHref}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-3 text-xs text-dc-text-muted transition-colors hover:border-dc-border-strong hover:text-dc-text"
              >
                View public hub
              </Link>
            : null}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-xs text-dc-muted transition-colors hover:border-dc-border-strong hover:text-dc-text"
              title="Command palette (Ctrl+K)"
              aria-label="Open command palette"
            >
              <span className="hidden sm:inline" aria-hidden>
                ⌘
              </span>
              <span>K</span>
            </button>
            {roleBadge ?
              <span className="inline-flex min-h-11 items-center rounded-full border border-dc-accent-border/40 bg-dc-accent/10 px-3 text-[11px] font-medium uppercase tracking-wide text-dc-accent">
                {roleBadge}
              </span>
            : null}
          </div>
        </div>
      </header>

      <div className={`flex gap-5 lg:gap-6 ${showSidebar ? 'flex-col lg:flex-row' : ''}`}>
        {showSidebar ?
          <aside className="shrink-0 lg:w-[var(--organizer-sidebar-width)] lg:sticky lg:top-4 lg:self-start">
            {sidebarBrand ?
              <div className="mb-4 hidden lg:block">{sidebarBrand}</div>
            : null}
            <OrganizerSidebarNav
              active={activeTab!}
              onChange={onTabChange!}
              showSettings={showSettings}
              showModeration={showModeration}
              showPayments={showPayments}
            />
          </aside>
        : null}

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <main className="min-w-0 flex-1">{children}</main>
          <OrganizerStatusBar left={statusBarLeft} right={statusBarRight} />
        </div>

        {contextRail ?
          <aside className="hidden w-56 shrink-0 space-y-4 border-dc-border xl:block xl:border-l xl:pl-6">
            {contextRail}
          </aside>
        : null}
      </div>

      <OrganizerCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={allCommands} />
    </div>
  )
}
