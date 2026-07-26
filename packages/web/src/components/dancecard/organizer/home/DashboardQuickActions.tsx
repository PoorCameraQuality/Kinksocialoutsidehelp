'use client'

import Link from 'next/link'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { isTabAllowed } from '@/lib/dancecard/commandBridgeNavPermissions'
import type { OrganizerTab, PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { Panel } from '@/components/dancecard/ui/Panel'
import { cn } from '@/lib/cn'

type Action = {
  id: string
  label: string
  tab?: OrganizerTab
  href?: string
  requires: (p: ConventionCommandPermissions) => boolean
}

const ACTIONS: Action[] = [
  { id: 'slot', label: 'Add program slot', tab: 'program', requires: (p) => isTabAllowed('program', p) },
  { id: 'import', label: 'Import schedule', tab: 'import', requires: (p) => isTabAllowed('import', p) },
  { id: 'venues', label: 'Room availability', tab: 'venues', requires: (p) => isTabAllowed('venues', p) },
  { id: 'signup', label: 'Add signup', tab: 'people', requires: (p) => p.registration || p.isFullAdmin },
  { id: 'staff', label: 'Add staff shift', tab: 'people', requires: (p) => p.staffOps || p.isFullAdmin },
  { id: 'message', label: 'Message campaign', tab: 'messaging', requires: (p) => isTabAllowed('messaging', p) },
  { id: 'badges', label: 'Print badges', tab: 'people', requires: (p) => p.staffOps || p.isFullAdmin },
  { id: 'export', label: 'Export registrants', tab: 'exports', requires: (p) => isTabAllowed('exports', p) },
]

export function DashboardQuickActions({
  permissions,
  doorHref,
  onNavigateTab,
}: {
  permissions: ConventionCommandPermissions
  doorHref: string
  onNavigateTab: (
    tab: OrganizerTab,
    opts?: {
      peopleTab?: PeopleSubTab
      settingsPanel?: string
      publishFilter?: 'draft'
    },
  ) => void
}) {
  const visible = ACTIONS.filter((a) => a.requires(permissions))
  const showDoor = permissions.registration || permissions.isFullAdmin

  if (!visible.length && !showDoor) return null

  return (
    <Panel>
      <h2 className="text-sm font-semibold text-dc-text">Quick actions</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {showDoor ? (
          <Link
            href={doorHref}
            className="rounded-xl border border-dc-accent-border bg-dc-accent-muted px-3 py-2.5 text-left text-sm font-medium text-dc-accent hover:bg-dc-accent-muted/80"
          >
            Open door mode
          </Link>
        ) : null}
        {visible.map((a) => (
          <button
            key={a.id}
            type="button"
            className={cn(
              'rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-left text-sm text-dc-text',
              'hover:border-dc-accent-border hover:bg-dc-surface-muted',
            )}
            onClick={() => {
              if (a.tab === 'people') {
                onNavigateTab('people', {
                  peopleTab: a.id === 'signup' ? 'signups' : a.id === 'staff' ? 'staff' : a.id === 'badges' ? 'badges' : undefined,
                })
              } else if (a.tab) {
                onNavigateTab(a.tab)
              }
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </Panel>
  )
}
