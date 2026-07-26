import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export function ToolsSection({
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

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
      />
    </svg>
  )
}

export function ToolsPageHeader({
  scheduleHref,
  publishHref,
  publicHubHref,
  showPublishSettings,
}: {
  scheduleHref: string
  publishHref: string
  publicHubHref: string
  showPublishSettings: boolean
}) {
  return (
    <ToolsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Operations</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <WrenchIcon className="h-5 w-5" />
            </span>
            Tools & exports
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Export program data, manage publishing utilities, and find the right organizer tools.
          </p>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Most event and convention tools live inside their program managers. This page gathers organization-level
            utilities and links to the right workspace.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={publicHubHref}
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:border-dc-border-strong hover:text-dc-text"
          >
            View public hub
          </Link>
          <Link
            to={scheduleHref}
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
          >
            Open Events & conventions
          </Link>
          {showPublishSettings ?
            <Link
              to={publishHref}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Edit publish settings
            </Link>
          : null}
        </div>
      </div>
    </ToolsSection>
  )
}

export type ToolStatusCard = {
  label: string
  value: string
  sub: string
  tone?: 'success' | 'warning' | 'neutral' | 'muted'
  href?: string
  linkLabel?: string
  disabled?: boolean
}

export function ToolStatusGrid({ cards }: { cards: ToolStatusCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-xl border border-dc-border bg-dc-surface/50 px-3 py-3',
            c.tone === 'success' && 'border-emerald-500/25 bg-emerald-950/10',
            c.tone === 'warning' && 'border-amber-500/25 bg-amber-950/10',
            c.tone === 'muted' && 'opacity-80',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{c.label}</p>
          <p className="mt-1 text-lg font-semibold text-dc-text">{c.value}</p>
          <p className="mt-0.5 text-dc-micro leading-snug text-dc-muted">{c.sub}</p>
          {c.href && c.linkLabel && !c.disabled ?
            <Link to={c.href} className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline">
              {c.linkLabel}
            </Link>
          : null}
        </div>
      ))}
    </div>
  )
}

export function ToolsSubsectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-dc-text">{title}</h3>
        <p className="mt-1 text-sm text-dc-text-muted">{subtitle}</p>
      </div>
      {actions ?
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      : null}
    </div>
  )
}

export function WhereToolsLiveCard({ scheduleHref }: { scheduleHref: string }) {
  return (
    <ToolsSection>
      <h3 className="text-sm font-semibold text-dc-text">Where tools live</h3>
      <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
        Convention exports, print schedules, check-in, and venue signs live inside each convention program manager.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-dc-text-muted">
        <li>CSV and ICS exports. Program manager → Exports</li>
        <li>Print schedule. Convention → Print</li>
        <li>Door check-in. Convention → Check-in</li>
      </ul>
      <Link to={scheduleHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        Open Events & conventions →
      </Link>
    </ToolsSection>
  )
}

export function PublishingChecklistCard({
  checks,
  publishHref,
  showPublishSettings,
}: {
  checks: { label: string; done: boolean }[]
  publishHref: string
  showPublishSettings: boolean
}) {
  return (
    <ToolsSection>
      <h3 className="text-sm font-semibold text-dc-text">Publishing checklist</h3>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            {c.done ?
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeWidth={2} strokeLinecap="round" d="M5 13l4 4L19 7" />
              </svg>
            : (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-dc-border" aria-hidden />
            )}
            <span className={c.done ? 'text-dc-text' : 'text-dc-text-muted'}>{c.label}</span>
          </li>
        ))}
      </ul>
      {showPublishSettings ?
        <Link to={publishHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
          Edit publish settings →
        </Link>
      : null}
    </ToolsSection>
  )
}

export function ToolsNeedHelpCard({
  publicHubHref,
  scheduleHref,
}: {
  publicHubHref: string
  scheduleHref: string
}) {
  return (
    <ToolsSection>
      <h3 className="text-sm font-semibold text-dc-text">Need help?</h3>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <a href="/support" className="font-medium text-dc-accent hover:underline">
            Open help center
          </a>
        </li>
        <li>
          <Link to={publicHubHref} className="font-medium text-dc-accent hover:underline">
            View public hub
          </Link>
        </li>
        <li>
          <Link to={scheduleHref} className="font-medium text-dc-accent hover:underline">
            Open Events & conventions
          </Link>
        </li>
      </ul>
    </ToolsSection>
  )
}

export function ToolsFooterNote({ scheduleHref }: { scheduleHref: string }) {
  return (
    <ToolsSection className="border-dc-border/80 bg-dc-surface/20">
      <p className="text-sm text-dc-text-muted">
        Some operational tools live outside this page. Open a convention from{' '}
        <Link to={scheduleHref} className="font-medium text-dc-accent hover:underline">
          Events & conventions
        </Link>{' '}
        to manage exports, print views, and check-in.
      </p>
    </ToolsSection>
  )
}
