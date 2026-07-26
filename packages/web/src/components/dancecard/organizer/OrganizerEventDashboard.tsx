'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConventionCommandPermissions } from '@c2k/shared'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { invalidateOrganizerDancecardCache, organizerDancecardFetch, OrganizerApiError } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerSubPath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { SetupTaskList } from '@/components/dancecard/organizer/home/SetupTaskList'
import { DashboardAttendeeSurfaces } from '@/components/dancecard/organizer/home/DashboardAttendeeSurfaces'
import { DashboardQuickActions } from '@/components/dancecard/organizer/home/DashboardQuickActions'
import {
  buildAttentionItems,
  conventionLifecyclePhase,
  formatEventDateRange,
  lifecycleLabel,
  readinessOverallStatus,
  registrationLikelyOpen,
} from '@/components/dancecard/organizer/home/dashboardUtils'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { WIZARD_STORAGE_KEY } from '@/components/dancecard/organizer/settings/eventSettingsConfig'
import type { OrganizerTab, PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import {
  readImportSkipped,
  resolveSetupTasks,
  setupReadinessPercent,
  type ResolvedSetupTask,
} from '@/lib/dancecard/resolveSetupTasks'
import { SETUP_LIFECYCLE_COLLAPSED_KEY } from '@/lib/dancecard/setupTasks'
import type { ReadinessCheck } from '@/lib/dancecard/readinessTypes'
import {
  filterPeopleSubTabs,
  isSetupTaskAllowed,
  isTabAllowed,
} from '@/lib/dancecard/commandBridgeNavPermissions'
import { LiveOpsConsolePanel } from '@/components/dancecard/organizer/LiveOpsConsolePanel'
import { Panel } from '@/components/dancecard/ui/Panel'
import { cn } from '@/lib/cn'

function severityStyles(sev: ReadinessCheck['severity']) {
  if (sev === 'warning') return 'border-dc-warning/30 bg-dc-warning-muted text-dc-warning'
  if (sev === 'info') return 'border-dc-border bg-dc-surface-muted text-dc-muted'
  return 'border-dc-success/25 bg-dc-success-muted text-dc-success'
}

function readinessActionAllowed(
  action: NonNullable<ReadinessCheck['action']>,
  permissions: ConventionCommandPermissions,
): boolean {
  const tab = action.tab === 'registrants' ? 'people' : action.tab
  if (!isTabAllowed(tab as OrganizerTab, permissions)) return false
  if (action.peopleTab && tab === 'people') {
    return filterPeopleSubTabs([action.peopleTab], permissions).length > 0
  }
  if (tab === 'settings') return permissions.isFullAdmin
  return true
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'good' | 'warn' | 'urgent' | 'muted'
}) {
  const toneClass =
    tone === 'good' ? 'border-emerald-500/25 bg-emerald-950/20'
    : tone === 'warn' ? 'border-amber-500/25 bg-amber-950/20'
    : tone === 'urgent' ? 'border-red-500/25 bg-red-950/20'
    : tone === 'muted' ? 'border-dc-border bg-dc-elevated-muted/40 opacity-80'
    : 'border-dc-border bg-dc-elevated'
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-dc-text">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-dc-muted">{hint}</p> : null}
    </div>
  )
}

