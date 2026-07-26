import { Link } from 'react-router-dom'
import CreateFlowTriggerButton from '@/components/create-flow/CreateFlowTriggerButton'
import OrganizerOrgSchedulePanel from '@/components/organizer/schedule/OrganizerOrgSchedulePanel'
import ConventionPublishActions from '@/components/organizer/ConventionPublishActions'
import OrganizerDataTable from '@/components/organizer/ui/OrganizerDataTable'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import type { OrgScheduleConvention, OrgScheduleEvent } from '@/lib/organizer/org-schedule-programs'
import type { OrgCalendarLoadState } from '@/lib/org-calendar-fetch'

type ConventionRow = OrgScheduleConvention

type EventRow = OrgScheduleEvent & { organizationSlug?: string | null }

type ScheduleRow = {
  id: string
  kind: 'convention' | 'event'
  title: string
  slugOrId: string
  conventionSlug?: string | null
  organizationSlug?: string | null
}

type Props = {
  scopeKind: 'org' | 'group'
  orgSlug?: string
  orgId?: string
  groupId?: string
  conventions: ConventionRow[]
  events: EventRow[]
  calendarEnabled?: boolean
  calendarLoadState?: OrgCalendarLoadState
  orgVisibility?: string
  memberCount?: number
  featureFlags?: {
    calendarEnabled: boolean
    forumsEnabled: boolean
    chatEnabled: boolean
    subgroupsEnabled?: boolean
  }
  showSettings?: boolean
  /** When set, group-scope event rows link to org event manager. */
  groupOrgSlug?: string
  viewerRole?: string | null
}

