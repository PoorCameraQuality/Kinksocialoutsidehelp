'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PeopleDirectoryPanel } from '@/components/dancecard/organizer/PeopleDirectoryPanel'
import { RegistrantsPanel } from '@/components/dancecard/organizer/RegistrantsPanel'
import { StaffShiftsPanel } from '@/components/dancecard/organizer/StaffShiftsPanel'
import { ShiftSwapsPanel } from '@/components/dancecard/organizer/ShiftSwapsPanel'
import { VettingQueuePanel } from '@/components/dancecard/organizer/VettingQueuePanel'
import { BadgesPrintPanel } from '@/components/dancecard/organizer/BadgesPrintPanel'
import { DmCoveragePanel } from '@/components/dancecard/organizer/DmCoveragePanel'
import { SafetyIncidentsPanel } from '@/components/dancecard/organizer/SafetyIncidentsPanel'
import { VolunteerCompliancePanel } from '@/components/dancecard/organizer/VolunteerCompliancePanel'
import type { ConventionCommandPermissions } from '@c2k/shared'
import {
  filterPeopleSubTabsForTemplate,
  readOnlyForPeopleSubTab,
} from '@/lib/dancecard/commandBridgeNavPermissions'
import { usePeopleSubTab } from '@/components/dancecard/organizer/usePeopleSubTab'
import {
  ALL_PEOPLE_SUB_TABS,
  type PeopleSubTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { PeopleHubParticipationStrip } from '@/components/dancecard/organizer/PeopleHubParticipationStrip'
import { PeopleGroupedTabs } from '@/components/dancecard/organizer/people/PeopleGroupedTabs'
import { PeopleHelpCard } from '@/components/dancecard/organizer/people/PeopleHelpCard'
import { PeopleHubHeader } from '@/components/dancecard/organizer/people/PeopleHubHeader'
import { PeopleOpsSummaryRow } from '@/components/dancecard/organizer/people/PeopleOpsSummaryRow'
import { usePeopleOpsSummary } from '@/components/dancecard/organizer/people/usePeopleOpsSummary'
import { PEOPLE_ACTION_PARAM, type PeopleAction } from '@/components/dancecard/organizer/people/peopleHubConfig'
import { useOrganizerWorkspacePath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type Props = {
  eventSlug: string
  readOnly: boolean
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  shifts: OrganizerStaffShiftDto[]
  onRefreshStaff: () => Promise<void>
  hasEventWindow: boolean
  permissions: ConventionCommandPermissions
  peopleHubTemplate?: 'full' | 'munch'
}

export function PeopleHubPanel({
  eventSlug,
  readOnly,
  timezone,
  windowStartsAt,
  windowEndsAt,
  shifts,
  onRefreshStaff,
  hasEventWindow,
  permissions,
  peopleHubTemplate = 'full',
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspacePath = useOrganizerWorkspacePath(eventSlug)

  const allowedTabs = filterPeopleSubTabsForTemplate(
    ALL_PEOPLE_SUB_TABS,
    peopleHubTemplate,
    permissions,
  )
  const { peopleTab, setPeopleTab } = usePeopleSubTab(eventSlug, allowedTabs[0] ?? 'signups', allowedTabs)
  const { metrics, loading: metricsLoading } = usePeopleOpsSummary(eventSlug, permissions, shifts)

  const subTabReadOnly = (subTab: PeopleSubTab) => readOnly || readOnlyForPeopleSubTab(subTab, permissions)

  const navigateTab = useCallback(
    (next: PeopleSubTab, action?: PeopleAction) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', 'people')
      params.set('peopleTab', next)
      if (action) params.set(PEOPLE_ACTION_PARAM, action)
      else params.delete(PEOPLE_ACTION_PARAM)
      router.replace(`${workspacePath}?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, workspacePath],
  )

  const settingsHref = `${workspacePath}?tab=settings&settingsPanel=event`

  return (
    <div className="space-y-5">
      <PeopleHubParticipationStrip conventionKey={eventSlug} />
      <PeopleHubHeader
        eventSlug={eventSlug}
        readOnly={readOnly}
        permissions={permissions}
        onNavigateTab={navigateTab}
      />

      <PeopleOpsSummaryRow metrics={metrics} loading={metricsLoading} onNavigate={setPeopleTab} />

      <PeopleHelpCard />

      {peopleHubTemplate === 'munch' ? (
        <p className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          This event uses the Munch people template. Only Signups and Roster are shown.{' '}
          {permissions.isFullAdmin ? (
            <Link href={settingsHref} className="font-medium text-dc-accent hover:underline">
              Change in Event settings
            </Link>
          ) : (
            'Contact an admin to switch to the full People hub.'
          )}
        </p>
      ) : null}

      <PeopleGroupedTabs allowedTabs={allowedTabs} activeId={peopleTab} onChange={setPeopleTab} />

      <div
        id={`organizer-section-${peopleTab}`}
        role="tabpanel"
        aria-labelledby={`organizer-section-tab-${peopleTab}`}
        className="min-w-0"
      >
        {peopleTab === 'signups' ? (
          <RegistrantsPanel eventSlug={eventSlug} readOnly={subTabReadOnly('signups')} permissions={permissions} embedded />
        ) : null}
        {peopleTab === 'roster' ? (
          <PeopleDirectoryPanel eventSlug={eventSlug} timezone={timezone} readOnly={subTabReadOnly('roster')} embedded />
        ) : null}
        {peopleTab === 'staff' ? (
          <StaffShiftsPanel
            eventSlug={eventSlug}
            timezone={timezone}
            shifts={shifts}
            onRefresh={onRefreshStaff}
            readOnly={subTabReadOnly('staff')}
            embedded
          />
        ) : null}
        {peopleTab === 'applications' ? (
          <VettingQueuePanel eventSlug={eventSlug} permissions={permissions} embedded />
        ) : null}
        {peopleTab === 'swaps' ? (
          <ShiftSwapsPanel eventSlug={eventSlug} timezone={timezone} readOnly={subTabReadOnly('swaps')} embedded />
        ) : null}
        {peopleTab === 'badges' ? (
          <BadgesPrintPanel eventSlug={eventSlug} readOnly={subTabReadOnly('badges')} />
        ) : null}
        {peopleTab === 'incidents' ? (
          <SafetyIncidentsPanel
            eventSlug={eventSlug}
            permissions={permissions}
            readOnly={subTabReadOnly('incidents')}
          />
        ) : null}
        {peopleTab === 'compliance' ? (
          <VolunteerCompliancePanel eventSlug={eventSlug} />
        ) : null}
        {peopleTab === 'coverage' ? (
          hasEventWindow ? (
            <DmCoveragePanel
              eventSlug={eventSlug}
              timezone={timezone}
              windowStartsAt={windowStartsAt}
              windowEndsAt={windowEndsAt}
              shifts={shifts}
              onRefreshShifts={onRefreshStaff}
              readOnly={subTabReadOnly('coverage')}
              embedded
            />
          ) : (
            <PeopleEmptyState title="Set event dates first" actions={[{ label: 'Open Event settings', href: settingsHref, primary: true }]}>
              Coverage windows need the convention event window. Set start and end dates in Settings before building
              coverage requirements.
            </PeopleEmptyState>
          )
        ) : null}
      </div>
    </div>
  )
}
