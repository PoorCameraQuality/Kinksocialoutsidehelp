import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CreateFlowTriggerButton from '@/components/create-flow/CreateFlowTriggerButton'
import { visibilityLabel } from '@/lib/organizer/build-org-checklist'
import type { OpenCreateFlowOptions } from '@/lib/open-create-flow'
import { cn } from '@/lib/cn'

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M8 3v3M16 3v3M5 9h14M6 6h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  )
}

export function ScheduleSection({
  className,
  id,
  children,
}: {
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn('rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-soft)] sm:p-6', className)}
    >
      {children}
    </section>
  )
}

type CreateFlows = {
  convention: OpenCreateFlowOptions | null
  event: OpenCreateFlowOptions | null
}

export function SchedulePageHeader({
  calendarEnabled,
  createFlows,
  publicCalendarHref,
  settingsHref,
  showSettings,
}: {
  calendarEnabled: boolean
  createFlows: CreateFlows
  publicCalendarHref: string
  settingsHref?: string
  showSettings?: boolean
}) {
  return (
    <ScheduleSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Programs</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <CalendarIcon className="h-5 w-5" />
            </span>
            Events & conventions
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Create, schedule, and manage everything your organization hosts.
          </p>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Use standalone events for simple listings. Use conventions when you need a full program, schedule builder,
            registration flow, check-in, vendors, staff, or venue tools.
          </p>
        </div>
        {calendarEnabled && createFlows.event ?
          <div className="flex shrink-0 flex-wrap gap-2">
            {createFlows.convention ?
              <CreateFlowTriggerButton
                flow={createFlows.convention}
                className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Create convention
              </CreateFlowTriggerButton>
            : null}
            <CreateFlowTriggerButton
              flow={createFlows.event}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
            >
              Create event
            </CreateFlowTriggerButton>
            <Link
              to={publicCalendarHref}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:border-dc-border-strong hover:text-dc-text"
            >
              View public calendar
            </Link>
          </div>
        : null}
      </div>
      {!calendarEnabled ?
        <p className="mt-4 text-sm text-amber-200/90">
          Events &amp; conventions disabled in org settings.
          {showSettings && settingsHref ?
            <>
              {' '}
              <Link to={settingsHref} className="text-dc-accent hover:underline">
                Enable in Settings → Features
              </Link>
            </>
          : ' Ask an owner or admin to enable the calendar.'}
        </p>
      : null}
    </ScheduleSection>
  )
}

export function ProgramTypeChooser({ createFlows }: { createFlows: CreateFlows }) {
  if (!createFlows.event) return null
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-dc-accent/35 bg-dc-accent/5 p-5">
        <h3 className="text-base font-semibold text-dc-text">Create a convention program</h3>
        <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
          Best for multi-day events, full schedules, registration, presenters, vendors, staff, and check-in.
        </p>
        <p className="mt-2 text-xs text-dc-muted">
          Convention creation uses the org events API; program details are managed after the shell is created.
        </p>
        {createFlows.convention ?
          <CreateFlowTriggerButton
            flow={createFlows.convention}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Start convention →
          </CreateFlowTriggerButton>
        : (
          <p className="mt-4 text-xs text-dc-muted">Convention programs require owner or admin access.</p>
        )}
      </div>
      <div className="rounded-2xl border border-sky-500/25 bg-sky-950/20 p-5">
        <h3 className="text-base font-semibold text-dc-text">Create a standalone event</h3>
        <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
          Best for munches, workshops, socials, classes, and single-session events.
        </p>
        <CreateFlowTriggerButton
          flow={createFlows.event}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
        >
          Create event →
        </CreateFlowTriggerButton>
      </div>
    </div>
  )
}