export function OrganizerEventDashboard({
  eventSlug,
  eventTitle,
  event: eventFromBootstrap,
  slots,
  shifts,
  timezone,
  readOnly,
  permissions,
  onNavigateTab,
  workspaceBase,
}: {
  eventSlug: string
  eventTitle: string
  event?: EventSettingsEventDto | null
  slots: ProgramSlotRow[]
  shifts: OrganizerStaffShiftDto[]
  timezone?: string
  readOnly?: boolean
  permissions: ConventionCommandPermissions
  workspaceBase?: string
  onNavigateTab: (
    tab: OrganizerTab,
    opts?: { peopleTab?: PeopleSubTab; settingsPanel?: string; publishFilter?: 'draft' },
  ) => void
}) {
  const fallbackDoorHref = useOrganizerSubPath('/door')
  const doorHref = workspaceBase ? `${workspaceBase}/door` : fallbackDoorHref
  const publicHref = `/conventions/${eventSlug}`

  const [summaryChecks, setSummaryChecks] = useState<ReadinessCheck[] | null>(null)
  const [fullChecks, setFullChecks] = useState<ReadinessCheck[] | null>(null)
  const [fullLoading, setFullLoading] = useState(false)
  const [fullErr, setFullErr] = useState<string | null>(null)
  const [summaryErr, setSummaryErr] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [openIncidents, setOpenIncidents] = useState<number | null>(null)
  const [complianceIssues, setComplianceIssues] = useState<number | null>(null)
  const fullRequestedRef = useRef(false)
  const event = eventFromBootstrap
  const [checklistCollapsed, setChecklistCollapsed] = useState(true)
  const canSeeReadiness = permissions.isFullAdmin || permissions.scheduler

  const checks = fullChecks ?? summaryChecks
  const unpublishedCount = useMemo(() => slots.filter((s) => !s.isPublished).length, [slots])
  const publishedCount = slots.length - unpublishedCount

  const wizardDone = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(WIZARD_STORAGE_KEY(eventSlug)) === '1'
    } catch {
      return false
    }
  }, [eventSlug])

  const loadSummary = useCallback(async (force = false) => {
    if (!canSeeReadiness) {
      setSummaryChecks([])
      return
    }
    setSummaryErr(null)
    try {
      if (force) invalidateOrganizerDancecardCache(eventSlug, '/readiness/summary')
      const res = await organizerDancecardFetch<{ checks: ReadinessCheck[] }>(eventSlug, '/readiness/summary')
      setSummaryChecks(res.checks)
      setLastRefreshed(new Date())
    } catch (e) {
      if (e instanceof OrganizerApiError && e.status === 403) {
        setSummaryChecks([])
        return
      }
      const raw = e instanceof Error ? e.message : 'Could not load overview'
      setSummaryErr(raw === 'Internal error' ? supportCopy.dashboardLoadFailed : raw)
    }
  }, [canSeeReadiness, eventSlug])

  const loadFull = useCallback(async (force = false) => {
    if (!canSeeReadiness) return
    setFullErr(null)
    setFullLoading(true)
    fullRequestedRef.current = true
    try {
      if (force) invalidateOrganizerDancecardCache(eventSlug, '/readiness')
      const res = await organizerDancecardFetch<{ checks: ReadinessCheck[] }>(eventSlug, '/readiness')
      setFullChecks(res.checks)
      setLastRefreshed(new Date())
    } catch (e) {
      if (e instanceof OrganizerApiError && e.status === 403) {
        setFullChecks([])
        return
      }
      const raw = e instanceof Error ? e.message : 'Could not run full pre-flight checks'
      setFullErr(raw === 'Internal error' ? supportCopy.preflightFailed : raw)
    } finally {
      setFullLoading(false)
    }
  }, [canSeeReadiness, eventSlug])

  const refreshAll = useCallback(async (force = false) => {
    await loadSummary(force)
    if (fullChecks || fullRequestedRef.current) await loadFull(force)
  }, [loadSummary, loadFull, fullChecks])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (!summaryChecks || fullChecks || fullRequestedRef.current) return
    const t = window.setTimeout(() => void loadFull(), 400)
    return () => window.clearTimeout(t)
  }, [summaryChecks, fullChecks, loadFull])

  useEffect(() => {
    if (!permissions.staffOps && !permissions.isFullAdmin) return
    void organizerDancecardFetch<{ incidents: Array<{ status: string }> }>(eventSlug, '/safety-incidents')
      .then((res) => {
        setOpenIncidents(res.incidents.filter((i) => i.status !== 'closed' && i.status !== 'resolved').length)
      })
      .catch(() => setOpenIncidents(null))
    void organizerDancecardFetch<{ rows: Array<{ deficitHours: number }> }>(eventSlug, '/volunteer-compliance')
      .then((res) => {
        setComplianceIssues(res.rows.filter((r) => r.deficitHours > 0).length)
      })
      .catch(() => setComplianceIssues(null))
  }, [eventSlug, permissions.isFullAdmin, permissions.staffOps])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETUP_LIFECYCLE_COLLAPSED_KEY(eventSlug))
      setChecklistCollapsed(stored !== '0')
    } catch {
      setChecklistCollapsed(true)
    }
  }, [eventSlug])

  const toggleChecklistCollapsed = useCallback(() => {
    setChecklistCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SETUP_LIFECYCLE_COLLAPSED_KEY(eventSlug), next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [eventSlug])

  const setupTasks: ResolvedSetupTask[] = useMemo(() => {
    if (!checks) return []
    return resolveSetupTasks({
      event: event ?? null,
      checks,
      slotCount: slots.length,
      unpublishedCount,
      wizardDone,
      importSkipped: readImportSkipped(eventSlug),
      summaryOnly: !fullChecks,
    }).filter((task) => isSetupTaskAllowed(task.id, permissions))
  }, [checks, event, slots.length, unpublishedCount, wizardDone, eventSlug, fullChecks, permissions])

  const readinessPct = setupReadinessPercent(setupTasks)
  const essentialIncomplete = setupTasks.filter((t) => t.group === 'essential' && t.status !== 'complete').length
  const warnings = (checks ?? []).filter((c) => c.severity === 'warning')
  const fixNow = warnings.filter((c) => c.action && readinessActionAllowed(c.action, permissions))
  const overall = readinessOverallStatus(readinessPct, warnings.length, essentialIncomplete)

  const phase = conventionLifecyclePhase(event ?? null)
  const regOpen = checks ? registrationLikelyOpen(checks) : false
  const dateRange = formatEventDateRange(event ?? null)
  const openShiftGaps = shifts.filter((s) => !s.personId || s.droppedAt).length

  const attentionItems = useMemo(
    () =>
      buildAttentionItems({
        fixNow,
        setupTasks,
        unpublishedCount,
        eventPublished: event?.status === 'published',
        hasAttendeeSurfacesPanel: true,
        onNavigate: (action) => {
          if (!action) return
          onNavigateTab(action.tab as OrganizerTab, {
            peopleTab: action.peopleTab,
            settingsPanel: action.settingsPanel,
          })
        },
        onNavigateTab: (tab, opts) =>
          onNavigateTab(tab as OrganizerTab, {
            peopleTab: opts?.peopleTab as PeopleSubTab | undefined,
            settingsPanel: opts?.settingsPanel,
            publishFilter: opts?.publishFilter as 'draft' | undefined,
          }),
      }),
    [fixNow, setupTasks, unpublishedCount, event?.status, onNavigateTab],
  )

  const displayChecks = (fullChecks ?? summaryChecks ?? []).filter(
    (c) => !c.action || readinessActionAllowed(c.action, permissions),
  )

  if (summaryErr) {
    return (
      <Panel className="border-dc-danger/30 bg-dc-danger-muted/40">
        <p className="font-medium text-dc-danger">Home could not load</p>
        <p className="mt-2 text-sm text-dc-muted">{summaryErr}</p>
        <button
          type="button"
          className="mt-4 rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text hover:border-dc-accent-border"
          onClick={() => void loadSummary(true)}
        >
          Try again
        </button>
      </Panel>
    )
  }

  if (!checks && canSeeReadiness) {
    return <p className="text-sm text-dc-muted">Loading command center…</p>
  }

  const title = eventTitle || eventSlug
  const scanLabel = fullChecks ? 'Full' : canSeeReadiness ? 'Quick' : 'Limited'

  return (
    <div className="space-y-5 pb-8">
      {/* 1. Header summary */}
      <header className="rounded-2xl border border-dc-border bg-dc-elevated/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Command center</p>
            <h2 className="mt-1 font-serif text-2xl text-dc-text sm:text-3xl">{title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-dc-muted">
              {dateRange ? <span>{dateRange}</span> : null}
              {timezone ? <span className="text-dc-muted/80">· {timezone.replace(/_/g, ' ')}</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-dc-border bg-dc-surface-muted px-2.5 py-0.5 text-xs font-medium text-dc-text">
                {lifecycleLabel(regOpen && phase === 'draft' ? 'registration_open' : phase)}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  event?.status === 'published' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-100',
                )}
              >
                Public page: {event?.status === 'published' ? 'Published' : 'Not published'}
              </span>
              {regOpen ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                  Registration open
                </span>
              ) : null}
            </div>
            {lastRefreshed ? (
              <p className="mt-2 text-xs text-dc-muted">Last refreshed {lastRefreshed.toLocaleTimeString()}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.registration || permissions.isFullAdmin ? (
              <Link
                href={doorHref}
                className="rounded-xl border border-dc-accent-border bg-dc-accent-muted px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted/80"
              >
                Door mode
              </Link>
            ) : null}
            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Preview public page ↗
            </Link>
            {!readOnly && permissions.isFullAdmin ? (
              <button
                type="button"
                className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-muted hover:text-dc-text"
                onClick={() => onNavigateTab('settings', { settingsPanel: 'basics' })}
              >
                Edit basics
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-muted hover:text-dc-text disabled:opacity-50"
              disabled={fullLoading}
              onClick={() => void refreshAll(true)}
            >
              {fullLoading ? 'Scanning…' : 'Refresh checks'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Critical status row */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
        {canSeeReadiness ? (
          <MetricCard
            label="Readiness"
            value={`${readinessPct}%`}
            hint={overall === 'on_track' ? 'On track' : overall === 'blocked' ? 'Blocked' : 'Needs attention'}
            tone={overall === 'on_track' ? 'good' : overall === 'blocked' ? 'urgent' : 'warn'}
          />
        ) : null}
        <MetricCard label="Program slots" value={String(slots.length)} hint="On grid" />
        <MetricCard
          label="Published"
          value={String(publishedCount)}
          hint="Visible sessions"
          tone={publishedCount > 0 ? 'good' : 'warn'}
        />
        <MetricCard
          label="Draft"
          value={String(unpublishedCount)}
          hint="Hidden from public"
          tone={unpublishedCount > 0 ? 'warn' : 'good'}
        />
        <MetricCard label="Staff shifts" value={String(shifts.length)} hint="Scheduled" />
        {openShiftGaps > 0 ? (
          <MetricCard label="Open gaps" value={String(openShiftGaps)} hint="Unassigned shifts" tone="warn" />
        ) : null}
        {openIncidents != null ? (
          <MetricCard
            label="Incidents"
            value={String(openIncidents)}
            hint="Open"
            tone={openIncidents > 0 ? 'urgent' : 'good'}
          />
        ) : null}
        {complianceIssues != null ? (
          <MetricCard
            label="Compliance"
            value={String(complianceIssues)}
            hint="Needs attention"
            tone={complianceIssues > 0 ? 'warn' : 'good'}
          />
        ) : null}
        {warnings.length > 0 ? (
          <MetricCard label="Warnings" value={String(warnings.length)} hint={`${scanLabel} scan`} tone="warn" />
        ) : null}
      </div>

      {/* 3. Needs attention. First priority */}
      {attentionItems.length > 0 ? (
        <section aria-labelledby="needs-attention-heading">
          <Panel className="border-dc-accent-border/30 bg-dc-accent-muted/10">
            <h2 id="needs-attention-heading" className="font-serif text-lg text-dc-text">
              Needs your attention
            </h2>
            <p className="mt-1 text-xs text-dc-muted">Highest-impact items. Start here.</p>
            <ul className="mt-4 space-y-2">
              {attentionItems.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                    item.severity === 'urgent' ? 'border-red-500/30 bg-red-950/20'
                    : item.severity === 'warning' ? 'border-amber-500/25 bg-amber-950/15'
                    : 'border-dc-border bg-dc-elevated-muted/60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-dc-text">{item.title}</p>
                    {item.detail ? <p className="mt-0.5 text-sm text-dc-muted">{item.detail}</p> : null}
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                      onClick={item.onAction}
                    >
                      {item.actionLabel} →
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : (
        <Panel className="border-dc-success/25 bg-dc-success-muted/20">
          <p className="text-sm font-medium text-dc-success">Nothing urgent right now</p>
          <p className="mt-1 text-sm text-dc-muted">
            {canSeeReadiness ? `${readinessPct}% readiness. Review checklist or live ops below.` : 'Use quick actions below.'}
          </p>
        </Panel>
      )}

      {/* 4. Middle row: live ops + readiness + attendee surfaces */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveOpsConsolePanel
            eventSlug={eventSlug}
            event={event ?? null}
            slots={slots}
            openIncidents={openIncidents ?? 0}
          />
        </div>
        <div className="space-y-4">
          {canSeeReadiness ? (
            <Panel>
              <h2 className="font-serif text-lg text-dc-text">Readiness</h2>
              <div className="mt-3 flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-dc-accent text-lg font-bold text-dc-accent"
                  style={{ borderColor: overall === 'on_track' ? 'rgb(52 211 153 / 0.6)' : undefined }}
                >
                  {readinessPct}%
                </div>
                <div>
                  <p className="font-medium text-dc-text capitalize">
                    {overall === 'on_track' ? 'On track' : overall === 'blocked' ? 'Blocked' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-dc-muted">
                    {essentialIncomplete > 0
                      ? `${essentialIncomplete} required item${essentialIncomplete === 1 ? '' : 's'} before go-live`
                      : 'Required setup complete'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                  onClick={() => onNavigateTab('settings', { settingsPanel: 'guide' })}
                >
                  View setup guide
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:text-dc-text disabled:opacity-50"
                  disabled={fullLoading || !canSeeReadiness}
                  onClick={() => void loadFull(true)}
                >
                  {fullLoading ? 'Scanning…' : 'Run full readiness scan'}
                </button>
              </div>
              {fullErr ? <p className="mt-2 text-xs text-dc-warning">{fullErr}</p> : null}
            </Panel>
          ) : null}
          <DashboardAttendeeSurfaces
            eventSlug={eventSlug}
            event={event ?? null}
            slots={slots}
            permissions={permissions}
            publicHref={publicHref}
            readOnly={readOnly}
            onOpenIntegrations={() => onNavigateTab('integrations')}
            onOpenExports={isTabAllowed('exports', permissions) ? () => onNavigateTab('exports') : undefined}
          />
        </div>
      </div>

      {/* 5. Timeline */}
      {event?.windowStartsAt && event?.windowEndsAt ? (
        <Panel>
          <h2 className="text-sm font-semibold text-dc-text">Upcoming timeline</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="w-24 shrink-0 text-xs text-dc-muted">
                {new Date(event.windowStartsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-dc-text">Event starts</span>
            </li>
            <li className="flex gap-3">
              <span className="w-24 shrink-0 text-xs text-dc-muted">
                {new Date(event.windowEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-dc-text">Event ends</span>
            </li>
          </ul>
        </Panel>
      ) : null}

      {/* 6. Quick actions */}
      <DashboardQuickActions permissions={permissions} doorHref={doorHref} onNavigateTab={onNavigateTab} />

      {/* 7. Setup checklist. Secondary */}
      {setupTasks.length > 0 ? (
        <section aria-labelledby="setup-tasks-heading">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="setup-tasks-heading" className="text-sm font-semibold text-dc-text">
                Setup checklist
              </h2>
              <p className="text-xs text-dc-muted">Full list. Use Needs attention above for priorities.</p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-dc-accent hover:underline"
              onClick={toggleChecklistCollapsed}
            >
              {checklistCollapsed ? 'Expand checklist' : 'Collapse checklist'}
            </button>
          </div>
          {!checklistCollapsed ? (
            <SetupTaskList tasks={setupTasks} readOnly={readOnly} showCompleted onNavigate={onNavigateTab} />
          ) : (
            <SetupTaskList tasks={setupTasks} readOnly={readOnly} compact onNavigate={onNavigateTab} />
          )}
        </section>
      ) : null}

      {/* 8. Recent activity placeholder. No fake feed */}
      <Panel className="border-dc-border/60 bg-dc-elevated-muted/30">
        <h2 className="text-sm font-semibold text-dc-text">Recent activity</h2>
        <p className="mt-2 text-sm text-dc-muted">
          No recent activity feed yet. Activity appears here as registration, schedule, staffing, and messaging changes
          happen.
        </p>
      </Panel>

      {/* 9. Full scan details */}
      {displayChecks.length > 0 ? (
        <details className="group rounded-2xl border border-dc-border bg-dc-elevated-muted/50">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-dc-text marker:content-none [&::-webkit-details-marker]:hidden">
            {scanLabel} readiness scan ({displayChecks.length})
            <span className="ml-2 text-dc-muted group-open:hidden">Show</span>
            <span className="ml-2 hidden text-dc-muted group-open:inline">Hide</span>
          </summary>
          <ul className="max-h-80 space-y-2 overflow-y-auto border-t border-dc-border px-4 py-3">
            {displayChecks.map((c) => (
              <li key={c.id} className={cn('rounded-lg border px-3 py-2 text-sm', severityStyles(c.severity))}>
                <span className="font-medium">{c.title}</span>
                {c.detail ? <p className="mt-0.5 text-xs leading-relaxed opacity-90">{c.detail}</p> : null}
                {c.action && !readOnly ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-dc-accent hover:underline"
                    onClick={() =>
                      onNavigateTab(c.action!.tab as OrganizerTab, {
                        peopleTab: c.action!.peopleTab,
                        settingsPanel: c.action!.settingsPanel,
                      })
                    }
                  >
                    {c.action.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Panel className="border-dc-border/50 bg-dc-surface-muted/40">
        <p className="text-xs text-dc-muted">
          This is your event dashboard. Use the sidebar for program, people, messaging, and check-in mode.
          Public listing preview lives under{' '}
          <button type="button" className="text-dc-accent hover:underline" onClick={() => onNavigateTab('integrations')}>
            Integrations
          </button>
          .
        </p>
      </Panel>
    </div>
  )
}
