import { Link } from 'react-router-dom'
import CreateFlowTriggerButton from '@/components/create-flow/CreateFlowTriggerButton'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import {
  ToolsSection,
  ToolsSubsectionHeader,
} from '@/components/organizer/tools/tools-ui'
import { formatProgramWhen, type OrgProgramRow } from '@/lib/organizer/org-schedule-programs'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'

type Props = {
  orgSlug: string
  calendarEnabled: boolean
  conventionRows: OrgProgramRow[]
  createConventionFlow: OpenCreateFlowOptions | null
  canManagePrograms: boolean
  showSettings: boolean
  scheduleHref: string
  publicCalendarHref: string
}

function ConventionExportRow({
  row,
  orgSlug,
  canManagePrograms,
}: {
  row: OrgProgramRow
  orgSlug: string
  canManagePrograms: boolean
}) {
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const convSlug = row.slugOrId
  const programHref = `${orgBase}/conventions/${encodeURIComponent(convSlug)}?tab=program`
  const exportsHref = `${orgBase}/conventions/${encodeURIComponent(convSlug)}?tab=exports`
  const csvHref = `/api/v1/conventions/${encodeURIComponent(convSlug)}/slots/export.csv`
  const icsHref = `/api/v1/conventions/${encodeURIComponent(convSlug)}/program.ics`
  const printHref = `${orgBase}/conventions/${encodeURIComponent(convSlug)}/print/schedule`
  const signsHref = `${orgBase}/conventions/${encodeURIComponent(convSlug)}/print/venue-signs`

  return (
    <li className="rounded-xl border border-dc-border bg-dc-surface/25 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-dc-text">{row.title}</p>
            <Badge variant="accent">{row.statusLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-dc-text-muted">{formatProgramWhen(row.startsAt, row.endsAt)}</p>
        </div>
        {canManagePrograms ?
          <div className="flex flex-wrap gap-2">
            <Link
              to={programHref}
              className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Manage program
            </Link>
            <a
              href={csvHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
            >
              CSV
            </a>
            <a
              href={icsHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
            >
              ICS
            </a>
            <Link
              to={printHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
            >
              Print
            </Link>
            <Link
              to={signsHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
            >
              Venue signs
            </Link>
            <Link to={exportsHref} className="text-xs font-medium text-dc-accent hover:underline sm:ml-1 sm:self-center">
              All exports →
            </Link>
          </div>
        : null}
      </div>
    </li>
  )
}

export default function ProgramExportsSection({
  orgSlug,
  calendarEnabled,
  conventionRows,
  createConventionFlow,
  canManagePrograms,
  showSettings,
  scheduleHref,
  publicCalendarHref,
}: Props) {
  const headerActions = (
    <>
      <Link
        to={scheduleHref}
        className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
      >
        Open Events & conventions
      </Link>
      {calendarEnabled ?
        <Link
          to={publicCalendarHref}
          className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
        >
          View public calendar
        </Link>
      : null}
    </>
  )

  if (!calendarEnabled) {
    return (
      <ToolsSection>
        <ToolsSubsectionHeader
          title="Program exports"
          subtitle="Enable the event calendar in Settings → Features to create conventions and export program data."
        />
        <p className="text-sm text-dc-text-muted">
          {showSettings ?
            <Link
              to={`/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=settings&settingsSection=features`}
              className="text-dc-accent hover:underline"
            >
              Open feature settings
            </Link>
          : (
            'Ask an organization admin to enable the calendar.'
          )}
        </p>
      </ToolsSection>
    )
  }

  return (
    <ToolsSection id="program-exports">
      <ToolsSubsectionHeader
        title="Program exports"
        subtitle="Export schedule and program data from each convention's program manager."
        actions={headerActions}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-3 py-2.5 text-sm">
          <p className="font-medium text-dc-text">CSV exports</p>
          <p className="mt-0.5 text-xs text-dc-muted">Available in program managers</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 px-3 py-2.5 text-sm">
          <p className="font-medium text-dc-text">ICS exports</p>
          <p className="mt-0.5 text-xs text-dc-muted">Program calendar files</p>
        </div>
        <div className="rounded-lg border border-dc-border bg-dc-surface/30 px-3 py-2.5 text-sm">
          <p className="font-medium text-dc-text-muted">Standalone events</p>
          <p className="mt-0.5 text-xs text-dc-muted">Export tooling coming later</p>
        </div>
      </div>

      {conventionRows.length === 0 ?
        <>
          <EmptyState
            inline
            title="No convention programs yet"
            message="Create a convention program to unlock schedule exports, print views, venue signs, and check-in tools."
            ctaLabel="Open Events & conventions"
            ctaHref={scheduleHref}
          />
          {createConventionFlow && canManagePrograms ?
            <div className="mt-4 flex justify-center">
              <CreateFlowTriggerButton
                flow={createConventionFlow}
                className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Create convention
              </CreateFlowTriggerButton>
            </div>
          : null}
        </>
      : (
        <ul className="space-y-3">
          {conventionRows.map((row) => (
            <ConventionExportRow key={row.id} row={row} orgSlug={orgSlug} canManagePrograms={canManagePrograms} />
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-dc-muted">
        Standalone event exports will appear here when export tooling is available. Create events from Events &amp;
        conventions in the meantime.
      </p>
    </ToolsSection>
  )
}