export function ProgramStatsRow({
  conventionCount,
  eventCount,
  upcomingCount,
  incompleteCount,
  calendarLabel,
  calendarEnabled,
}: {
  conventionCount: number
  eventCount: number
  upcomingCount: number
  incompleteCount: number
  calendarLabel: string
  calendarEnabled: boolean
}) {
  const stats = [
    { label: 'Conventions', value: String(conventionCount), sub: `${conventionCount} upcoming` },
    { label: 'Standalone events', value: String(eventCount), sub: `${eventCount} upcoming` },
    {
      label: 'Upcoming programs',
      value: String(upcomingCount),
      sub: incompleteCount > 0 ? `${incompleteCount} need setup` : 'Next 30 days',
    },
    {
      label: 'Calendar visibility',
      value: calendarLabel,
      sub: calendarEnabled ? 'Visible on public hub' : 'Turn on in settings',
      highlight: calendarEnabled && calendarLabel === 'Public',
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn(
            'rounded-xl border border-dc-border bg-dc-surface/50 px-3 py-3',
            s.highlight && 'border-emerald-500/30 bg-emerald-950/15',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{s.label}</p>
          <p className="mt-1 text-xl font-semibold text-dc-text">{s.value}</p>
          <p className="mt-0.5 text-dc-micro text-dc-muted">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

export function ProgramEducationBlock() {
  return (
    <ScheduleSection>
      <h3 className="text-sm font-semibold text-dc-text">Not sure which to choose?</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm text-dc-text-muted">
        <div>
          <p className="font-medium text-dc-text">Convention</p>
          <p className="mt-1 leading-relaxed">
            Multi-day, registration, full schedule, presenters, vendors, staff, check-in.
          </p>
        </div>
        <div>
          <p className="font-medium text-dc-text">Event</p>
          <p className="mt-1 leading-relaxed">One-off workshop, munch, social, class, or meetup.</p>
        </div>
      </div>
      <Link to="/support" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        Learn more about programs →
      </Link>
    </ScheduleSection>
  )
}

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  chatEnabled: boolean
  subgroupsEnabled?: boolean
}

function GlanceRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-dc-text-muted">{label}</span>
      <span className={cn('font-medium', valueClassName ?? 'text-dc-text')}>{value}</span>
    </div>
  )
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <GlanceRow
      label={label}
      value={enabled ? 'Enabled' : 'Disabled'}
      valueClassName={enabled ? 'text-emerald-400' : 'text-dc-muted'}
    />
  )
}

export function OrganizationGlanceCard({
  memberCount,
  orgVisibility,
  featureFlags,
  settingsHref,
  showSettings,
}: {
  memberCount: number
  orgVisibility: string
  featureFlags: OrgFlags
  settingsHref: string
  showSettings: boolean
}) {
  return (
    <ScheduleSection>
      <h3 className="text-sm font-semibold text-dc-text">Organization at a glance</h3>
      <div className="mt-3 space-y-2">
        <GlanceRow label="Members" value={String(memberCount)} />
        <GlanceRow label="Visibility" value={visibilityLabel(orgVisibility)} valueClassName="text-emerald-400" />
        <FeatureRow label="Event calendar" enabled={featureFlags.calendarEnabled} />
        <FeatureRow label="Forums" enabled={featureFlags.forumsEnabled} />
        <FeatureRow label="Chat" enabled={featureFlags.chatEnabled} />
        <FeatureRow label="Subgroups" enabled={!!featureFlags.subgroupsEnabled} />
      </div>
      {showSettings ?
        <Link to={settingsHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
          Go to settings →
        </Link>
      : null}
    </ScheduleSection>
  )
}

export function ScheduleHelpCard() {
  return (
    <ScheduleSection>
      <h3 className="text-sm font-semibold text-dc-text">Need help?</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Guides for programs, registration, door check-in, and publishing your public calendar.
      </p>
      <Link to="/support" className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
        Open help center →
      </Link>
    </ScheduleSection>
  )
}

export function PublicCalendarCard({
  publicCalendarHref,
  settingsHref,
  showSettings,
  calendarEnabled,
}: {
  publicCalendarHref: string
  settingsHref: string
  showSettings: boolean
  calendarEnabled: boolean
}) {
  return (
    <ScheduleSection>
      <h3 className="text-sm font-semibold text-dc-text">Public calendar</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Members and visitors see public programs on your organization hub calendar.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          to={publicCalendarHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
        >
          View public calendar
        </Link>
        {showSettings && calendarEnabled ?
          <Link
            to={settingsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-dc-accent hover:underline"
          >
            Configure calendar visibility →
          </Link>
        : null}
        {showSettings && !calendarEnabled ?
          <Link
            to={settingsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Enable calendar
          </Link>
        : null}
      </div>
    </ScheduleSection>
  )
}