export default function OrganizerSchedulePanel({
  scopeKind,
  orgSlug,
  orgId,
  groupId,
  conventions,
  events,
  calendarEnabled = true,
  calendarLoadState = 'ready',
  orgVisibility = 'PUBLIC',
  memberCount = 0,
  featureFlags = { calendarEnabled: true, forumsEnabled: false, chatEnabled: false },
  showSettings = false,
  groupOrgSlug,
  viewerRole = null,
}: Props) {
  if (scopeKind === 'org' && orgSlug && orgId) {
    return (
      <OrganizerOrgSchedulePanel
        orgSlug={orgSlug}
        orgId={orgId}
        orgVisibility={orgVisibility}
        memberCount={memberCount}
        featureFlags={featureFlags}
        calendarEnabled={calendarEnabled}
        calendarLoadState={calendarLoadState}
        showSettings={showSettings}
        conventions={conventions}
        events={events}
        viewerRole={viewerRole}
      />
    )
  }

  const createConventionFlow =
    scopeKind === 'org' && orgId ? { type: 'convention' as const, prefillOrgId: orgId } : null
  const createEventFlow =
    scopeKind === 'org' && orgId ? { type: 'event' as const, prefillOrgId: orgId }
    : scopeKind === 'group' && groupId ?
      {
        type: 'event' as const,
        prefillGroupId: groupId,
        ...(orgId ? { prefillOrgId: orgId } : {}),
      }
    : null

  const conventionSlugs = new Set(conventions.map((c) => c.slug))
  const standaloneEvents = events.filter((ev) => !ev.conventionSlug || !conventionSlugs.has(ev.conventionSlug))
  const rows: ScheduleRow[] = [
    ...conventions.map((c) => ({
      id: `conv-${c.slug}`,
      kind: 'convention' as const,
      title: c.title,
      slugOrId: c.slug,
    })),
    ...standaloneEvents.map((ev) => ({
      id: `ev-${ev.id}`,
      kind: 'event' as const,
      title: ev.title,
      slugOrId: ev.id,
      conventionSlug: ev.conventionSlug,
      organizationSlug: ev.organizationSlug,
    })),
  ]

  const conventionCount = conventions.length
  const eventCount = standaloneEvents.length

  return (
    <div className="space-y-5 max-w-5xl">
      <OrganizerPanel
        title="Events & conventions"
        description="Create and manage programs here. Conventions include full schedule builders; standalone events appear on the member calendar."
        actions={
          calendarEnabled && (scopeKind === 'org' || scopeKind === 'group') && createEventFlow ?
            <div className="flex flex-wrap gap-2">
              {createConventionFlow ?
                <CreateFlowTriggerButton
                  flow={createConventionFlow}
                  className="min-h-9 inline-flex items-center rounded-lg bg-dc-accent px-3 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  + Convention
                </CreateFlowTriggerButton>
              : null}
              {createEventFlow ?
                <CreateFlowTriggerButton
                  flow={createEventFlow}
                  className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                >
                  + Event
                </CreateFlowTriggerButton>
              : null}
            </div>
          : null
        }
      >
        {!calendarEnabled ?
          <p className="text-sm text-amber-200/80">
            Calendar is disabled. Enable it in{' '}
            <Link
              to={`/organizer/orgs/${encodeURIComponent(groupOrgSlug ?? orgSlug ?? '')}?tab=settings&settingsSection=features`}
              className="underline"
            >
              Settings → Features
            </Link>
            .
          </p>
        : calendarLoadState === 'error' ?
          <p className="text-sm text-amber-200/80">Could not load events and conventions. Refresh the page to try again.</p>
        : calendarLoadState === 'disabled' ?
          <p className="text-sm text-amber-200/80">
            Events &amp; conventions disabled in org settings.
            {showSettings && orgSlug ?
              <>
                {' '}
                <Link
                  to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=settings&settingsSection=features`}
                  className="text-dc-accent hover:underline"
                >
                  Enable in Settings → Features
                </Link>
              </>
            : null}
          </p>
        : (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg border border-dc-border bg-black/20 px-4 py-2">
              <span className="text-2xl font-semibold text-dc-text">{conventionCount}</span>
              <span className="ml-2 text-dc-muted">convention{conventionCount === 1 ? '' : 's'}</span>
            </div>
            <div className="rounded-lg border border-dc-border bg-black/20 px-4 py-2">
              <span className="text-2xl font-semibold text-dc-text">{eventCount}</span>
              <span className="ml-2 text-dc-muted">standalone event{eventCount === 1 ? '' : 's'}</span>
            </div>
          </div>
        )}
      </OrganizerPanel>

      {calendarEnabled && calendarLoadState === 'ready' ?
        <OrganizerPanel
          title="All programs"
          description="Conventions open the full program builder. Events without a convention use the event editor."
        >
          <OrganizerDataTable
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No conventions or events yet. Use the buttons above to create your first program."
            columns={[
              {
                key: 'type',
                header: 'Type',
                className: 'w-28',
                render: (r) => (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      r.kind === 'convention' ?
                        'border border-violet-500/30 bg-violet-950/40 text-violet-200'
                      : 'border border-sky-500/30 bg-sky-950/40 text-sky-200'
                    }`}
                  >
                    {r.kind === 'convention' ? 'Convention' : 'Event'}
                  </span>
                ),
              },
              {
                key: 'title',
                header: 'Name',
                render: (r) => (
                  <div>
                    <p className="font-medium text-dc-text">{r.title}</p>
                    <p className="text-xs text-dc-muted">/{r.slugOrId}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'text-right',
                render: (r) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.kind === 'convention' && scopeKind === 'org' && orgSlug ?
                      <>
                        <Link
                          to={`/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(r.slugOrId)}?tab=program`}
                          className="min-h-8 inline-flex items-center rounded-lg bg-dc-accent px-2.5 text-xs font-medium text-dc-text"
                        >
                          Manage program
                        </Link>
                        <ConventionPublishActions
                          conventionSlug={r.slugOrId}
                          conventionTitle={r.title}
                          variant="compact"
                          viewerRole={viewerRole}
                        />
                        <Link
                          to={`/conventions/${encodeURIComponent(r.slugOrId)}?tab=Schedule`}
                          className="min-h-8 inline-flex items-center rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted hover:text-dc-text"
                        >
                          Public view
                        </Link>
                      </>
                    : r.kind === 'convention' && scopeKind === 'group' && groupOrgSlug ?
                      <>
                        <Link
                          to={`/organizer/orgs/${encodeURIComponent(groupOrgSlug)}/conventions/${encodeURIComponent(r.slugOrId)}?tab=program`}
                          className="min-h-8 inline-flex items-center rounded-lg bg-dc-accent px-2.5 text-xs font-medium text-dc-text"
                        >
                          Manage program
                        </Link>
                        <Link
                          to={`/conventions/${encodeURIComponent(r.slugOrId)}?tab=Schedule`}
                          className="min-h-8 inline-flex items-center rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted hover:text-dc-text"
                        >
                          Public view
                        </Link>
                      </>
                    : (() => {
                        const manageOrgSlug =
                          scopeKind === 'org' ? orgSlug : (r.organizationSlug ?? groupOrgSlug ?? undefined)
                        if (manageOrgSlug) {
                          return (
                            <Link
                              to={`/organizer/orgs/${encodeURIComponent(manageOrgSlug)}/events/${encodeURIComponent(r.slugOrId)}`}
                              className="min-h-8 inline-flex items-center rounded-lg bg-dc-accent px-2.5 text-xs font-medium text-dc-text"
                            >
                              Manage event
                            </Link>
                          )
                        }
                        if (scopeKind === 'group' && groupId) {
                          return (
                            <Link
                              to={`/organizer/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(r.slugOrId)}`}
                              className="min-h-8 inline-flex items-center rounded-lg bg-dc-accent px-2.5 text-xs font-medium text-dc-text"
                            >
                              Manage event
                            </Link>
                          )
                        }
                        return (
                          <Link
                            to={`/events/${encodeURIComponent(r.slugOrId)}`}
                            className="min-h-8 inline-flex items-center rounded-lg border border-dc-border px-2.5 text-xs text-dc-text-muted hover:text-dc-text"
                          >
                            View
                          </Link>
                        )
                      })()}
                  </div>
                ),
              },
            ]}
          />
        </OrganizerPanel>
      : null}

      {scopeKind === 'org' && orgSlug ?
        <p className="text-sm text-dc-muted">
          Members browse upcoming programs on the{' '}
          <Link to={`/orgs/${encodeURIComponent(orgSlug)}?tab=Calendar`} className="text-dc-accent hover:underline">
            public calendar
          </Link>
          .
        </p>
      : null}
      {scopeKind === 'group' && groupId ?
        <Link to={`/groups/${encodeURIComponent(groupId)}`} className="text-sm text-dc-accent hover:underline">
          View group page →
        </Link>
      : null}
    </div>
  )
}
