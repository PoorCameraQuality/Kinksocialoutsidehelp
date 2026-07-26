import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AssignmentBoardPanel } from '@/components/dancecard/organizer/AssignmentBoardPanel'
import { ExportsHubPanel } from '@/components/dancecard/organizer/ExportsHubPanel'
import { EventSettingsPanel } from '@/components/dancecard/organizer/EventSettingsPanel'
import { MessagingPanel } from '@/components/dancecard/organizer/MessagingPanel'
import { PeopleHubPanel } from '@/components/dancecard/organizer/PeopleHubPanel'
import { ApplicationsHubPanel } from '@/components/dancecard/organizer/applications/ApplicationsHubPanel'
import { invalidateOrganizerDancecardCache, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { ScheduleImportPanel } from '@/components/dancecard/organizer/ScheduleImportPanel'
import { VenuesTabPanel, VENUES_PANEL_PARAM } from '@/components/dancecard/organizer/venue/VenuesTabPanel'
import { OrganizerEventDashboard } from '@/components/dancecard/organizer/OrganizerEventDashboard'
import { IntegrationsPanel } from '@/components/dancecard/organizer/IntegrationsPanel'
import { EventSetupRequired } from '@/components/dancecard/organizer/EventSetupRequired'
import { ProgramTab } from '@/components/dancecard/organizer/program/ProgramTab'
import { OrganizerEventShell } from '@/components/dancecard/organizer/shell/OrganizerEventShell'
import { useOrganizerShellPrefs } from '@/components/dancecard/organizer/shell/useOrganizerShellPrefs'
import { EVENT_SETTINGS_PANEL_PARAM } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import {
  isOrganizerTab,
  legacyTabToPeopleSubTab,
  LEGACY_PEOPLE_TABS,
  PEOPLE_SUB_TAB_PARAM,
  type OrganizerTab,
  type PeopleSubTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { GuideRouter } from '@/components/dancecard/onboarding/GuideRouter'
import { GhostCursorRehearsal } from '@/components/dancecard/organizer/onboarding/GhostCursorRehearsal'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { emptyCommandPermissions } from '@c2k/shared'
import {
  firstAllowedTab,
  isTabAllowed,
  readOnlyForTab,
} from '@/lib/dancecard/commandBridgeNavPermissions'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { C2kFromBanner } from '@/components/dancecard/organizer/C2kFromBanner'
import { OrganizerCommandProvider } from '@/components/dancecard/organizer/OrganizerCommandContext'
import { SETUP_TASKS } from '@/lib/dancecard/setupTasks'
import { OrganizerCommandShell } from '@/components/dancecard/organizer/OrganizerCommandShell'
import { OrganizerWorkspaceSkeleton } from '@/components/dancecard/organizer/ui'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import { OrganizerWorkspaceProvider } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { OrganizerToastProvider } from '@/components/dancecard/organizer/ui'
import { DancecardAppearanceProvider, useDancecardAppearance } from '@/components/dancecard/DancecardAppearanceContext'
import { ORGANIZER_DANCECARD_APPEARANCE } from '@/lib/dancecard/appearancePresets'

type Props = {
  conventionSlug: string
  orgSlug?: string
  onProgramChanged?: () => void
}

export default function ConventionDancecardOrganizerClient(props: Props) {
  return (
    <DancecardAppearanceProvider wrapChrome={false} defaultAppearanceId={ORGANIZER_DANCECARD_APPEARANCE}>
      <OrganizerToastProvider>
        <ConventionDancecardOrganizerBody {...props} />
      </OrganizerToastProvider>
    </DancecardAppearanceProvider>
  )
}

function ConventionDancecardOrganizerBody({
  conventionSlug,
  orgSlug,
  onProgramChanged,
}: Props) {
  const { appearanceId, appearanceStyle, appearanceReady } = useDancecardAppearance()
  const slug = conventionSlug.toLowerCase()
  const [searchParams, setSearchParams] = useSearchParams()
  const workspacePath = orgSlug
    ? `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(slug)}`
    : `/organizer/conventions/${encodeURIComponent(slug)}`

  const [tab, setTab] = useState<OrganizerTab>('dashboard')
  const [timezone, setTimezone] = useState('America/New_York')
  const [windowStartsAt, setWindowStartsAt] = useState('')
  const [windowEndsAt, setWindowEndsAt] = useState('')
  const [slots, setSlots] = useState<ProgramSlotRow[]>([])
  const [shifts, setShifts] = useState<OrganizerStaffShiftDto[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [permissions, setPermissions] = useState<ConventionCommandPermissions>(emptyCommandPermissions())
  const [bootstrapEvent, setBootstrapEvent] = useState<EventSettingsEventDto | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { wideCanvas, toggleWideCanvas } = useOrganizerShellPrefs(slug)
  const [conflictsPulse, setConflictsPulse] = useState(false)
  const [bootstrapReady, setBootstrapReady] = useState(false)

  const readOnly = readOnlyForTab(tab, permissions)
  const hasEventWindow = Boolean(windowStartsAt && windowEndsAt)
  const initialSlotId = searchParams.get('slot')

  const hubHref = orgSlug ? `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule` : '/organizer'
  const publicHref = `/conventions/${encodeURIComponent(slug)}`

  const humanizeLoadMessage = useCallback((message: string, context: 'program' | 'staff' | 'event') => {
    if (message === 'Internal error') {
      if (context === 'program') {
        return 'Schedule data failed to load. Program and room tools may be limited until you refresh the page or contact support.'
      }
      if (context === 'staff') {
        return 'Staff shifts could not load. Open Staff shifts to retry, or contact support if the problem continues.'
      }
      return 'Something went wrong loading event data. Try refreshing the page.'
    }
    return message
  }, [])

  const reportNonBlockingError = useCallback(
    (operation: string, error: unknown) => {
      const raw = error instanceof Error ? error.message : `Could not ${operation}`
      const message = humanizeLoadMessage(raw, operation.includes('staff') ? 'staff' : 'event')
      console.error(`[convention organizer] ${operation} failed`, { conventionSlug: slug, error })
      setNotice(message)
    },
    [humanizeLoadMessage, slug],
  )

  const refreshProgram = useCallback(async () => {
    invalidateOrganizerDancecardCache(slug, '/program-slots')
    invalidateOrganizerDancecardCache(slug, '/organizer/bootstrap')
    try {
      const res = await organizerDancecardFetch<{
        slots: ProgramSlotRow[]
        timezone: string
        windowStartsAt: string
        windowEndsAt: string
      }>(slug, '/program-slots')
      setSlots(res.slots)
      setTimezone(res.timezone)
      setWindowStartsAt(res.windowStartsAt)
      setWindowEndsAt(res.windowEndsAt)
      setLoadErr(null)
      onProgramChanged?.()
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not load program'
      setLoadErr(humanizeLoadMessage(raw, 'program'))
    }
  }, [humanizeLoadMessage, onProgramChanged, slug])

  const mergeProgramSlot = useCallback((updated: ProgramSlotRow) => {
    setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }, [])

  const refreshStaff = useCallback(async () => {
    invalidateOrganizerDancecardCache(slug, '/staff-shifts')
    invalidateOrganizerDancecardCache(slug, '/organizer/bootstrap')
    try {
      const res = await organizerDancecardFetch<{ shifts: OrganizerStaffShiftDto[]; timezone: string }>(
        slug,
        '/staff-shifts',
      )
      setShifts(res.shifts)
      setTimezone(res.timezone)
      setNotice(null)
    } catch (e) {
      reportNonBlockingError('load staff shifts', e)
    }
  }, [reportNonBlockingError, slug])

  const loadBootstrap = useCallback(async () => {
    invalidateOrganizerDancecardCache(slug)
    setBootstrapReady(false)
    try {
      const res = await organizerDancecardFetch<{
        permissions: ConventionCommandPermissions
        event: EventSettingsEventDto
        slots: ProgramSlotRow[]
        shifts: OrganizerStaffShiftDto[]
        timezone: string
        windowStartsAt: string
        windowEndsAt: string
      }>(slug, '/organizer/bootstrap')
      setPermissions(res.permissions ?? emptyCommandPermissions())
      setBootstrapEvent(res.event)
      setEventTitle(res.event.eventTitle)
      setSlots(res.slots)
      setShifts(res.shifts)
      setTimezone(res.timezone)
      setWindowStartsAt(res.windowStartsAt)
      setWindowEndsAt(res.windowEndsAt)
      setLoadErr(null)
      setNotice(null)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not load event'
      setLoadErr(humanizeLoadMessage(raw, 'event'))
    } finally {
      setBootstrapReady(true)
    }
  }, [humanizeLoadMessage, slug])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const switchTab = useCallback(
    (
      next: OrganizerTab,
      opts?: {
        slotId?: string | null
        settingsPanel?: string | null
        peopleTab?: PeopleSubTab | null
        publishFilter?: 'draft' | null
        venuesPanel?: 'setup' | null
      },
    ) => {
      setTab(next)
      const params = new URLSearchParams(searchParams)
      params.set('tab', next)
      if (opts?.slotId) params.set('slot', opts.slotId)
      else if (opts?.slotId === null) params.delete('slot')
      if (next === 'people' && opts?.peopleTab) {
        params.set(PEOPLE_SUB_TAB_PARAM, opts.peopleTab)
      } else if (next !== 'people') {
        params.delete(PEOPLE_SUB_TAB_PARAM)
      }
      if (next === 'settings' && opts?.settingsPanel) {
        params.set(EVENT_SETTINGS_PANEL_PARAM, opts.settingsPanel)
      } else if (next !== 'settings') {
        params.delete(EVENT_SETTINGS_PANEL_PARAM)
      }
      if (next === 'venues' && opts?.venuesPanel === 'setup') {
        params.set(VENUES_PANEL_PARAM, 'setup')
      } else if (next !== 'venues') {
        params.delete(VENUES_PANEL_PARAM)
      }
      if (next === 'program' && opts?.publishFilter === 'draft') {
        params.set('publishFilter', 'draft')
      } else if (next !== 'program' || opts?.publishFilter !== 'draft') {
        params.delete('publishFilter')
      }
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (tab === 'settings' && searchParams.get(EVENT_SETTINGS_PANEL_PARAM) === 'venue') {
      switchTab('venues', { slotId: null, settingsPanel: null, venuesPanel: 'setup' })
    }
  }, [searchParams, switchTab, tab])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (isOrganizerTab(t)) setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (!initialSlotId || !slots.length) return
    if (slots.some((s) => s.id === initialSlotId)) return
    setNotice(
      'That activity link is outdated (the schedule may have been reset). Open the session again from the grid or list.',
    )
    switchTab(tab, { slotId: null })
  }, [initialSlotId, slots, switchTab, tab])

  // Applications consolidation: the standalone vetting tab and the People ->
  // Applications sub-tab now live on the dedicated Applications control surface.
  useEffect(() => {
    if (tab === 'vetting') {
      switchTab('applications')
      return
    }
    if (tab === 'people' && searchParams.get(PEOPLE_SUB_TAB_PARAM) === 'applications') {
      switchTab('applications')
    }
  }, [searchParams, switchTab, tab])

  useEffect(() => {
    if (tab !== 'people' && tab !== 'vetting' && LEGACY_PEOPLE_TABS.includes(tab)) {
      const sub = legacyTabToPeopleSubTab(tab)
      if (!sub) return
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'people')
      params.set(PEOPLE_SUB_TAB_PARAM, sub)
      setSearchParams(params, { replace: true })
      setTab('people')
    }
  }, [searchParams, setSearchParams, tab])

  const previewRole = (role: 'attendee' | 'staff' | 'safety' | 'public') => {
    const url = `/conventions/${slug}?previewRole=${role}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (!bootstrapReady) return
    if (!isTabAllowed(tab, permissions)) {
      switchTab(firstAllowedTab(permissions))
    }
  }, [bootstrapReady, permissions, switchTab, tab])

  useEffect(() => {
    if (!searchParams.get('tab')) {
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'dashboard')
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('tab') === 'media') {
      switchTab('exports')
    }
  }, [searchParams, switchTab])

  const wideLayoutForTab = tab === 'program' || tab === 'people' || tab === 'registrants' || tab === 'venues'
  const publishFilterDraft = searchParams.get('publishFilter') === 'draft'

  const commandContext = useMemo(
    () => ({
      eventSlug: slug,
      permissions,
      switchTab: (t: OrganizerTab) => switchTab(t),
      openConflicts: () => {
        switchTab('program')
        setConflictsPulse(true)
        window.setTimeout(() => setConflictsPulse(false), 900)
      },
      openDraftProgram: () => switchTab('program', { publishFilter: 'draft' }),
      openSetupTask: (taskId: string) => {
        const task = SETUP_TASKS.find((t) => t.id === taskId)
        if (!task) return
        switchTab(task.href.tab, {
          settingsPanel: task.href.settingsPanel ?? null,
          peopleTab: task.href.peopleTab ?? null,
          publishFilter: task.href.publishFilter ?? null,
          venuesPanel: task.href.venuesPanel ?? null,
        })
      },
      previewRole,
    }),
    [slug, permissions, switchTab],
  )

  return (
    <OrganizerWorkspaceProvider basePath={workspacePath}>
      <div
        className="dc-gold-chrome dc-gold-chrome--lifted -mx-4 -mt-2 min-h-[calc(100vh-12rem)] bg-dc-surface text-dc-text sm:-mx-6"
        data-dc-theme="event"
        data-dc-appearance={appearanceId}
        style={appearanceReady ? appearanceStyle : undefined}
        suppressHydrationWarning
      >
        <OrganizerCommandProvider value={commandContext}>
          <OrganizerCommandShell eventSlug={slug}>
            <GuideRouter
              eventSlug={slug}
              onSwitchTab={(t) => {
                switchTab(t, { slotId: null })
              }}
            />

            <OrganizerEventShell
              eventSlug={slug}
              eventTitle={bootstrapReady ? eventTitle || slug : 'Loading convention…'}
              activeTab={tab}
              readOnly={readOnly}
              permissions={permissions}
              wideCanvas={wideCanvas}
              onSelectTab={(t) => switchTab(t, { slotId: t === 'program' ? initialSlotId : null })}
              onToggleWideCanvas={toggleWideCanvas}
              onPreviewRole={previewRole}
              wideLayoutForTab={wideLayoutForTab}
              hubHref={hubHref}
              hubLabel="← Events & conventions"
              publicHref={publicHref}
            >
              <C2kFromBanner />

              {tab === 'program' ? <GhostCursorRehearsal eventSlug={slug} /> : null}
              {loadErr ? <p className="mb-4 text-sm text-dc-danger">{loadErr}</p> : null}
              {!bootstrapReady && !loadErr ? <OrganizerWorkspaceSkeleton /> : null}
              {bootstrapReady ? (
                <TabContentTransition tabKey={tab}>
                  {notice && tab !== 'dashboard' ? (
                    <div className="mb-4 rounded-xl border border-dc-warning/25 bg-dc-warning-muted px-4 py-3 text-sm text-dc-warning">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p>{notice}</p>
                        <button
                          type="button"
                          className="self-start rounded-lg border border-dc-warning/30 px-3 py-1 text-xs font-medium sm:self-auto"
                          onClick={() => setNotice(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {tab === 'dashboard' ? (
                    <OrganizerEventDashboard
                      eventSlug={slug}
                      eventTitle={eventTitle}
                      event={bootstrapEvent}
                      slots={slots}
                      shifts={shifts}
                      timezone={timezone}
                      readOnly={readOnly}
                      permissions={permissions}
                      workspaceBase={workspacePath}
                      onNavigateTab={(t, opts) =>
                        switchTab(t, {
                          peopleTab: opts?.peopleTab ?? null,
                          settingsPanel: opts?.settingsPanel ?? null,
                          publishFilter: opts?.publishFilter ?? null,
                        })
                      }
                    />
                  ) : null}
                  {tab === 'people' ? (
                    <PeopleHubPanel
                      eventSlug={slug}
                      readOnly={readOnly}
                      permissions={permissions}
                      timezone={timezone}
                      windowStartsAt={windowStartsAt}
                      windowEndsAt={windowEndsAt}
                      shifts={shifts}
                      onRefreshStaff={refreshStaff}
                      hasEventWindow={hasEventWindow}
                      peopleHubTemplate={bootstrapEvent?.peopleHubTemplate ?? 'full'}
                    />
                  ) : null}
                  {tab === 'applications' ? (
                    <ApplicationsHubPanel
                      eventSlug={slug}
                      permissions={permissions}
                      readOnly={readOnly}
                      timezone={timezone}
                      onProgramRefresh={refreshProgram}
                    />
                  ) : null}
                  {tab === 'settings' ? (
                    <EventSettingsPanel eventSlug={slug} permissions={permissions} />
                  ) : null}
                  {tab === 'venues' ? (
                    hasEventWindow ? (
                      <VenuesTabPanel
                        eventSlug={slug}
                        timezone={timezone}
                        slots={slots}
                        shifts={shifts}
                        onRefresh={refreshProgram}
                        onSlotUpdated={mergeProgramSlot}
                        readOnly={readOnly}
                      />
                    ) : (
                      <EventSetupRequired onGoSettings={() => switchTab('settings')} />
                    )
                  ) : null}
                  {tab === 'assignments' ? (
                    <AssignmentBoardPanel
                      eventSlug={slug}
                      timezone={timezone}
                      slots={slots}
                      onRefresh={refreshProgram}
                      readOnly={readOnly}
                      onNavigateTab={switchTab}
                    />
                  ) : null}
                  {tab === 'program' ? (
                    <ProgramTab
                      eventSlug={slug}
                      eventProfile={bootstrapEvent?.eventProfile}
                      eventStatus={bootstrapEvent?.status}
                      timezone={timezone}
                      windowStartsAt={windowStartsAt}
                      windowEndsAt={windowEndsAt}
                      slots={slots}
                      onRefresh={refreshProgram}
                      readOnly={readOnly}
                      initialSlotId={initialSlotId}
                      onSlotLinkChange={(slotId) => switchTab('program', { slotId })}
                      hasEventWindow={hasEventWindow}
                      onGoSettings={() => switchTab('settings', { settingsPanel: 'basics' })}
                      onEventWindowUpdated={(window) => {
                        setWindowStartsAt(window.windowStartsAt)
                        setWindowEndsAt(window.windowEndsAt)
                        setBootstrapEvent((ev) =>
                          ev
                            ? {
                                ...ev,
                                windowStartsAt: window.windowStartsAt,
                                windowEndsAt: window.windowEndsAt,
                              }
                            : ev,
                        )
                        void refreshProgram()
                      }}
                      onConflictsScanned={() => {
                        setConflictsPulse(true)
                        window.setTimeout(() => setConflictsPulse(false), 900)
                      }}
                      conflictSonarActive={conflictsPulse}
                      publishFilterDraft={publishFilterDraft}
                      onPublishFilterChange={(draft) => {
                        const params = new URLSearchParams(searchParams)
                        if (draft) params.set('publishFilter', 'draft')
                        else params.delete('publishFilter')
                        setSearchParams(params, { replace: true })
                      }}
                      onOpenImport={() => switchTab('import')}
                      onPreviewAttendeeSchedule={() => previewRole('attendee')}
                      onOpenScheduleCredits={() => switchTab('assignments')}
                      onLaunchConflictGuide={() => {
                        const params = new URLSearchParams(searchParams)
                        params.set('guide', 'conflicts')
                        setSearchParams(params, { replace: true })
                      }}
                      wideCanvas={wideCanvas}
                    />
                  ) : null}
                  {tab === 'exports' ? <ExportsHubPanel eventSlug={slug} workspaceBase={workspacePath} /> : null}
                  {tab === 'messaging' ? <MessagingPanel eventSlug={slug} readOnly={readOnly} /> : null}
                  {tab === 'import' ? (
                    hasEventWindow ? (
                      <ScheduleImportPanel
                        eventSlug={slug}
                        timezone={timezone}
                        windowStartsAt={windowStartsAt}
                        windowEndsAt={windowEndsAt}
                        readOnly={readOnly}
                        permissions={permissions}
                      />
                    ) : (
                      <EventSetupRequired onGoSettings={() => switchTab('settings')} />
                    )
                  ) : null}
                  {tab === 'integrations' ? (
                    <IntegrationsPanel eventSlug={slug} permissions={permissions} />
                  ) : null}
                </TabContentTransition>
              ) : null}
            </OrganizerEventShell>
          </OrganizerCommandShell>
        </OrganizerCommandProvider>
      </div>
    </OrganizerWorkspaceProvider>
  )
}
