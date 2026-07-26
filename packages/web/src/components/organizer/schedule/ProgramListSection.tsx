import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CreateFlowTriggerButton from '@/components/create-flow/CreateFlowTriggerButton'
import ConventionPublishActions from '@/components/organizer/ConventionPublishActions'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'
import {
  formatProgramVisibility,
  formatProgramWhen,
  type OrgProgramRow,
} from '@/lib/organizer/org-schedule-programs'
import { ScheduleSection } from '@/components/organizer/schedule/schedule-ui'

type Filter = 'all' | 'convention' | 'event' | 'upcoming'

type Props = {
  rows: OrgProgramRow[]
  orgSlug: string
  calendarEnabled: boolean
  createFlows: { convention: OpenCreateFlowOptions | null; event: OpenCreateFlowOptions | null }
  /** Door/check-in requires convention registration grant (or full admin). */
  showDoorLinks?: boolean
  viewerRole?: string | null
}

function statusBadgeVariant(tone: OrgProgramRow['statusTone']): 'accent' | 'success' | 'neutral' | 'danger' {
  if (tone === 'warning' || tone === 'danger') return 'danger'
  if (tone === 'accent') return 'accent'
  if (tone === 'success') return 'success'
  return 'neutral'
}

function ProgramActions({
  row,
  orgSlug,
  showDoorLinks,
  viewerRole,
}: {
  row: OrgProgramRow
  orgSlug: string
  showDoorLinks: boolean
  viewerRole?: string | null
}) {
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  if (row.kind === 'convention') {
    const convSlug = row.slugOrId
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          to={`${orgBase}/conventions/${encodeURIComponent(convSlug)}?tab=program`}
          className="min-h-9 inline-flex items-center rounded-lg bg-dc-accent px-3 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Manage
        </Link>
        <Link
          to={`/conventions/${encodeURIComponent(convSlug)}`}
          className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
        >
          Public page
        </Link>
        {showDoorLinks ?
          <Link
            to={`${orgBase}/conventions/${encodeURIComponent(convSlug)}/door`}
            className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
          >
            Check-in
          </Link>
        : null}
        <Link
          to={`${orgBase}/conventions/${encodeURIComponent(convSlug)}/print/schedule`}
          className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
        >
          Print
        </Link>
        <ConventionPublishActions
          conventionSlug={convSlug}
          conventionTitle={row.title}
          variant="compact"
          viewerRole={viewerRole}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        to={`${orgBase}/events/${encodeURIComponent(row.slugOrId)}`}
        className="min-h-9 inline-flex items-center rounded-lg bg-dc-accent px-3 text-xs font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
      >
        Manage
      </Link>
      <Link
        to={`/events/${encodeURIComponent(row.slugOrId)}`}
        className="min-h-9 inline-flex items-center rounded-lg border border-dc-border px-3 text-xs text-dc-text-muted hover:text-dc-text"
      >
        Public page
      </Link>
    </div>
  )
}

function ProgramCard({
  row,
  orgSlug,
  showDoorLinks,
  viewerRole,
}: {
  row: OrgProgramRow
  orgSlug: string
  showDoorLinks: boolean
  viewerRole?: string | null
}) {
  return (
    <article className="rounded-xl border border-dc-border bg-dc-surface/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={row.kind === 'convention' ? 'accent' : 'neutral'}>
              {row.kind === 'convention' ? 'Convention' : 'Event'}
            </Badge>
            <Badge variant={statusBadgeVariant(row.statusTone)}>{row.statusLabel}</Badge>
          </div>
          <h4 className="mt-2 font-medium text-dc-text">{row.title}</h4>
          <p className="text-dc-micro text-dc-muted">/{row.slugOrId}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-dc-text-muted">
        <div>
          <dt className="text-dc-muted">When</dt>
          <dd className="text-dc-text">{formatProgramWhen(row.startsAt, row.endsAt)}</dd>
        </div>
        <div>
          <dt className="text-dc-muted">Location</dt>
          <dd className="text-dc-text">{row.location?.trim() || '-'}</dd>
        </div>
        {row.kind === 'event' ?
          <div>
            <dt className="text-dc-muted">Visibility</dt>
            <dd className="text-dc-text">{formatProgramVisibility(row.visibility)}</dd>
          </div>
        : null}
        {row.attendeeCount != null && row.attendeeCount > 0 ?
          <div>
            <dt className="text-dc-muted">RSVPs</dt>
            <dd className="text-dc-text">{row.attendeeCount}</dd>
          </div>
        : null}
      </dl>
      <div className="mt-4">
        <ProgramActions row={row} orgSlug={orgSlug} showDoorLinks={showDoorLinks} viewerRole={viewerRole} />
      </div>
    </article>
  )
}

