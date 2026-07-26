import { useMemo } from 'react'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'
import type { OrgCalendarLoadState } from '@/lib/org-calendar-fetch'
import {
  buildOrgProgramRows,
  countUpcomingPrograms,
  orgCalendarVisibilityLabel,
  upcomingProgramRows,
  type OrgScheduleConvention,
  type OrgScheduleEvent,
} from '@/lib/organizer/org-schedule-programs'
import ProgramListSection from '@/components/organizer/schedule/ProgramListSection'
import UpcomingProgramsTimeline from '@/components/organizer/schedule/UpcomingProgramsTimeline'
import {
  OrganizationGlanceCard,
  ProgramEducationBlock,
  ProgramStatsRow,
  ProgramTypeChooser,
  PublicCalendarCard,
  ScheduleHelpCard,
  SchedulePageHeader,
} from '@/components/organizer/schedule/schedule-ui'

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  chatEnabled: boolean
  subgroupsEnabled?: boolean
}

type Props = {
  orgSlug: string
  orgId: string
  orgVisibility: string
  memberCount: number
  featureFlags: OrgFlags
  calendarEnabled: boolean
  calendarLoadState?: OrgCalendarLoadState
  showSettings: boolean
  conventions: OrgScheduleConvention[]
  events: OrgScheduleEvent[]
  viewerRole?: string | null
}

export default function OrganizerOrgSchedulePanel({
  orgSlug,
  orgId,
  orgVisibility,
  memberCount,
  featureFlags,
  calendarEnabled,
  calendarLoadState = 'ready',
  showSettings,
  conventions,
  events,
  viewerRole = null,
}: Props) {
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const publicCalendarHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Calendar`
  const settingsFeaturesHref = `${orgBase}?tab=settings&settingsSection=features`
  const settingsGeneralHref = `${orgBase}?tab=settings`

  const createFlows = useMemo((): {
    convention: OpenCreateFlowOptions | null
    event: OpenCreateFlowOptions | null
  } => {
    if (!calendarEnabled) return { convention: null, event: null }
    const event: OpenCreateFlowOptions = { type: 'event', prefillOrgId: orgId }
    const convention: OpenCreateFlowOptions | null =
      showSettings ? { type: 'convention', prefillOrgId: orgId } : null
    return { convention, event }
  }, [calendarEnabled, orgId, showSettings])

  const programRows = useMemo(() => buildOrgProgramRows(conventions, events), [conventions, events])
  const upcoming = useMemo(() => upcomingProgramRows(programRows), [programRows])
  const conventionCount = conventions.length
  const eventCount = events.filter((e) => !e.conventionSlug).length
  const upcomingCount = countUpcomingPrograms(programRows)
  const incompleteCount = programRows.filter((r) => r.incomplete).length
  const calendarLabel = orgCalendarVisibilityLabel(orgVisibility, calendarEnabled)

  return (
    <div className="space-y-5">
      <SchedulePageHeader
        calendarEnabled={calendarEnabled}
        createFlows={createFlows}
        publicCalendarHref={publicCalendarHref}
        settingsHref={settingsFeaturesHref}
        showSettings={showSettings}
      />

      {calendarLoadState === 'error' ?
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Could not load events and conventions. Refresh the page to try again.
        </p>
      : null}
      {calendarLoadState === 'disabled' && calendarEnabled ?
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Events &amp; conventions disabled in org settings.
          {showSettings ?
            <>
              {' '}
              <a href={settingsFeaturesHref} className="text-dc-accent hover:underline">
                Enable in Settings → Features
              </a>
            </>
          : null}
        </p>
      : null}

      {calendarEnabled && calendarLoadState !== 'error' ?
        <>
          <ProgramTypeChooser createFlows={createFlows} />
          <ProgramStatsRow
            conventionCount={conventionCount}
            eventCount={eventCount}
            upcomingCount={upcomingCount}
            incompleteCount={incompleteCount}
            calendarLabel={calendarLabel}
            calendarEnabled={calendarEnabled}
          />
        </>
      : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          <ProgramListSection
            rows={programRows}
            orgSlug={orgSlug}
            calendarEnabled={calendarEnabled && calendarLoadState === 'ready'}
            createFlows={createFlows}
            viewerRole={viewerRole}
          />
          {programRows.length === 0 && calendarEnabled && calendarLoadState === 'ready' ?
            <ProgramEducationBlock />
          : null}
        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <UpcomingProgramsTimeline upcoming={upcoming} orgSlug={orgSlug} programsAnchorId="all-programs" />
          <PublicCalendarCard
            publicCalendarHref={publicCalendarHref}
            settingsHref={settingsFeaturesHref}
            showSettings={showSettings}
            calendarEnabled={calendarEnabled}
          />
          <OrganizationGlanceCard
            memberCount={memberCount}
            orgVisibility={orgVisibility}
            featureFlags={featureFlags}
            settingsHref={settingsGeneralHref}
            showSettings={showSettings}
          />
          <ScheduleHelpCard />
        </aside>
      </div>

      {!calendarEnabled && showSettings ?
        <p className="text-sm text-dc-text-muted">
          <a href={settingsFeaturesHref} className="text-dc-accent hover:underline">
            Enable the calendar in Settings → Features
          </a>{' '}
          to start publishing programs.
        </p>
      : null}
    </div>
  )
}
