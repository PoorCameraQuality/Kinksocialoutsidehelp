'use client'

import Link from 'next/link'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { commandPermissionIncludes } from '@c2k/shared'
import { useOrganizerSubPath, useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import type { PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { PEOPLE_ACTION_PARAM, type PeopleAction } from '@/components/dancecard/organizer/people/peopleHubConfig'
import { organizerConventionApiBase } from '@/components/dancecard/organizer/organizerApi'
import { readOnlyForPeopleSubTab } from '@/lib/dancecard/commandBridgeNavPermissions'

type Props = {
  eventSlug: string
  readOnly: boolean
  permissions: ConventionCommandPermissions
  onNavigateTab: (tab: PeopleSubTab, action?: PeopleAction) => void
}

export function PeopleHubHeader({ eventSlug, readOnly, permissions, onNavigateTab }: Props) {
  const doorHref = useOrganizerSubPath('door')
  const badgesHref = useOrganizerTabHref('people', { peopleTab: 'badges' })
  const canRegistration = commandPermissionIncludes('registration', permissions)
  const canStaffOps = commandPermissionIncludes('staff_ops', permissions)
  const signupsReadOnly = readOnly || readOnlyForPeopleSubTab('signups', permissions)
  const staffReadOnly = readOnly || readOnlyForPeopleSubTab('staff', permissions)

  async function exportCsv() {
    const url = `${organizerConventionApiBase(eventSlug)}/registrants/export`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `registrants-${eventSlug}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const actions: { label: string; href?: string; onClick?: () => void; primary?: boolean }[] = []

  if (canRegistration) {
    actions.push({ label: 'Open door mode', href: doorHref, primary: true })
  }
  if (canRegistration && !signupsReadOnly) {
    actions.push({ label: 'Add signup', onClick: () => onNavigateTab('signups', 'addSignup') })
    actions.push({ label: 'Import signups', onClick: () => onNavigateTab('signups', 'importSignups') })
  }
  if (canRegistration) {
    actions.push({ label: 'Export registrants', onClick: () => void exportCsv() })
  }
  if (canStaffOps) {
    actions.push({ label: 'Print badges', href: badgesHref })
  }
  if (canStaffOps && !staffReadOnly) {
    actions.push({ label: 'Add staff shift', onClick: () => onNavigateTab('staff', 'addShift') })
  }

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-dc-text sm:text-3xl">People</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-dc-muted">
            Manage registration, check-in, roster, staff, roles, badges, coverage, incidents, and compliance.
          </p>
        </div>
        {actions.length ? (
          <div className="flex max-w-full flex-wrap justify-end gap-2">
            {actions.map((a) => {
              const cls = a.primary
                ? 'min-h-10 inline-flex items-center rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover'
                : 'min-h-10 inline-flex items-center rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-surface-muted'
              if (a.href) {
                return (
                  <Link key={a.label} href={a.href} className={cls}>
                    {a.label}
                  </Link>
                )
              }
              return (
                <button key={a.label} type="button" className={cls} onClick={a.onClick}>
                  {a.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function peopleActionHref(baseHref: string, action: PeopleAction): string {
  const u = new URL(baseHref, 'http://local')
  u.searchParams.set(PEOPLE_ACTION_PARAM, action)
  return `${u.pathname}${u.search}`
}