export default function ProgramListSection({
  rows,
  orgSlug,
  calendarEnabled,
  createFlows,
  showDoorLinks = false,
  viewerRole = null,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const now = Date.now()

  const filtered = useMemo(() => {
    if (filter === 'convention') return rows.filter((r) => r.kind === 'convention')
    if (filter === 'event') return rows.filter((r) => r.kind === 'event')
    if (filter === 'upcoming') {
      return rows.filter((r) => r.startsAt && new Date(r.startsAt).getTime() >= now)
    }
    return rows
  }, [rows, filter, now])

  if (!calendarEnabled) return null

  return (
    <ScheduleSection id="all-programs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-dc-text">All programs</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            Conventions open the full program builder. Events without a convention use the event editor.
          </p>
        </div>
        {rows.length > 0 ?
          <label className="flex items-center gap-2 text-sm text-dc-text-muted">
            <span className="sr-only">Filter programs</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="min-h-10 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text"
            >
              <option value="all">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="convention">Conventions only</option>
              <option value="event">Events only</option>
            </select>
          </label>
        : null}
      </div>

      {rows.length === 0 ?
        <div className="mt-4">
          <EmptyState
            inline
            title="No programs yet"
            message="Create your first event or convention so members can discover it on your public calendar."
          />
          {createFlows.event ?
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {createFlows.convention ?
                <CreateFlowTriggerButton
                  flow={createFlows.convention}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Create convention
                </CreateFlowTriggerButton>
              : null}
              <CreateFlowTriggerButton
                flow={createFlows.event}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text"
              >
                Create event
              </CreateFlowTriggerButton>
            </div>
          : null}
        </div>
      : filtered.length === 0 ?
        <p className="mt-6 text-center text-sm text-dc-text-muted">No programs match this filter.</p>
      : (
        <>
          <div className="mt-4 hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-dc-border text-dc-micro uppercase tracking-wide text-dc-muted">
                  <th className="pb-2 pr-4 font-medium">Program</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Location</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dc-border/80">
                {filtered.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-dc-text">{row.title}</p>
                      <p className="text-dc-micro text-dc-muted">/{row.slugOrId}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={row.kind === 'convention' ? 'accent' : 'neutral'}>
                        {row.kind === 'convention' ? 'Convention' : 'Event'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-dc-text-muted">{formatProgramWhen(row.startsAt, row.endsAt)}</td>
                    <td className="py-3 pr-4 text-dc-text-muted">{row.location?.trim() || '-'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusBadgeVariant(row.statusTone)}>{row.statusLabel}</Badge>
                      {row.kind === 'event' ?
                        <p className="mt-1 text-dc-micro text-dc-muted">{formatProgramVisibility(row.visibility)}</p>
                      : null}
                    </td>
                    <td className="py-3 text-right">
                      <ProgramActions row={row} orgSlug={orgSlug} showDoorLinks={showDoorLinks} viewerRole={viewerRole} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 lg:hidden">
            {filtered.map((row) => (
              <ProgramCard key={row.id} row={row} orgSlug={orgSlug} showDoorLinks={showDoorLinks} viewerRole={viewerRole} />
            ))}
          </div>
        </>
      )}
    </ScheduleSection>
  )
}
